import fs from "fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const pdfPath = "C:\\Users\\henrique.kehl\\Downloads\\CFC TRT4\\1 - Direito Administrativo_compressed.pdf";
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF não encontrado em:", pdfPath);
    return;
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  console.log(`======================================================================`);
  console.log(`        INSPEÇÃO DETALHADA DAS PÁGINAS 89 A 94 (PÁGINAS DE INÍCIO)    `);
  console.log(`======================================================================\n`);

  for (let pageNum = 89; pageNum <= 94; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];
    const pageText = items.map(item => item.str).join(" ");

    console.log(`--- PÁGINA ${pageNum} (PDF p.${pageNum}) ---`);
    console.log(`Conteúdo (amostra inicial):\n${pageText.substring(0, 350)}\n`);
  }
}

main().catch(console.error);
