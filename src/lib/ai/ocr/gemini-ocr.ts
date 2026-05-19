import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { callGeminiWithRetry } from "../utils/retry";

/**
 * Gemini-based PDF OCR with Chunking and Retry support
 */
export async function extractTextWithGeminiOCR(source: string | Buffer): Promise<{ pageNumber: number, text: string }[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não está configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  let dataBuffer: Buffer;
  if (typeof source === "string") {
    dataBuffer = fs.readFileSync(source);
  } else {
    dataBuffer = source;
  }

  const pdfDoc = await PDFDocument.load(dataBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  
  console.log(`🚀 Starting Chunked OCR for ${totalPages} pages (gemini-2.5-flash)...`);
  
  const allPages: { pageNumber: number, text: string }[] = [];
  const chunkSize = 5; // Reduzido para 5 páginas para diminuir carga e tokens

  for (let i = 0; i < totalPages; i += chunkSize) {
    if (i > 0) await new Promise(resolve => setTimeout(resolve, 2000));
    
    const start = i;
    const end = Math.min(i + chunkSize, totalPages);
    console.log(`  Processing chunk: pages ${start + 1} to ${end}...`);

    const chunkDoc = await PDFDocument.create();
    const pageIndices = Array.from({ length: end - start }, (_, k) => start + k);
    const copiedPages = await chunkDoc.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach(page => chunkDoc.addPage(page));
    
    const chunkBuffer = await chunkDoc.save();
    const base64Data = Buffer.from(chunkBuffer).toString("base64");

    const prompt = `
      Extraia o texto destas páginas do documento. Comece na página ${start + 1}.
      Retorne APENAS um JSON: [{ "pageNumber": n, "text": "..." }]
    `;

    let success = false;
    try {
      const result = await callGeminiWithRetry(() => model.generateContent([
        { inlineData: { data: base64Data, mimeType: "application/pdf" } },
        prompt
      ]), 4, 3000); // 4 retries, starting delay 3s since OCR is heavy

      const text = result.response.text();
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      
      if (Array.isArray(parsed)) {
        allPages.push(...parsed);
        success = true;
      }
    } catch (error: any) {
      console.error(`  Fatal error in chunk ${start + 1}-${end}:`, error.message);
    }

    if (!success) {
      for (let p = start + 1; p <= end; p++) {
        allPages.push({ pageNumber: p, text: `[Erro na extração: API indisponível após várias tentativas]` });
      }
    }
  }

  return allPages;
}
