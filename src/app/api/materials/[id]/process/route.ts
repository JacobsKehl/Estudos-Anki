import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { getMockUserId } from "@/lib/auth-mock";
import { PDFDocument } from "pdf-lib";
import { extractTextWithGeminiOCR } from "@/lib/ai/ocr/gemini-ocr";

// pdf2json para extração nativa robusta
const PDFParser = require("pdf2json");

/**
 * Função auxiliar para extrair texto de forma nativa usando pdf2json
 */
async function extractTextWithPdf2Json(source: Buffer): Promise<{ pageNumber: number, text: string }[]> {
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

    pdfParser.parseBuffer(source);
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

    // Na Nuvem, ignoramos o processamento de arquivos locais do Windows
    if (material.sourceType === "LOCAL_INBOX") {
       throw new Error("O processamento de arquivos locais não é suportado na Web. Por favor, faça o upload do arquivo novamente via botão 'Nuvem'.");
    }

    // Download from Supabase Storage
    const { data, error } = await supabase.storage.from('materials').download(material.sourcePath!);
    if (error) throw new Error(`Erro ao baixar do Storage: ${error.message}`);
    const dataBuffer = Buffer.from(await data.arrayBuffer());

    await prisma.studyMaterial.update({
      where: { id },
      data: { processingStatus: "PROCESSING", processingError: null } as any,
    });

    let finalPages: { pageNumber: number, text: string }[] = [];
    let totalPagesInDoc = 0;

    // 1. Contagem de páginas confiável via pdf-lib
    try {
      const pdfDoc = await PDFDocument.load(dataBuffer, { ignoreEncryption: true });
      totalPagesInDoc = pdfDoc.getPageCount();
      
      await prisma.studyMaterial.update({
        where: { id },
        data: { totalPages: totalPagesInDoc } as any,
      });
    } catch (countError: any) {
      console.warn("Erro ao contar páginas:", countError.message);
    }

    // 2. Extração Nativa Robusta (pdf2json)
    try {
      finalPages = await extractTextWithPdf2Json(dataBuffer);
    } catch (nativeError: any) {
      console.warn("Extração nativa falhou:", nativeError.message);
    }

    // 3. Decisão: Se a extração nativa foi pobre, ativa IA (OCR)
    const totalCharCount = finalPages.reduce((acc, p) => acc + p.text.length, 0);
    const averageCharsPerPage = finalPages.length > 0 ? totalCharCount / finalPages.length : 0;

    if (finalPages.length < (totalPagesInDoc * 0.1) || averageCharsPerPage < 200) {
      try {
        finalPages = await extractTextWithGeminiOCR(dataBuffer);
      } catch (ocrError: any) {
        throw new Error(`Extração de texto via OCR falhou. Motivo: ${ocrError.message}`);
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
