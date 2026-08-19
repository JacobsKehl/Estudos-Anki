import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const candidates = [
  { pdf: "Direito Processual Civil_compressed.pdf", folder: "study-inbox", page: 34, title: "Procedimento Comum" },
  { pdf: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4", page: 7, title: "Contrato de Trabalho" },
  { pdf: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4", page: 11, title: "Remuneração" },
  { pdf: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4", page: 22, title: "Tutelas Especiais" },
  { pdf: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4", page: 25, title: "Convenções Coletivas" },
  { pdf: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4", page: 26, title: "Prescrição" }
];

async function main() {
  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";

  for (const c of candidates) {
    let pdfPath = path.join(downloadsDir, c.folder, c.pdfFile || c.pdf);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "study-inbox", c.pdf);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "CFC TRT4", c.pdf);

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(c.page);
    const textContent = await page.getTextContent();
    const rawText = (textContent.items as any[]).map(i => i.str).join(" ");
    
    // Remove header
    const clean = rawText.replace(/Direito\s+[\w\s]+\s+C\s+o\s+n\s+c\s+u\s+r\s+s\s+e\s+i\s+r\s+o[^\n|]+\|\s*\d+/gi, "").trim();

    console.log(`======================================================================`);
    console.log(`📌 PDF: '${c.pdf}' | Bloco: '${c.title}' | Pág Física: ${c.page}`);
    console.log(`   Texto da Pág (primeiros 300 chars):\n   "${clean.substring(0, 300)}..."`);
    console.log();
  }
}

main().catch(console.error);
