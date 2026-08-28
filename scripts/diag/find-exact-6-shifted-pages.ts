import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const shiftedCandidates = [
  { 
    id: "proc_civil_proc_comum",
    pdf: "Direito Processual Civil_compressed.pdf", 
    folder: "study-inbox", 
    blockTitle: "Procedimento Comum",
    dbPageStart: 34,
    dbPageEnd: 46
  },
  { 
    id: "dt_contrato_trabalho",
    pdf: "2 - Direito do Trabalho.pdf", 
    folder: "CFC TRT4", 
    blockTitle: "Contrato de Trabalho + Contratos Especiais de Trabalho",
    dbPageStart: 7,
    dbPageEnd: 10
  },
  { 
    id: "dt_remuneracao",
    pdf: "2 - Direito do Trabalho.pdf", 
    folder: "CFC TRT4", 
    blockTitle: "Remuneração",
    dbPageStart: 11,
    dbPageEnd: 13
  },
  { 
    id: "dt_tutelas_especiais",
    pdf: "2 - Direito do Trabalho.pdf", 
    folder: "CFC TRT4", 
    blockTitle: "Tutelas Especiais",
    dbPageStart: 22,
    dbPageEnd: 23
  },
  { 
    id: "dt_convencoes_coletivas",
    pdf: "2 - Direito do Trabalho.pdf", 
    folder: "CFC TRT4", 
    blockTitle: "Convenções Coletivas de Trabalho",
    dbPageStart: 25,
    dbPageEnd: 25
  },
  { 
    id: "dt_prescricao",
    pdf: "2 - Direito do Trabalho.pdf", 
    folder: "CFC TRT4", 
    blockTitle: "Prescrição",
    dbPageStart: 26,
    dbPageEnd: 26
  }
];

function cleanHeader(rawText: string): string {
  return rawText.replace(/Direito\s+[\w\s]+\s+C\s+o\s+n\s+c\s+u\s+r\s+s\s+e\s+i\s+r\s+o[^\n|]+\|\s*\d+/gi, "").trim();
}

async function main() {
  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";

  console.log("========================================================================================");
  console.log("    AFERIÇÃO EXATA DAS PÁGINAS FÍSICAS DOS 6 BLOCOS DESLOCADOS                          ");
  console.log("========================================================================================\n");

  for (const c of shiftedCandidates) {
    let pdfPath = path.join(downloadsDir, c.folder, c.pdf);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "study-inbox", c.pdf);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "CFC TRT4", c.pdf);

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;

    console.log(`📌 BLOCO: '${c.blockTitle}' (${c.pdf})`);
    console.log(`   ` + `Banco Hoje: [${c.dbPageStart}–${c.dbPageEnd}]`);

    // Inspecionar p. dbPageStart-1, dbPageStart, dbPageStart+1, dbPageStart+2
    for (let p = Math.max(1, c.dbPageStart - 1); p <= Math.min(doc.numPages, c.dbPageStart + 3); p++) {
      const page = await doc.getPage(p);
      const textContent = await page.getTextContent();
      const rawText = (textContent.items as any[]).map(i => i.str).join(" ");
      const clean = cleanHeader(rawText);
      const match = rawText.match(/\|\s*(\d{1,3})\b/);
      const printedNum = match ? match[1] : "?";

      console.log(`   └ PDF p.${p} (Impressa | ${printedNum}): "${clean.substring(0, 100)}..."`);
    }
    console.log();
  }
}

main().catch(console.error);
