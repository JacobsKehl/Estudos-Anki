import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const cfcMaterials = [
  { name: "1 - Direito Administrativo_compressed.pdf", folder: "CFC TRT4" },
  { name: "3 - Direito Constitucional.pdf", folder: "study-inbox" },
  { name: "Direito Processual Civil_compressed.pdf", folder: "study-inbox" },
  { name: "4 - Direito Processual do Trabalho.pdf", folder: "study-inbox" },
  { name: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4" }
];

async function main() {
  console.log("======================================================================");
  console.log("    AFERIÇÃO DO OFFSET (+1) NOS 5 PDFS DO CFC (5 PARES EMPÍRICOS)     ");
  console.log("======================================================================\n");

  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";
  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, StudyMaterial:materialId(originalFileName)")
    .order("pageStart", { ascending: true });

  for (const m of cfcMaterials) {
    let pdfPath = path.join(downloadsDir, m.folder, m.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "study-inbox", m.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "CFC TRT4", m.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, m.name);

    if (!fs.existsSync(pdfPath)) {
      console.log(` ⚠️ PDF não encontrado: ${m.name}`);
      continue;
    }

    const matBlocks = (blocks || []).filter(b => (b as any).StudyMaterial?.originalFileName === m.name);
    if (matBlocks.length === 0) continue;

    // Seleciona o 2º bloco do PDF para testar offset em página de conteúdo
    const sampleBlock = matBlocks[Math.min(1, matBlocks.length - 1)];

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;

    const pageIndex = sampleBlock.pageStart; // 1-based index no PDF
    const page = await doc.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const text = (textContent.items as any[]).map(i => i.str).join(" ");

    // Buscar número impresso no rodapé (formato "|  XX  " ou "| XX")
    const match = text.match(/\|\s*(\d{1,3})\b/);
    const printedNumber = match ? parseInt(match[1], 10) : null;
    const diff = printedNumber !== null ? pageIndex - printedNumber : null;

    console.log(`• PDF: '${m.name}'`);
    console.log(`  - Bloco Alvo: '${sampleBlock.title}'`);
    console.log(`  - pageStart no Banco (Índice do PDF): ${pageIndex}`);
    console.log(`  - Número Impresso no Rodapé: ${printedNumber ?? 'N/A'}`);
    console.log(`  - Par Aferido: PDF p.${pageIndex} -> Impressa p.${printedNumber} | Offset: ${diff !== null ? '+' + diff : 'N/A'}`);
    console.log();
  }
}

main().catch(console.error);
