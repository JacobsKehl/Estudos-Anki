import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const cfcMaterialsInfo = [
  { name: "1 - Direito Administrativo_compressed.pdf", folder: "CFC TRT4" },
  { name: "3 - Direito Constitucional.pdf", folder: "study-inbox" },
  { name: "Direito Processual Civil_compressed.pdf", folder: "study-inbox" },
  { name: "4 - Direito Processual do Trabalho.pdf", folder: "study-inbox" },
  { name: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4" }
];

function cleanHeaderFooter(rawText: string): string {
  // Remove linhas de cabeçalho padrão (ex: "Direito ... concurseiroforadacaixa.com.br | 18")
  return rawText.replace(/Direito\s+[\w\s]+\s+C\s+o\s+n\s+c\s+u\s+r\s+s\s+e\s+i\s+r\s+o[^\n|]+\|\s*\d+/gi, "").trim();
}

async function main() {
  console.log("======================================================================");
  console.log("    VARREDURA ROBUSTA DE FRONTEIRAS DESLOCADAS EM TODOS OS BLOCOS (5 PDFS) ");
  console.log("======================================================================\n");

  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, StudyMaterial:materialId(originalFileName)")
    .eq("userId", user!.id);

  let totalBlocksAudited = 0;
  let totalShiftedFound = 0;
  const shiftedResults: any[] = [];

  for (const m of cfcMaterialsInfo) {
    let pdfPath = path.join(downloadsDir, m.folder, m.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "study-inbox", m.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "CFC TRT4", m.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, m.name);

    if (!fs.existsSync(pdfPath)) {
      console.log(` ⚠️ Arquivo PDF não encontrado localmente: ${m.name}`);
      continue;
    }

    const matBlocks = (blocks || []).filter(b => (b as any).StudyMaterial?.originalFileName === m.name);
    matBlocks.sort((a, b) => a.pageStart - b.pageStart);

    console.log(`📘 AUDITANDO ${matBlocks.length} BLOCOS DE: '${m.name}'`);

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;

    for (let i = 0; i < matBlocks.length; i++) {
      const b = matBlocks[i];
      totalBlocksAudited++;

      const pageIndex = b.pageStart;
      if (pageIndex > doc.numPages) continue;

      const page = await doc.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const rawText = (textContent.items as any[]).map(item => item.str).join(" ");
      const cleanText = cleanHeaderFooter(rawText);
      const lowerClean = cleanText.toLowerCase();

      // Checar se o início do texto limpo contém palavras de conclusão de capítulos anteriores
      // (ex: Rito Sumário / PAD-RS no início de Licitações, ou Embargos no início de Prescrição)
      let isShifted = false;
      let reason = "";

      if (b.title.includes("Licitações") && (lowerClean.includes("rito sumário") || lowerClean.includes("pad-rs"))) {
        isShifted = true;
        reason = "Resíduo de PAD Rito Sumário no topo";
      } else if (b.title.includes("Prescrição") && lowerClean.includes("embargos de declaração")) {
        isShifted = true;
        reason = "Resíduo de Embargos de Declaração no topo";
      } else if (i > 0) {
        const prevBlock = matBlocks[i - 1];
        const prevTitleWords = prevBlock.title.split(" ").filter(w => w.length > 5);
        // Se a primeira linha limpa da página iniciar explicitamente com palavras marcantes do bloco anterior
        const firstLine = cleanText.substring(0, 80).toLowerCase();
        const matchesPrev = prevTitleWords.filter(w => firstLine.includes(w.toLowerCase()));
        if (matchesPrev.length >= 2 && !firstLine.includes(b.title.split(" ")[0].toLowerCase())) {
          isShifted = true;
          reason = `Primeira linha menciona palavras do bloco anterior: ${matchesPrev.join(", ")}`;
        }
      }

      if (isShifted) {
        totalShiftedFound++;
        shiftedResults.push({ pdf: m.name, block: b.title, pageStart: b.pageStart, reason });
        console.log(` 🔴 FRONTEIRA DESLOCADA: '${b.title}' (pág ${b.pageStart}) | Motivo: ${reason}`);
      } else {
        console.log(`  └ [OK] p.${b.pageStart}: '${b.title.substring(0, 45)}...' -> "${cleanText.substring(0, 60)}..."`);
      }
    }
    console.log();
  }

  console.log("======================================================================");
  console.log("    RESUMO COMPLETO DA VARREDURA NO ACERVO DOS 5 PDFS                ");
  console.log("======================================================================");
  console.log(` Total de Blocos Auditados: ${totalBlocksAudited}`);
  console.log(` Total de Fronteiras Deslocadas Encontradas: ${totalShiftedFound}`);
  console.log("======================================================================\n");
}

main().catch(console.error);
