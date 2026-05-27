import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { getMockUserId } from "@/lib/auth-mock";
import { checkRateLimit, rateLimitErrorResponse } from "@/lib/rate-limit";
import { identifySubject, detectStructure, findBestOfficialTopic } from "@/lib/ai/organizer";
import { generateFlashcards } from "@/lib/ai/flashcards";
import { OFFICIAL_TOPICS } from "@/lib/constants/official-topics";
import { generateSmartSchedule } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

interface DetectedBlock {
  type?: string;
  title: string;
  description: string;
  pageStart: number;
  pageEnd: number;
  estimatedStudyMinutes: number;
  sourceHeading?: string;
  createdBy?: string;
  confidence?: number;
  officialTopicId?: string | null;
  officialTopicName?: string | null;
  topicCode?: string | null;
  pageTypes?: string[];
  supportType?: string | null;
}

interface PageContent {
  pageNumber: number;
  text: string;
}

// ─── pdfjs cache ──────────────────────────────────────────────────────────────

let pdfjsLibCache: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;

async function getPdfjsLib() {
  if (pdfjsLibCache) return pdfjsLibCache;
  const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  lib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).href;
  pdfjsLibCache = lib;
  return lib;
}

// ─── Extração por página ───────────────────────────────────────────────────────

async function extractAllPages(sourcePath: string): Promise<{ pages: PageContent[]; numPages: number }> {
  const pdfjsLib = await getPdfjsLib();
  
  // Download from Supabase Storage always
  const { data, error } = await supabase.storage.from('materials').download(sourcePath);
  if (error) throw new Error(`Erro ao baixar arquivo do Storage: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  const pages: PageContent[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    let text = textContent.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    
    // Sanitize null bytes (\u0000) to prevent Postgres invalid byte sequence error
    text = text.replace(/\u0000/g, "");
    
    pages.push({ pageNumber: i, text });
  }

  return { pages, numPages };
}

// ─── Pipeline por material ─────────────────────────────────────────────────────

async function processMaterial(material: any, userId: string, isReorganizing: boolean = false) {
  const log = (msg: string) => console.log(`[ORGANIZE] ${material.fileName}: ${msg}`);
  const result = { blocks: 0, flashcards: 0, subjectCreated: false };

  // ── Etapa 1: Extraindo texto por página ──────────────────────────────────
  log(`[Organize] PDF iniciado: ${material.fileName}`);

  let nonEmptyPages: PageContent[] = [];
  let numPages = material.totalPages || 0;

  const existingExtracted = await prisma.extractedContent.findMany({
    where: { materialId: material.id },
    orderBy: { pageNumber: "asc" }
  });

  if (existingExtracted.length > 0) {
    nonEmptyPages = existingExtracted.map(p => ({
      pageNumber: p.pageNumber,
      text: p.text
    }));
    log(`Usando ${nonEmptyPages.length} páginas já extraídas em cache do banco.`);
    if (numPages <= 0) {
      numPages = Math.max(...existingExtracted.map(p => p.pageNumber), 0);
    }
  } else {
    await prisma.studyMaterial.update({
      where: { id: material.id },
      data: { organizationStatus: "EXTRACTING" }
    });

    log("Extraindo texto por página...");
    const { pages, numPages: parsedNumPages } = await extractAllPages(material.sourcePath);
    numPages = parsedNumPages;
    log(`[Organize] Texto extraído: ${numPages} páginas`);

    nonEmptyPages = pages.filter(p => p.text.length > 10);
    if (nonEmptyPages.length === 0) {
      throw new Error(
        "Este PDF não possui texto selecionável. OCR ainda não está disponível."
      );
    }
  }

  log(`${nonEmptyPages.length}/${numPages} páginas com texto extraído.`);

  // ── Etapa 2: Identificar matéria ────────────────────────────────────────

  await prisma.studyMaterial.update({
    where: { id: material.id },
    data: { organizationStatus: "ANALYZING" }
  });

  // Usar as primeiras páginas para identificar a matéria
  const sampleText = nonEmptyPages
    .slice(0, Math.min(5, nonEmptyPages.length))
    .map(p => p.text)
    .join("\n\n");

  let subjectId = material.subjectId;
  let detectedSubject = material.detectedSubjectName || "";

  if (subjectId && !detectedSubject) {
    const existingSubject = await prisma.studySubject.findUnique({ where: { id: subjectId } });
    if (existingSubject) detectedSubject = existingSubject.name;
  }

  if (!subjectId || isReorganizing) {
    log("Identificando matéria com IA...");
    const idResult = await identifySubject(sampleText.substring(0, 3000), material.fileName);
    detectedSubject = idResult.subjectName;
    log(`Matéria detectada: "${detectedSubject}" (Confiança: ${idResult.confidence}, Motivo: ${idResult.reason})`);

    let subject = await prisma.studySubject.findFirst({
      where: { userId, name: { contains: detectedSubject } }
    });

    if (!subject) {
      const allSubjects = await prisma.studySubject.findMany({
        where: { userId },
        select: { id: true, name: true, createdAt: true, updatedAt: true, description: true, priority: true, examWeight: true, progress: true, studyPriority: true, userId: true }
      });
      subject = allSubjects.find(s => detectedSubject.includes(s.name)) ?? null;
    }

    if (!subject) {
      log(`Criando nova matéria: ${detectedSubject}`);
      subject = await prisma.studySubject.create({
        data: { name: detectedSubject, userId, priority: 1 }
      });
      result.subjectCreated = true;
    } else {
      log(`Reutilizando matéria: ${subject.name}`);
    }

    subjectId = subject.id;
    await prisma.studyMaterial.update({
      where: { id: material.id },
      data: { 
        subjectId, 
        detectedSubjectName: detectedSubject,
        processingError: idResult.confidence < 0.5 ? `Baixa confiança na identificação da matéria (${idResult.confidence}). Verifique se está correto.` : null
      }
    });
  }

  // ── Etapa 3: Salvar ExtractedContent por página ─────────────────────────

  if (existingExtracted.length === 0) {
    log("Salvando conteúdo extraído no banco de dados...");
    await prisma.extractedContent.deleteMany({
      where: { materialId: material.id }
    });

    const contentRecords = nonEmptyPages.map((p, idx) => ({
      userId,
      subjectId: subjectId as string,
      materialId: material.id,
      pageNumber: p.pageNumber,
      text: p.text,
      orderIndex: idx,
      estimatedStudyMinutes: 0, 
    }));

    await prisma.extractedContent.createMany({ data: contentRecords });
    log(`${contentRecords.length} páginas salvas em ExtractedContent.`);
  } else {
    // Garante que o subjectId esteja correto para os registros já existentes
    await prisma.extractedContent.updateMany({
      where: { materialId: material.id },
      data: { subjectId }
    });
  }

  // ── Etapa 4: Detectar estrutura (blocos) ────────────────────────────────

  const fullTextForStructure = nonEmptyPages
    .slice(0, 15)
    .map(p => p.text)
    .join("\n");

  log("Detectando estrutura de blocos com IA...");
  const structResult = await detectStructure(fullTextForStructure, numPages, detectedSubject, nonEmptyPages);
  const detectedBlocks = structResult.blocks || [];
  const materialRole = structResult.materialRole || "UNKNOWN";

  // Atualizar o material com o role detectado (e limpar erro)
  await prisma.studyMaterial.update({
    where: { id: material.id },
    data: { 
      organizationStatus: "ORGANIZING",
      materialRole: materialRole as any
    }
  });

  if ((!detectedBlocks || detectedBlocks.length === 0) && materialRole !== "SUPPORT_MATERIAL") {
    throw new Error("Não foi possível mapear a estrutura pedagógica de blocos temáticos reais.");
  }

  // Validação rígida antes de salvar os blocos no banco de dados
  const mainSubjects = [
    "Língua Portuguesa",
    "Direito Administrativo",
    "Direito Constitucional",
    "Direito do Trabalho",
    "Direito Processual do Trabalho",
    "Direito Civil",
    "Direito Processual Civil"
  ];
  const isMainSubject = mainSubjects.includes(detectedSubject);

  const FORBIDDEN_GENERIC_PATTERNS = [
    /^parte\s+\d+/i,
    /^conteúdo\s+\d+/i,
    /^conteudo\s+\d+/i,
    /^bloco\s+\d+$/i
  ];
  const GENERIC_TITLES = [
    "TODO CONTEUDO", "TODO O CONTEUDO", "CONTEUDO COMPLETO", 
    "MATERIAL COMPLETO", "MATERIAL GERAL", "RESUMO GERAL", "CONTEUDO GERAL",
    "CONTEUDO DA MATERIA", "APOSTILA COMPLETA", "PDF COMPLETO", "PARTE 1 DO CONTEUDO",
    "PARTE 2 DO CONTEUDO", "PARTE 3 DO CONTEUDO", "PARTE DO CONTEUDO", "MATERIAL INTEGRA", "TODO O PDF",
    "CONTEUDO INTEGRAL", "VISAO GERAL", "ESTUDO COMPLETO", "APOSTILA", "PDF", 
    "CONTEUDO", "SUMARIO", "CAPITULO", "INTRODUCAO", "FUNDAMENTOS E CONCEITOS DE OUTROS",
    "FUNDAMENTOS DE OUTROS", "CONCEITOS DE OUTROS", "OUTROS - BLOCO 1", "OUTROS", "BLOCO GENERICO"
  ];

  for (const block of detectedBlocks) {
    const titleNorm = block.title.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const isForbiddenTitle = GENERIC_TITLES.some(gt => titleNorm === gt) ||
                              FORBIDDEN_GENERIC_PATTERNS.some(re => re.test(block.title));
    if (isForbiddenTitle) {
      throw new Error(`VALIDATION_FAILED: O bloco "${block.title}" possui um título genérico proibido. A organização foi abortada.`);
    }

    // Normaliza valores nulos vindos como string ou vazio
    if (block.officialTopicId === "null" || block.officialTopicId === "undefined" || block.officialTopicId === "") {
      block.officialTopicId = null;
      block.officialTopicName = null;
      block.topicCode = null;
    }

    // Se a disciplina exige mapeamento e o bloco principal está sem tópico, tentamos mapear
    if (isMainSubject && block.type !== "SUPPORT_BLOCK" && !block.officialTopicId) {
      const subjectTopics = OFFICIAL_TOPICS.filter(
        t => t.subjectName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
             detectedSubject.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      );

      if (subjectTopics.length > 0) {
        const combinedText = `${block.title} ${block.description || ""} ${block.sourceHeading || ""}`;
        const bestTopic = findBestOfficialTopic(combinedText, subjectTopics);
        if (bestTopic) {
          block.officialTopicId = bestTopic.id;
          block.topicCode = bestTopic.topicCode;
          block.officialTopicName = bestTopic.title;
          console.log(`[Validation Fallback] Mapeado bloco "${block.title}" com sucesso para o tópico "${bestTopic.title}"`);
        } else {
          // Se nenhum for melhor, usa o primeiro tópico como fallback
          block.officialTopicId = subjectTopics[0].id;
          block.topicCode = subjectTopics[0].topicCode;
          block.officialTopicName = subjectTopics[0].title;
          console.log(`[Validation Fallback] Nenhum tópico ideal para bloco "${block.title}". Fallback para primeiro tópico: "${subjectTopics[0].title}"`);
        }
      } else {
        // Caso a disciplina não possua tópicos cadastrados na matriz
        block.officialTopicId = null;
        block.topicCode = "GERAL";
        block.officialTopicName = "Tópico não identificado";
      }
    }

    if (block.pageStart < 1 || block.pageEnd < block.pageStart || block.pageEnd > numPages) {
      throw new Error(`VALIDATION_FAILED: O bloco "${block.title}" possui intervalo de páginas inválido (${block.pageStart}-${block.pageEnd}). A organização foi abortada.`);
    }
  }

  log(`[Organize] Blocos processados/detectados: ${detectedBlocks.length}. Material Role: ${materialRole}`);

  if (materialRole === "SUPPORT_MATERIAL") {
    // Para material de apoio puro, não criamos StudyBlock principais.
    // Identificamos os tópicos suportados e criamos StudyBlockSupport se o bloco teórico correspondente já existir.
    for (const blockDef of detectedBlocks) {
      if (!blockDef.officialTopicId) continue;

      const existingBlock = await prisma.studyBlock.findFirst({
        where: { userId, subjectId: subjectId as string, officialTopicId: blockDef.officialTopicId }
      });

      if (existingBlock) {
        log(`Vinculando apoio ao bloco principal encontrado: ${existingBlock.title}`);
        await prisma.studyBlockSupport.create({
          data: {
            studyBlockId: existingBlock.id,
            materialId: material.id,
            pageStart: blockDef.pageStart,
            pageEnd: blockDef.pageEnd,
            supportType: blockDef.supportType || "QUESTIONS",
            confidence: blockDef.confidence || 0.8
          }
        });
      } else {
        // Bloco ainda não existe, marca o material para vincular no futuro
        log(`Bloco principal não encontrado para o tópico ${blockDef.officialTopicId}. Deixando pendente.`);
        await prisma.studyMaterial.update({
          where: { id: material.id },
          data: { supportForTopicId: blockDef.officialTopicId }
        });
        // Se houver múltiplos tópicos em um só material de apoio, salvamos a pendência do primeiro.
        break; 
      }
    }
  } else {
    // MAIN_MATERIAL ou MIXED_MATERIAL
    const mainBlocksCreated: Record<string, string> = {}; // Mapeia officialTopicId -> studyBlock.id criado nesta leva
    
    // Primeiro passo: criar todos os blocos principais teóricos (MAIN_BLOCK)
    for (let i = 0; i < detectedBlocks.length; i++) {
      const blockDef = detectedBlocks[i];
      if (blockDef.type === "SUPPORT_BLOCK") continue; // Processados no segundo passo

      const pageStart = blockDef.pageStart || 1;
      const pageEnd = blockDef.pageEnd || pageStart;

      // Criar o bloco
      const studyBlock = await prisma.studyBlock.create({
        data: {
          userId,
          subjectId: subjectId as string,
          materialId: material.id,
          title: blockDef.title || `Parte ${i + 1}`,
          description: blockDef.description || "",
          pageStart,
          pageEnd,
          orderIndex: i,
          estimatedStudyMinutes: blockDef.estimatedStudyMinutes || 60,
          createdBy: blockDef.createdBy || "AI",
          confidence: blockDef.confidence ?? 1.0,
          sourceHeading: blockDef.sourceHeading,
          officialTopicId: blockDef.officialTopicId,
          officialTopicName: blockDef.officialTopicName,
          topicCode: blockDef.topicCode,
          status: "NOT_STARTED",
          nextActionType: "THEORY",
        }
      });

      result.blocks++;
      if (blockDef.officialTopicId) {
        mainBlocksCreated[blockDef.officialTopicId] = studyBlock.id;
      }

      // Vínculo retroativo: busca StudyMaterials (SUPPORT) pendentes para este tópico
      if (blockDef.officialTopicId) {
        const pendingSupports = await prisma.studyMaterial.findMany({
          where: {
            userId,
            subjectId: subjectId as string,
            materialRole: "SUPPORT_MATERIAL",
            supportForTopicId: blockDef.officialTopicId
          }
        });

        for (const ps of pendingSupports) {
          log(`[Relink Support] Vinculando material de apoio pendente (${ps.fileName}) ao novo bloco ${studyBlock.title}`);
          await prisma.studyBlockSupport.create({
            data: {
              studyBlockId: studyBlock.id,
              materialId: ps.id,
              supportType: "QUESTIONS", // Default para questões pendentes
              confidence: 1.0
            }
          });
          // Limpar a pendência para evitar links futuros desnecessários
          await prisma.studyMaterial.update({
            where: { id: ps.id },
            data: { supportForTopicId: null }
          });
        }
      }

      // ── REORGANIZAÇÃO: Re-vincular cards órfãos ──────────────────────────
      if (isReorganizing) {
        log(`[Relink] Buscando cards para o novo bloco: ${studyBlock.title} (p.${pageStart}-${pageEnd})`);
        const relinkResult = await prisma.flashcard.updateMany({
          where: {
            materialId: material.id,
            studyBlockId: null,
            sourcePageStart: { gte: pageStart, lte: pageEnd }
          },
          data: {
            studyBlockId: studyBlock.id
          }
        });
        if (relinkResult.count > 0) {
          log(`[Relink] ${relinkResult.count} cards re-vinculados a este bloco.`);
          result.flashcards += relinkResult.count;
        }
      }
    }

    // Segundo passo: criar blocos de apoio (SUPPORT_BLOCK) contidos no próprio PDF e vinculá-los aos blocos teóricos correspondentes
    for (let i = 0; i < detectedBlocks.length; i++) {
      const blockDef = detectedBlocks[i];
      if (blockDef.type !== "SUPPORT_BLOCK") continue;

      const pageStart = blockDef.pageStart || 1;
      const pageEnd = blockDef.pageEnd || pageStart;

      // Tenta achar bloco teórico criado na mesma leva
      let targetBlockId: string | null = null;
      if (blockDef.officialTopicId && mainBlocksCreated[blockDef.officialTopicId]) {
        targetBlockId = mainBlocksCreated[blockDef.officialTopicId];
      } else {
        // Tenta buscar no banco um bloco teórico já existente para o mesmo tópico
        const existingMainBlock = await prisma.studyBlock.findFirst({
          where: {
            userId,
            subjectId: subjectId as string,
            officialTopicId: blockDef.officialTopicId || undefined
          }
        });
        if (existingMainBlock) {
          targetBlockId = existingMainBlock.id;
        }
      }

      if (targetBlockId) {
        log(`[Mixed Support] Criando apoio p.${pageStart}-${pageEnd} do tipo ${blockDef.supportType || "OTHER"} no bloco ${targetBlockId}`);
        await prisma.studyBlockSupport.create({
          data: {
            studyBlockId: targetBlockId,
            materialId: material.id,
            pageStart,
            pageEnd,
            supportType: blockDef.supportType || "OTHER",
            confidence: blockDef.confidence || 0.8
          }
        });
      } else {
        log(`[Mixed Support] Bloco teórico principal não encontrado para o apoio do tópico ${blockDef.officialTopicId || "GERAL"}.`);
        // Fallback: Vincula ao primeiro bloco teórico do assunto para não perder o apoio
        const firstBlockOfSubject = await prisma.studyBlock.findFirst({
          where: { userId, subjectId: subjectId as string }
        });
        if (firstBlockOfSubject) {
          log(`[Mixed Support Fallback] Vinculando ao primeiro bloco do assunto: ${firstBlockOfSubject.title}`);
          await prisma.studyBlockSupport.create({
            data: {
              studyBlockId: firstBlockOfSubject.id,
              materialId: material.id,
              pageStart,
              pageEnd,
              supportType: blockDef.supportType || "OTHER",
              confidence: 0.5
            }
          });
        }
      }
    }
  }

  // ── Etapa 6: Finalizar ───────────────────────────────────────────────────

  await prisma.studyMaterial.update({
    where: { id: material.id },
    data: {
      organizationStatus: "ORGANIZED",
      detectedStructure: JSON.stringify(structResult),
      totalPages: numPages
    }
  });

  log(`✅ Concluído: ${result.blocks} blocos.`);
  return result;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;
    const reset = body.reset === true;
    const materialId = body.materialId as string | undefined;

    // 1. Usuário real
    const userId = await getMockUserId();

    // Rate Limiting: 3 execuções por 30 minutos por usuário (apenas execuções reais, não polling)
    if (body.getPendingIds !== true) {
      const rateLimitKey = `organize-all:${userId}`;
      const rateCheck = await checkRateLimit(rateLimitKey, 3, 1800);
      if (!rateCheck.success) {
        return rateLimitErrorResponse(rateCheck.reset);
      }
    }
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Retorna IDs de todos os materiais pendentes para polling real no frontend
    if (body.getPendingIds === true) {
      const pendingMaterials = await prisma.studyMaterial.findMany({
        where: {
          userId,
          organizationStatus: { in: ["IMPORTED", "UPLOADED", "NEW", "EXTRACTING", "ANALYZING", "GENERATING_FLASHCARDS", "ERROR"] },
          sourceType: { in: ["CLOUD_UPLOAD", "LOCAL_UPLOAD", "LOCAL_INBOX"] }
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json({
        materialIds: pendingMaterials.map(m => m.id),
        count: pendingMaterials.length,
        success: true
      });
    }

    // Handle full reorganization reset
    if (reset) {
      console.log(`[REORGANIZE RESET] Iniciando reset completo para o usuário: ${userId}`);

      // Delete all derived data in safe dependency order
      await prisma.flashcardReview.deleteMany({
        where: { flashcard: { userId } }
      });
      await prisma.flashcard.deleteMany({
        where: { userId }
      });
      await prisma.studyScheduleItem.deleteMany({
        where: { userId }
      });
      await prisma.studySchedule.deleteMany({
        where: { userId }
      });
      await prisma.studyBlock.deleteMany({
        where: { userId }
      });
      await prisma.studyPlanDay.deleteMany({
        where: { studyPlan: { userId } }
      });
      await prisma.studyPlan.deleteMany({
        where: { userId }
      });
      // Preserva o ExtractedContent para evitar custos de extração/OCR desnecessários
      // await prisma.extractedContent.deleteMany({
      //   where: { userId }
      // });

      // Reset progress of all study subjects to 0
      await prisma.studySubject.updateMany({
        where: { userId },
        data: { progress: 0 }
      });

      // Reset all study materials back to IMPORTED state
      await prisma.studyMaterial.updateMany({
        where: { userId },
        data: {
          organizationStatus: "IMPORTED",
          processingError: null,
          detectedSubjectName: null,
          detectedStructure: null,
          subjectId: null
        }
      });

      // Fetch all CLOUD_UPLOAD study material IDs to return to client
      const materials = await prisma.studyMaterial.findMany({
        where: {
          userId,
          sourceType: { in: ["CLOUD_UPLOAD", "LOCAL_UPLOAD", "LOCAL_INBOX"] }
        },
        select: { id: true }
      });

      const materialIds = materials.map(m => m.id);
      console.log(`[REORGANIZE RESET] Reset concluído com sucesso. ${materialIds.length} materiais prontos para reprocessar.`);

      return NextResponse.json({
        message: "Reset completo realizado. Materiais prontos para reorganização.",
        count: materialIds.length,
        materialIds,
        success: true
      });
    }

    console.log(`[ORGANIZE ALL] Iniciando processamento para: ${userId} (force=${force}, materialId=${materialId || "todos"})`);

    // 2. Materiais a organizar (inclui tentativas recuperáveis na fila de processamento automático)
    const statusFilter = [
      "IMPORTED", "UPLOADED", "NEW", "EXTRACTING", "ANALYZING", 
      "GENERATING_FLASHCARDS", "ERROR", "NEEDS_RETRY", "AI_UNAVAILABLE", "SUBJECT_DETECTION_FAILED",
      "VALIDATION_FAILED", "TOC_MAPPING_FAILED", "NO_MAIN_THEORY_FOUND"
    ];

    const materialsToProcess = await prisma.studyMaterial.findMany({
      where: {
        userId,
        ...(materialId ? { id: materialId } : { organizationStatus: { in: statusFilter } }),
        sourceType: { in: ["CLOUD_UPLOAD", "LOCAL_UPLOAD", "LOCAL_INBOX"] }
      },
      take: 1
    });

    console.log(`[ORGANIZE ALL] ${materialsToProcess.length} materiais encontrados.`);

    if (materialsToProcess.length === 0) {
      return NextResponse.json({
        message: force ? "Nenhum material encontrado para reorganizar." : "Nenhum material pendente de organização encontrado.",
        count: 0
      });
    }

    const summary = {
      success: 0,
      errors: 0,
      needsRetry: 0,
      totalBlocks: 0,
      totalFlashcards: 0,
      subjectsCreated: 0,
      materialsProcessed: 0,
      noTextPdfs: 0,
    };

    // 3. Processar cada material
    for (const material of materialsToProcess) {
      try {
        if (force) {
          console.log(`[REORGANIZE] Apagando cards antigos e limpando blocos para: ${material.fileName}`);
          
          await prisma.flashcard.deleteMany({
            where: { materialId: material.id }
          });

          await prisma.studyBlock.deleteMany({ where: { materialId: material.id } });
        }

        const result = await processMaterial(material, userId, force);
        summary.success++;
        summary.totalBlocks += result.blocks;
        summary.totalFlashcards += result.flashcards;
        if (result.subjectCreated) summary.subjectsCreated++;
      } catch (error: any) {
        console.log(`[ORGANIZE MATERIAL ERROR] ${material.fileName}:`, error.message);
        
        let targetStatus = "NEEDS_RETRY";
        if (error.message.includes("SUBJECT_DETECTION_FAILED")) {
          targetStatus = "SUBJECT_DETECTION_FAILED";
        } else if (error.message.includes("VALIDATION_FAILED")) {
          targetStatus = "VALIDATION_FAILED";
        } else if (error.message.includes("TOC_MAPPING_FAILED")) {
          targetStatus = "TOC_MAPPING_FAILED";
        } else if (error.message.includes("NO_MAIN_THEORY_FOUND")) {
          targetStatus = "NO_MAIN_THEORY_FOUND";
        } else if (
          error.message.includes("AI_UNAVAILABLE") || 
          error.message.includes("AI_TIMEOUT") || 
          error.message.includes("503") || 
          error.message.includes("429") ||
          error.message.includes("indisponível")
        ) {
          targetStatus = "AI_UNAVAILABLE";
        } else if (
          error.message.includes("VALIDATION_REJECTED_ALL_BLOCKS") ||
          error.message.includes("A organização foi abortada") ||
          error.message.includes("validação pedagógica") ||
          error.message.includes("rejeitada") ||
          error.message.includes("rejeitados") ||
          error.message.includes("título genérico") ||
          error.message.includes("tópico oficial") ||
          error.message.includes("intervalo de páginas")
        ) {
          targetStatus = "VALIDATION_FAILED";
        } else if (
          error.message.includes("texto selecionável") || 
          error.message.includes("Texto insuficiente") ||
          error.message.includes("PDF_TEXT_EXTRACTION_FAILED")
        ) {
          targetStatus = "ERROR";
        }

        let savedErrorMsg = error.message || "Erro desconhecido na organização";
        if (savedErrorMsg.includes("VALIDATION_FAILED:")) {
          savedErrorMsg = savedErrorMsg.replace("VALIDATION_FAILED:", "").trim();
        } else if (savedErrorMsg.includes("TOC_MAPPING_FAILED:")) {
          savedErrorMsg = savedErrorMsg.replace("TOC_MAPPING_FAILED:", "").trim();
        } else if (savedErrorMsg.includes("NO_MAIN_THEORY_FOUND:")) {
          savedErrorMsg = savedErrorMsg.replace("NO_MAIN_THEORY_FOUND:", "").trim();
        } else if (savedErrorMsg.includes("AI_UNAVAILABLE:")) {
          savedErrorMsg = savedErrorMsg.replace("AI_UNAVAILABLE:", "").trim();
        } else if (savedErrorMsg.includes("VALIDATION_REJECTED_ALL_BLOCKS:")) {
          savedErrorMsg = savedErrorMsg.replace("VALIDATION_REJECTED_ALL_BLOCKS:", "Todos os blocos foram rejeitados pela validação de qualidade:").trim();
        } else if (savedErrorMsg.includes("AI_INVALID_JSON:")) {
          savedErrorMsg = savedErrorMsg.replace("AI_INVALID_JSON:", "A IA retornou um JSON estruturado inválido:").trim();
        } else if (savedErrorMsg.includes("STRUCTURE_MAPPING_FAILED:")) {
          savedErrorMsg = savedErrorMsg.replace("STRUCTURE_MAPPING_FAILED:", "Não foi possível mapear a estrutura de forma pedagógica segura:").trim();
        }

        await prisma.studyMaterial.update({
          where: { id: material.id },
          data: { 
            organizationStatus: targetStatus,
            processingError: savedErrorMsg.substring(0, 250) 
          }
        });

        if (targetStatus === "ERROR") {
          summary.errors++;
          summary.noTextPdfs++;
        } else {
          summary.needsRetry++;
        }
      } finally {
        summary.materialsProcessed++;
      }
    }

    // 4. Cronograma será atualizado de forma otimizada ao final do lote pelo frontend.

    // 5. Mensagem de resultado
    const messageParts: string[] = [];
    if (summary.success > 0) {
      messageParts.push(`${summary.success} PDF(s) organizado(s) com sucesso`);
      messageParts.push(`${summary.totalBlocks} blocos criados`);
    }
    if (summary.needsRetry > 0) {
      messageParts.push(`${summary.needsRetry} PDF(s) aguardando nova tentativa (IA indisponível ou baixa confiança)`);
    }
    if (summary.errors > 0) {
      messageParts.push(`${summary.errors} PDF(s) com erro crítico`);
    }
    
    const message = summary.success > 0
      ? `Organização concluída! ${messageParts.join(" · ")}. Nenhum bloco genérico foi criado.`
      : `Não conseguimos organizar o material. ${messageParts.join(" · ")}. Nenhum bloco genérico foi criado.`;

    return NextResponse.json({
      message,
      results: {
        success: summary.success,
        errors: summary.errors,
        needsRetry: summary.needsRetry,
        totalBlocks: summary.totalBlocks,
        totalFlashcards: summary.totalFlashcards,
        subjectsCreated: summary.subjectsCreated,
        materialsProcessed: summary.materialsProcessed,
      }
    });

  } catch (error: any) {
    console.error("[FATAL] /api/materials/organize-all:", error);
    return NextResponse.json({
      error: "Erro interno no servidor ao processar organização",
      details: error.message
    }, { status: 500 });
  }
}
