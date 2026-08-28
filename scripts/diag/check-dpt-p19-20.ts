import fs from "fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const pdfPath = "C:\\Users\\henrique.kehl\\Downloads\\study-inbox\\4 - Direito Processual do Trabalho.pdf";
  if (!fs.existsSync(pdfPath)) return;

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  for (let pNum of [19, 20, 21]) {
    const page = await doc.getPage(pNum);
    const textContent = await page.getTextContent();
    const text = (textContent.items as any[]).map(i => i.str).join(" ");
    console.log(`--- PÁGINA ${pNum} ---`);
    console.log(`Top 250 chars:\n${text.substring(0, 250)}\n`);
  }
}

main();
