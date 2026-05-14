/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
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

async function extractAllPages(filePath: string): Promise<{ pages: PageContent[]; numPages: number }> {
  const pdfjsLib = await getPdfjsLib();
  const fileBuffer = fs.readFileSync(filePath);
  const uint8Array = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);

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
    const text = textContent.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    pages.push({ pageNumber: i, text });
  }

  return { pages, numPages };
}

// ─── Pipeline por material ─────────────────────────────────────────────────────

async function processMaterial(material: any, userId: string) {
  const log = (msg: string) => console.log(`[ORGANIZE] ${material.fileName}: ${msg}`);
  const result = { blocks: 0, flashcards: 0, subjectCreated: false };

  if (!material.sourcePath || !fs.existsSync(material.sourcePath)) {
    throw new Error("Arquivo local não encontrado no disco.");
  }
  if (fs.statSync(material.sourcePath).size === 0) {
    throw new Error("O arquivo PDF está vazio (0 bytes).");
  }

  // ── Etapa 1: Extraindo texto por página ──────────────────────────────────
  log(`[Organize] PDF iniciado: ${material.fileName}`);

  await prisma.studyMaterial.update({
    where: { id: material.id },
    data: { organizationStatus: "EXTRACTING" }
  });

  log("Extraindo texto por página...");
  const { pages, numPages } = await extractAllPages(material.sourcePath);
  log(`[Organize] Texto extraído: ${numPages} páginas`);

  const nonEmptyPages = pages.filter(p => p.text.length > 10);
  if (nonEmptyPages.length === 0) {
    throw new Error(
      "Este PDF não possui texto selecionável. OCR ainda não está disponível."
    );
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
  
  if (!subjectId) {
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
        select: { id: true, name: true }
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

  log("Salvando conteúdo extraído...");

  // Remover conteúdo antigo do mesmo material (re-extração limpa)
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
    estimatedStudyMinutes: 0, // Ajustado para número válido
  }));

  await prisma.extractedContent.createMany({ data: contentRecords });
  log(`${contentRecords.length} páginas salvas em ExtractedContent.`);

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

  // ── Etapa 5: Criar StudyBlocks e gerar flashcards ───────────────────────

  await prisma.studyMaterial.update({
    where: { id: material.id },
    data: { organizationStatus: "GENERATING_FLASHCARDS" }
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

    // Buscar texto das páginas deste bloco
    const blockPages = pages.filter(
      p => p.pageNumber >= pageStart && p.pageNumber <= pageEnd && p.text.length > 10
    );
    const blockText = blockPages.map(p => p.text).join("\n");

    if (blockText.trim().length < 50) {
      log(`Bloco "${studyBlock.title}": texto insuficiente, pulando flashcards.`);
      continue;
    }

    // Gerar flashcards com IA (Apenas se o bloco for confiável/temático)
    if (studyBlock.confidence && studyBlock.confidence < 0.5) {
      log(`Bloco "${studyBlock.title}": baixa confiança (fallback), pulando geração de flashcards.`);
      continue;
    }

    try {
      const charCount = blockText.trim().length;
      log(`[Flashcards] Iniciando geração para blockId=${studyBlock.id}`);
      log(`[Flashcards] Texto do bloco: ${charCount} caracteres`);
      
      log(`[Flashcards] Chamando Gemini...`);
      const cards = await generateFlashcards(blockText.substring(0, 6000));
      log(`[Flashcards] Gemini retornou: ${cards.length} cards`);

      if (cards.length > 0) {
        // Inicializar campos SRS como NULL para pending cards conforme solicitado
        const flashcardsData = cards.map(card => ({
          userId,
          subjectId: subjectId as string,
          materialId: material.id,
          studyBlockId: studyBlock.id,
          question: card.question,
          answer: card.answer,
          type: card.type,
          difficulty: card.difficulty,
          status: "APPROVED",
          reviewState: "NEW",       
          nextReviewAt: new Date(),      
          approvedAt: new Date(),        
          learningStep: 0,
          easeFactor: 2.5,
          intervalDays: 0,
          repetitionCount: 0,
          lapseCount: 0,
          sourcePageStart: pageStart,
          sourcePageEnd: pageEnd,
        }));

        const createResult = await prisma.flashcard.createMany({
          data: flashcardsData
        });

        result.flashcards += createResult.count;
        log(`[Flashcards] Cards salvos no banco: ${createResult.count}`);
        
        // Atualizar status do bloco
        await prisma.studyBlock.update({
          where: { id: studyBlock.id },
          data: { 
            flashcardsStatus: "GENERATED",
            flashcardsGeneratedAt: new Date()
          }
        });
      } else {
        log(`[Flashcards] ⚠️ Nenhum card retornado para "${studyBlock.title}".`);
      }
    } catch (flashErr: any) {
      log(`[Flashcards] ❌ Erro ao gerar cards para blockId=${studyBlock.id}: ${flashErr.message}`);
    }
  }

  log(`[Organize] Total de flashcards salvos: ${result.flashcards}`);

  // ── Etapa 6: Finalizar ───────────────────────────────────────────────────

  await prisma.studyMaterial.update({
    where: { id: material.id },
    data: {
      organizationStatus: "ORGANIZED",
      detectedStructure: JSON.stringify(detectedBlocks),
      totalPages: numPages
    }
  });

  log(`✅ Concluído: ${result.blocks} blocos, ${result.flashcards} flashcards.`);
  return result;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Usuário real
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { name: "Usuário Dev", email: "dev@kehl.study" }
      });
    }
    const userId = user.id;
    console.log(`[ORGANIZE ALL] Iniciando para: ${userId}`);

    // 2. Materiais não organizados (até 1 por chamada para não dar timeout)
    const unorganizedMaterials = await prisma.studyMaterial.findMany({
      where: {
        userId,
        organizationStatus: { in: ["IMPORTED", "UPLOADED", "NEW", "EXTRACTING", "ANALYZING", "GENERATING_FLASHCARDS"] as any },
        sourceType: "LOCAL_INBOX"
      },
      take: 1
    });

    console.log(`[ORGANIZE ALL] ${unorganizedMaterials.length} materiais encontrados.`);

    if (unorganizedMaterials.length === 0) {
      return NextResponse.json({
        message: "Nenhum material pendente de organização encontrado.",
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
    for (const material of unorganizedMaterials) {
      try {
        const result = await processMaterial(material, userId);
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

    // 5. Mensagem de resultado realista
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
