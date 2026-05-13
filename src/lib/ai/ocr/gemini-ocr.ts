import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { PDFDocument } from "pdf-lib";

/**
 * Gemini-based PDF OCR with Chunking and Retry support
 */
export async function extractTextWithGeminiOCR(filePath: string): Promise<{ pageNumber: number, text: string }[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não está configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);
  // Usando gemini-flash-latest para maior estabilidade nesta versão da API
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const dataBuffer = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(dataBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  
  console.log(`🚀 Starting Chunked OCR for ${totalPages} pages (gemini-flash-latest)...`);
  
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
    let retries = 3;

    while (!success && retries > 0) {
      try {
        const result = await model.generateContent([
          { inlineData: { data: base64Data, mimeType: "application/pdf" } },
          prompt
        ]);

        const text = result.response.text();
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        
        if (Array.isArray(parsed)) {
          allPages.push(...parsed);
          success = true;
        }
      } catch (error: any) {
        if (error.message.includes("503") || error.message.includes("429")) {
          console.log(`  Retry needed (503/429). Retries left: ${retries - 1}`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          retries--;
        } else {
          console.error(`  Fatal error in chunk ${start + 1}-${end}:`, error.message);
          break;
        }
      }
    }

    if (!success) {
      for (let p = start + 1; p <= end; p++) {
        allPages.push({ pageNumber: p, text: `[Erro na extração: API indisponível após várias tentativas]` });
      }
    }
  }

  return allPages;
}
