/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { identifySubject, detectStructure } from "@/lib/ai/organizer";
import { generateFlashcards } from "@/lib/ai/flashcards";
import { generateSmartSchedule } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

interface DetectedBlock {
  title: string;
  description: string;
  pageStart: number;
  pageEnd: number;
  estimatedStudyMinutes: number;
  sourceHeading?: string;
  createdBy?: string;
  confidence?: number;
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

async function extractAllPages(sourcePath: string, isLocal: boolean): Promise<{ pages: PageContent[]; numPages: number }> {
  const pdfjsLib = await getPdfjsLib();
  let uint8Array: Uint8Array;

  if (isLocal) {
     throw new Error("Arquivos locais não são suportados na Web. Use o upload em nuvem.");
  } else {
    // Download from Supabase Storage
    const { data, error } = await supabase.storage.from('materials').download(sourcePath);
    if (error) throw new Error(`Erro ao baixar arquivo do Storage: ${error.message}`);
    const arrayBuffer = await data.arrayBuffer();
    uint8Array = new Uint8Array(arrayBuffer);
  }

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

  const isLocal = material.sourceType === "LOCAL_INBOX";
  
  if (isLocal) {
    throw new Error("Arquivos locais não são suportados na Web.");
  }

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
  } else {
    await prisma.studyMaterial.update({
      where: { id: material.id },
      data: { organizationStatus: "EXTRACTING" }
    });

    log("Extraindo texto por página...");
    const { pages, numPages: parsedNumPages } = await extractAllPages(material.sourcePath, isLocal);
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
  let detectedSubject = "";
  
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
        select: { id: true, name: true, createdAt: true, updatedAt: true, description: true, priority: true, examWeight: true, progress: true, userId: true }
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
  let detectedBlocks: DetectedBlock[];
  try {
    detectedBlocks = await detectStructure(fullTextForStructure, numPages);
  } catch (err: any) {
    console.warn(`[ORGANIZE] IA falhou ao detectar blocos para ${material.fileName}. Criando bloco único.`);
    detectedBlocks = [];
  }

  // FALLBACK: Se não detectar blocos, criar um bloco único cobrindo todo o material
  if (!detectedBlocks || detectedBlocks.length === 0) {
    detectedBlocks = [{
      title: "Conteúdo Completo",
      description: "Estudo integral do material (bloco gerado automaticamente).",
      pageStart: 1,
      pageEnd: numPages,
      sourceHeading: "Material Completo",
      estimatedStudyMinutes: numPages * 3
    }];
  }

  log(`[Organize] Blocos criados: ${detectedBlocks.length}`);

  // ── Etapa 5: Criar StudyBlocks ──────────────────────────────────────────

  await prisma.studyMaterial.update({
    where: { id: material.id },
    data: { organizationStatus: "ORGANIZING" }
  });

  for (let i = 0; i < detectedBlocks.length; i++) {
    const blockDef = detectedBlocks[i];
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
        status: "NOT_STARTED",
        nextActionType: "THEORY",
      }
    });

    result.blocks++;

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

  // ── Etapa 6: Finalizar ───────────────────────────────────────────────────

  await prisma.studyMaterial.update({
    where: { id: material.id },
    data: {
      organizationStatus: "ORGANIZED",
      detectedStructure: JSON.stringify(detectedBlocks),
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

    // 1. Usuário real
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { name: "Usuário Dev", email: "dev@kehl.study" }
      });
    }
    const userId = user.id;
    console.log(`[ORGANIZE ALL] Iniciando para: ${userId} (force=${force})`);

    // 2. Materiais a organizar
    const statusFilter = force 
      ? ["IMPORTED", "UPLOADED", "NEW", "EXTRACTING", "ANALYZING", "GENERATING_FLASHCARDS", "ORGANIZED", "ERROR"] as any[]
      : ["IMPORTED", "UPLOADED", "NEW", "EXTRACTING", "ANALYZING", "GENERATING_FLASHCARDS"] as any[];

    const materialsToProcess = await prisma.studyMaterial.findMany({
      where: {
        userId,
        organizationStatus: { in: statusFilter },
        sourceType: { in: ["CLOUD_UPLOAD"] } // Apenas Nuvem na Web
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
          await prisma.extractedContent.deleteMany({ where: { materialId: material.id } });
        }

        const result = await processMaterial(material, userId, force);
        summary.success++;
        summary.totalBlocks += result.blocks;
        summary.totalFlashcards += result.flashcards;
        if (result.subjectCreated) summary.subjectsCreated++;
      } catch (error: any) {
        console.error(`[ORGANIZE MATERIAL ERROR] ${material.fileName}:`, error.message);
        await prisma.studyMaterial.update({
          where: { id: material.id },
          data: { 
            organizationStatus: "ERROR",
            processingError: error.message 
          }
        });
        summary.errors++;
        const isNoTextError = error.message.includes("texto selecionável");
        if (isNoTextError) summary.noTextPdfs++;
      } finally {
        summary.materialsProcessed++;
      }
    }

    // 4. Atualizar cronograma
    if (summary.success > 0) {
      try {
        console.log("[ORGANIZE ALL] Atualizando cronograma...");
        await generateSmartSchedule(userId, {
          title: "Meu Cronograma de Estudos",
          dailyMinutes: 120,
          daysAhead: 30,
        });
        console.log("[ORGANIZE ALL] ✅ Cronograma atualizado.");
      } catch (schedErr: any) {
        console.error("[ORGANIZE ALL] Erro no cronograma:", schedErr.message);
      }
    }

    // 5. Mensagem de resultado
    const messageParts: string[] = [];
    if (summary.success > 0) {
      messageParts.push(`${summary.success} PDF(s) organizados`);
      if (summary.subjectsCreated > 0) messageParts.push(`${summary.subjectsCreated} matéria(s) criadas`);
      messageParts.push(`${summary.totalBlocks} blocos criados`);
      messageParts.push(`${summary.totalFlashcards} flashcards criados`);
    }
    if (summary.errors > 0) {
      const noText = summary.noTextPdfs > 0 ? ` (${summary.noTextPdfs} sem texto selecionável)` : "";
      messageParts.push(`${summary.errors} PDF(s) com erro${noText}`);
    }
    
    const message = summary.success > 0
      ? `Organização concluída! ${messageParts.join(" · ")}.`
      : `Não conseguimos organizar os materiais. ${messageParts.filter(p => p.includes("erro")).join(" · ")}.`;

    return NextResponse.json({
      message,
      results: {
        success: summary.success,
        errors: summary.errors,
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
