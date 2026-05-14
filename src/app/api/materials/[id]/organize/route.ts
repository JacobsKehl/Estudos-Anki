/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import { identifySubject, detectStructure } from "@/lib/ai/organizer";

export const dynamic = "force-dynamic";

// Cache do pdfjs para não reconfigurar o worker a cada chamada
let pdfjsCache: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;

async function getPdfjsLib() {
  if (pdfjsCache) return pdfjsCache;
  const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  lib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).href;
  pdfjsCache = lib;
  return lib;
}

async function extractText(filePath: string, maxPages = 15): Promise<{ text: string; numPages: number }> {
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

  const doc = await loadingTask.promise;
  const numPages = doc.numPages;
  const pagesToRead = Math.min(maxPages, numPages);
  let text = "";

  for (let i = 1; i <= pagesToRead; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ") + "\n";
  }

  return { text, numPages };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Buscar o material e o usuário real
    const user = await prisma.user.findFirst();
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    const userId = user.id;

    const material = await prisma.studyMaterial.findFirst({
      where: { id, userId },
      include: { _count: { select: { studyBlocks: true } } }
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });
    }

    if (!material.sourcePath || !fs.existsSync(material.sourcePath)) {
      return NextResponse.json({ error: "Arquivo original não encontrado em disco" }, { status: 400 });
    }

    const stats = fs.statSync(material.sourcePath);
    if (stats.size === 0) {
      return NextResponse.json({ error: "O arquivo PDF está vazio (0 bytes)" }, { status: 400 });
    }

    // 2. Marcar como analisando
    await prisma.studyMaterial.update({
      where: { id },
      data: { organizationStatus: "ANALYZING" }
    });

    // 3. Extrair texto com pdfjs-dist
    const { text: extractedText, numPages } = await extractText(material.sourcePath, 15);

    if (!extractedText || extractedText.trim().length < 50) {
      await prisma.studyMaterial.update({ where: { id }, data: { organizationStatus: "ERROR", processingError: "Texto insuficiente" } });
      return NextResponse.json({
        error: "Não foi possível extrair texto deste PDF. Ele pode ser uma imagem escaneada ou estar protegido."
      }, { status: 400 });
    }

    // 4. Identificar matéria se não tiver
    let subjectId = material.subjectId;
    if (!subjectId) {
      const detectedSubject = await identifySubject(extractedText.substring(0, 3000), material.fileName);

      let subject = await prisma.studySubject.findFirst({
        where: { userId, name: { contains: detectedSubject } }
      });

      if (!subject) {
        const allSubjects = await prisma.studySubject.findMany({ where: { userId }, select: { id: true, name: true } });
        subject = allSubjects.find(s => detectedSubject.includes(s.name)) ?? null;
      }

      if (!subject) {
        subject = await prisma.studySubject.create({
          data: { name: detectedSubject, userId, priority: 1 }
        });
      }

      subjectId = subject.id;
      await prisma.studyMaterial.update({
        where: { id },
        data: { subjectId, detectedSubjectName: detectedSubject }
      });
    }

    // 5. Detectar estrutura com IA
    const detectedBlocks = await detectStructure(extractedText, numPages);

    if (!detectedBlocks || detectedBlocks.length === 0) {
      await prisma.studyMaterial.update({ where: { id }, data: { organizationStatus: "ERROR", processingError: "IA não detectou estrutura" } });
      return NextResponse.json({
        error: "Não conseguimos organizar este PDF. Nenhum bloco foi criado."
      }, { status: 400 });
    }

    // 6. Remover blocos antigos se existirem (Reorganização)
    await prisma.studyBlock.deleteMany({
      where: { materialId: material.id }
    });

    // 7. Criar blocos
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
          createdBy: block.createdBy || "AI",
          confidence: block.confidence ?? 1.0,
          sourceHeading: block.sourceHeading,
          status: "NOT_STARTED"
        }
      });
    }

    // 7. Atualizar status do material
    await prisma.studyMaterial.update({
      where: { id },
      data: {
        organizationStatus: "ORGANIZED",
        detectedStructure: JSON.stringify(detectedBlocks),
        totalPages: numPages
      }
    });

    return NextResponse.json({
      message: `${detectedBlocks.length} blocos de estudo criados com sucesso.`,
      blocksCount: detectedBlocks.length
    });

  } catch (error: any) {
    console.error("[ORGANIZE SINGLE] Erro:", error);
    await prisma.studyMaterial.update({
      where: { id },
      data: { organizationStatus: "ERROR", processingError: error.message }
    }).catch(() => {});
    return NextResponse.json({ error: "Falha ao organizar material", details: error.message }, { status: 500 });
  }
}
