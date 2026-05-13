import { createWorker } from "tesseract.js";
import fs from "fs";

/**
 * Local OCR Processor using Tesseract.js (Fallback)
 */
export async function extractTextWithLocalOCR(filePath: string): Promise<{ pageNumber: number, text: string }[]> {
  console.log("🛠️ Local OCR: Usando fallback Tesseract.js.");
  
  // No Node.js, o Tesseract tenta carregar workers locais. 
  // Em ambientes Next.js dev, isso é problemático.
  // Vamos apenas avisar que o OCR local não está disponível sem configuração adicional de binários.
  throw new Error("O processamento de imagem (OCR) local não está disponível neste ambiente. Por favor, verifique sua chave Gemini API.");
}
