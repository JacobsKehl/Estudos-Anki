import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";
  let pdfPath = path.join(downloadsDir, "CFC TRT4", "2 - Direito do Trabalho.pdf");
  if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "study-inbox", "2 - Direito do Trabalho.pdf");

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;

  for (let p of [2, 3, 4, 5]) {
    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();
    const rawText = (textContent.items as any[]).map(i => i.str).join("\n");
    console.log(`=== PÁGINA ${p} ===\n${rawText}\n`);
  }
}

main().catch(console.error);
