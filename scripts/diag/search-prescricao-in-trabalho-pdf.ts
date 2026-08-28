import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";
  let pdfPath = path.join(downloadsDir, "CFC TRT4", "2 - Direito do Trabalho.pdf");
  if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "study-inbox", "2 - Direito do Trabalho.pdf");

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;

  console.log(`Buscando a palavra 'PRESCRIÇÃO' em todas as ${doc.numPages} páginas de '2 - Direito do Trabalho.pdf':\n`);

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const rawText = (textContent.items as any[]).map(item => item.str).join(" ");
    if (rawText.toLowerCase().includes("prescrição") || rawText.toLowerCase().includes("prescricao")) {
      console.log(` • Página PDF ${i}: "${rawText.substring(0, 200)}..."`);
    }
  }
}

main().catch(console.error);
