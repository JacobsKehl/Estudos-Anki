import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const cfcFiles = [
  { name: "1 - Direito Administrativo_compressed.pdf", folder: "CFC TRT4" },
  { name: "3 - Direito Constitucional.pdf", folder: "study-inbox" },
  { name: "Direito Processual Civil_compressed.pdf", folder: "study-inbox" },
  { name: "4 - Direito Processual do Trabalho.pdf", folder: "study-inbox" },
  { name: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4" }
];

async function main() {
  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";

  console.log("======================================================================================");
  console.log("    AFERIÇÃO DE DERIVA DE OFFSET: PRIMEIRA E ÚLTIMA PÁGINA (5 PDFS)                  ");
  console.log("======================================================================================\n");

  for (const f of cfcFiles) {
    let pdfPath = path.join(downloadsDir, f.folder, f.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "study-inbox", f.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "CFC TRT4", f.name);

    if (!fs.existsSync(pdfPath)) continue;

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;

    // Primeira página de conteúdo (geralmente pág 4 ou 5 física)
    let firstContentPage = 4;
    let lastContentPage = doc.numPages;

    const pFirst = await doc.getPage(firstContentPage);
    const textFirst = (await pFirst.getTextContent()).items.map((i: any) => i.str).join(" ");
    const matchFirst = textFirst.match(/\|\s*(\d{1,3})\b/);
    const printedFirst = matchFirst ? parseInt(matchFirst[1], 10) : null;
    const offsetFirst = printedFirst ? firstContentPage - printedFirst : null;

    const pLast = await doc.getPage(lastContentPage);
    const textLast = (await pLast.getTextContent()).items.map((i: any) => i.str).join(" ");
    const matchLast = textLast.match(/\|\s*(\d{1,3})\b/);
    const printedLast = matchLast ? parseInt(matchLast[1], 10) : null;
    const offsetLast = printedLast ? lastContentPage - printedLast : null;

    console.log(`📘 ARQUIVO: '${f.name}' (Total Págs PDF: ${doc.numPages})`);
    console.log(`   • PRIMEIRA PÁG CONTEÚDO (PDF p.${firstContentPage}): Impressa | ${printedFirst || '?'} ➔ Offset: +${offsetFirst}`);
    console.log(`   • ÚLTIMA PÁG CONTEÚDO (PDF p.${lastContentPage}): Impressa | ${printedLast || '?'} ➔ Offset: +${offsetLast}`);

    if (offsetFirst === offsetLast) {
      console.log(`   └ ✅ OFFSET UNIFORME DO INÍCIO AO FIM DO ARQUIVO (+${offsetFirst})\n`);
    } else {
      console.log(`   └ ⚠️ DERIVA DETECTADA! Início: +${offsetFirst} | Fim: +${offsetLast}\n`);
    }
  }
}

main().catch(console.error);
