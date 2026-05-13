/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import { identifySubject, detectStructure } from "@/lib/ai/organizer";
import { generateSimpleSchedule } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max

interface DetectedBlock {
  title: string;
  description: string;
  pageStart: number;
  pageEnd: number;
  estimatedStudyMinutes: number;
  sourceHeading?: string;
}

// Carregado uma vez por módulo (cached após primeira chamada)
let pdfjsLibCache: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;

async function getPdfjsLib() {
  if (pdfjsLibCache) return pdfjsLibCache;
  const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Configurar workerSrc uma única vez — URL absoluta para o worker .mjs
  lib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).href;
  pdfjsLibCache = lib;
  return lib;
}

// Extrai texto de um PDF usando pdfjs-dist legacy (ESM, Node.js server)
async function extractTextFromPdf(filePath: string, maxPages = 15): Promise<{ text: string; numPages: number }> {
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
  const pagesToExtract = Math.min(maxPages, numPages);

  let fullText = "";

  for (let i = 1; i <= pagesToExtract; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }

  return { text: fullText, numPages };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Buscar usuário real
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { name: "Usuário Dev", email: "dev@kehl.study" }
      });
    }
    const userId = user.id;
    console.log(`[ORGANIZE ALL] Iniciando para usuário: ${userId}`);

    // 2. Buscar materiais importados que ainda não foram organizados
    const unorganizedMaterials = await prisma.studyMaterial.findMany({
      where: { 
        userId, 
        organizationStatus: { in: ["IMPORTED", "ANALYZING", "UPLOADED", "NEW"] },
        sourceType: "LOCAL_INBOX"
      },
      take: 5 // Limitar a 5 por chamada para evitar timeout
    });

    console.log(`[ORGANIZE ALL] Encontrados ${unorganizedMaterials.length} materiais.`);

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
      subjectsCreated: 0,
      materialsProcessed: unorganizedMaterials.length
    };

    // 3. Processar cada material
    for (const material of unorganizedMaterials) {
      console.log(`[ORGANIZE] Processando: ${material.fileName}`);
      try {
        if (!material.sourcePath || !fs.existsSync(material.sourcePath)) {
          throw new Error("Arquivo local não encontrado no disco.");
        }

        const stats = fs.statSync(material.sourcePath);
        if (stats.size === 0) {
          throw new Error("O arquivo PDF está vazio (0 bytes).");
        }

        // Marcar como analisando
        await prisma.studyMaterial.update({
          where: { id: material.id },
          data: { organizationStatus: "ANALYZING" }
        });

        // Extrair texto com pdfjs-dist
        console.log(`[ORGANIZE] Extraindo texto de ${material.fileName}...`);
        const { text: extractedText, numPages } = await extractTextFromPdf(material.sourcePath, 15);
        
        const sampleText = extractedText.substring(0, 10000);
        
        if (!sampleText || sampleText.trim().length < 20) {
          throw new Error("Não foi possível extrair texto deste PDF. Ele pode ser uma imagem escaneada (precisa de OCR) ou estar protegido.");
        }

        console.log(`[ORGANIZE] Texto extraído: ${sampleText.length} chars, ${numPages} páginas`);

        // 3a. Identificar Matéria (se não vinculada ainda)
        let subjectId = material.subjectId;
        if (!subjectId) {
          console.log(`[ORGANIZE] Identificando matéria para ${material.fileName}...`);
          const detectedSubject = await identifySubject(sampleText.substring(0, 3000), material.fileName);
          console.log(`[ORGANIZE] Matéria detectada: "${detectedSubject}"`);
          
          // Busca fuzzy: se o nome detectado contém ou é contido por algum existente
          let subject = await prisma.studySubject.findFirst({
            where: { 
              userId,
              name: { contains: detectedSubject }
            }
          });

          if (!subject) {
            // Verificar o inverso (nome existente contido no detectado)
            const allSubjects = await prisma.studySubject.findMany({ where: { userId }, select: { id: true, name: true } });
            subject = allSubjects.find(s => detectedSubject.includes(s.name)) ?? null;
          }

          if (!subject) {
            console.log(`[ORGANIZE] Criando nova matéria: ${detectedSubject}`);
            subject = await prisma.studySubject.create({
              data: { name: detectedSubject, userId, priority: 1 }
            });
            summary.subjectsCreated++;
          } else {
            console.log(`[ORGANIZE] Reutilizando matéria existente: ${subject.name}`);
          }
          
          subjectId = subject.id;
          await prisma.studyMaterial.update({
            where: { id: material.id },
            data: { subjectId, detectedSubjectName: detectedSubject }
          });
        }

        // 3b. Detectar Estrutura com IA
        console.log(`[ORGANIZE] Detectando estrutura para ${material.fileName}...`);
        const detectedBlocks: DetectedBlock[] = await detectStructure(sampleText);
        console.log(`[ORGANIZE] Blocos detectados: ${detectedBlocks?.length ?? 0}`);

        if (detectedBlocks && Array.isArray(detectedBlocks) && detectedBlocks.length > 0) {
          // Criar blocos sequencialmente
          for (let i = 0; i < detectedBlocks.length; i++) {
            const block = detectedBlocks[i];
            await prisma.studyBlock.create({
              data: {
                userId,
                subjectId: subjectId as string,
                materialId: material.id,
                title: block.title || `Parte ${i + 1}`,
                description: block.description || "",
                pageStart: block.pageStart || 1,
                pageEnd: block.pageEnd || block.pageStart || 1,
                orderIndex: i,
                estimatedStudyMinutes: block.estimatedStudyMinutes || 60,
                createdBy: "AI",
                sourceHeading: block.sourceHeading,
                status: "NOT_STARTED"
              }
            });
          }

          await prisma.studyMaterial.update({
            where: { id: material.id },
            data: {
              organizationStatus: "ORGANIZED",
              detectedStructure: JSON.stringify(detectedBlocks),
              totalPages: numPages
            }
          });

          summary.success++;
          summary.totalBlocks += detectedBlocks.length;
          console.log(`[ORGANIZE] ✅ Sucesso: ${material.fileName} (${detectedBlocks.length} blocos)`);
        } else {
          throw new Error("A IA não conseguiu identificar uma estrutura de capítulos ou tópicos válida neste material.");
        }

      } catch (err: any) {
        console.error(`[ORGANIZE ERROR] ${material.fileName}:`, err.message);
        summary.errors++;
        await prisma.studyMaterial.update({
          where: { id: material.id },
          data: { 
            organizationStatus: "ERROR",
            processingError: err.message
          }
        }).catch(() => {}); // não quebrar o loop por erro de update
      }
    }

    // 4. Atualizar Cronograma automaticamente
    let scheduleCreated = false;
    if (summary.success > 0) {
      try {
        console.log("[ORGANIZE] Gerando cronograma...");
        await generateSimpleSchedule(userId, {
          title: "Meu Cronograma de Estudos",
          dailyMinutes: 120,
          startDate: new Date()
        });
        scheduleCreated = true;
        console.log("[ORGANIZE] ✅ Cronograma criado.");
      } catch (schedErr: any) {
        console.error("[ORGANIZE] Erro ao criar cronograma:", schedErr.message);
      }
    }

    // 5. Retornar resposta detalhada
    let message: string;
    if (summary.success > 0 && summary.errors === 0) {
      message = `Organização concluída! ${summary.success} PDF(s) analisados, ${summary.subjectsCreated} matéria(s) criadas, ${summary.totalBlocks} blocos de estudo gerados.${scheduleCreated ? " Cronograma atualizado!" : ""}`;
    } else if (summary.success > 0 && summary.errors > 0) {
      message = `Organizamos ${summary.success} PDF(s), mas ${summary.errors} apresentou erro. ${summary.totalBlocks} blocos criados.`;
    } else {
      message = `Não conseguimos organizar os materiais. ${summary.errors} erro(s) encontrado(s). Verifique se os arquivos são PDFs com texto selecionável.`;
    }

    return NextResponse.json({ message, results: summary });

  } catch (error: any) {
    console.error("[FATAL] /api/materials/organize-all:", error);
    return NextResponse.json({ 
      error: "Erro interno no servidor ao processar organização", 
      details: error.message 
    }, { status: 500 });
  }
}
