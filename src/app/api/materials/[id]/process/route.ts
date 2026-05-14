/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { extractTextWithGeminiOCR } from "@/lib/ai/ocr/gemini-ocr";
import { extractTextWithLocalOCR } from "@/lib/ai/ocr/local-ocr";

// pdf2json para extração nativa robusta (lida melhor com layouts complexos)
const PDFParser = require("pdf2json");

/**
 * Função auxiliar para extrair texto de forma nativa usando pdf2json
 */
async function extractTextWithPdf2Json(filePath: string): Promise<{ pageNumber: number, text: string }[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      const pages = pdfData.Pages.map((page: any, index: number) => {
        const text = page.Texts.map((t: any) => decodeURIComponent(t.R[0].T)).join(" ");
        return {
          pageNumber: index + 1,
          text: text.trim()
        };
      });
      resolve(pages);
    });

    pdfParser.loadPDF(filePath);
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mockUserId = await getMockUserId();

  try {
    const material = await prisma.studyMaterial.findUnique({ where: { id } });
    if (!material) return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });

    const projectRoot = process.cwd();
    let cleanFilePath = material.filePath;
    if (!cleanFilePath) throw new Error("Caminho do arquivo não encontrado.");
    
    if (cleanFilePath.startsWith("/")) cleanFilePath = cleanFilePath.substring(1);
    const fullPath = path.join(projectRoot, cleanFilePath.replace(/\//g, path.sep));

    await prisma.studyMaterial.update({
      where: { id },
      data: { processingStatus: "PROCESSING", processingError: null } as any,
    });

    let finalPages: { pageNumber: number, text: string }[] = [];
    let totalPagesInDoc = 0;

    // 1. Contagem de páginas confiável via pdf-lib
    try {
      const dataBuffer = fs.readFileSync(fullPath);
      const pdfDoc = await PDFDocument.load(dataBuffer, { ignoreEncryption: true });
      totalPagesInDoc = pdfDoc.getPageCount();
      
      await prisma.studyMaterial.update({
        where: { id },
        data: { totalPages: totalPagesInDoc } as any,
      });
      console.log(`📊 Páginas detectadas: ${totalPagesInDoc}`);
    } catch (countError: any) {
      console.warn("Erro ao contar páginas:", countError.message);
    }

    // 2. Extração Nativa Robusta (pdf2json)
    try {
      console.log("⚡ Iniciando extração nativa robusta (pdf2json)...");
      finalPages = await extractTextWithPdf2Json(fullPath);
      console.log(`✅ Extração nativa concluída. Páginas com texto: ${finalPages.length}/${totalPagesInDoc}`);
    } catch (nativeError: any) {
      console.warn("Extração nativa falhou:", nativeError.message);
    }

    // 3. Decisão: Se a extração nativa foi pobre, ativa IA (OCR)
    const totalCharCount = finalPages.reduce((acc, p) => acc + p.text.length, 0);
    const averageCharsPerPage = finalPages.length > 0 ? totalCharCount / finalPages.length : 0;

    if (finalPages.length < (totalPagesInDoc * 0.1) || averageCharsPerPage < 200) {
      console.log("🔍 PDF parece ser uma imagem ou extração nativa foi pobre. Ativando OCR via IA...");
      try {
        finalPages = await extractTextWithGeminiOCR(fullPath);
      } catch (ocrError: any) {
        console.error("Gemini OCR falhou:", ocrError.message);
        try {
          finalPages = await extractTextWithLocalOCR(fullPath);
        } catch (localError: any) {
           throw new Error(`Extração falhou. Motivo: ${ocrError.message}`);
        }
      }
    }

    if (finalPages.length === 0) throw new Error("Não foi possível extrair texto deste documento.");

    // Sincroniza com o Banco
    await prisma.$transaction([
      prisma.extractedContent.deleteMany({ where: { materialId: id } }),
      ...finalPages.map(page => prisma.extractedContent.create({
        data: {
          materialId: id,
          userId: mockUserId,
          subjectId: material.subjectId,
          pageNumber: page.pageNumber,
          text: page.text,
          orderIndex: page.pageNumber,
          title: `Página ${page.pageNumber}`,
        } as any
      }))
    ]);

    await prisma.studyMaterial.update({
      where: { id },
      data: {
        processingStatus: "PROCESSED",
        totalPages: totalPagesInDoc || finalPages.length,
      } as any,
    });

    console.log("✨ Sucesso! Documento processado.");
    return NextResponse.json({ message: "Sucesso" });
  } catch (error: any) {
    console.error("Erro no pipeline:", error.message);
    await prisma.studyMaterial.update({
      where: { id },
      data: { processingStatus: "ERROR", processingError: error.message } as any,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
