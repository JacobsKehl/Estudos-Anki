import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function cleanHeader(rawText: string): string {
  return rawText.replace(/Direito\s+[\w\s]+\s+C\s+o\s+n\s+c\s+u\s+r\s+s\s+e\s+i\s+r\s+o[^\n|]+\|\s*\d+/gi, "").trim();
}

async function main() {
  console.log("======================================================================");
  console.log("    INSPEÇÃO APROFUNDADA: CONVENÇÕES COLETIVAS E PRESCRIÇÃO (P.24-28) ");
  console.log("======================================================================\n");

  // 1. Obter blocos do banco para Direito do Trabalho
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, theoryStatus, StudyMaterial:materialId(originalFileName)")
    .eq("userId", user!.id);

  const dtBlocks = (blocks || []).filter(b => (b as any).StudyMaterial?.originalFileName === "2 - Direito do Trabalho.pdf");
  dtBlocks.sort((a, b) => a.pageStart - b.pageStart);

  console.log("--- BLOCOS NO BANCO HOJE (DIREITO DO TRABALHO) ---");
  dtBlocks.forEach(b => {
    console.log(` • [${b.pageStart}–${b.pageEnd}] '${b.title}' (${b.estimatedStudyMinutes} min) | Status: ${b.theoryStatus}`);
  });

  // 2. Inspecionar páginas 24, 25, 26, 27, 28 no PDF físico
  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";
  let pdfPath = path.join(downloadsDir, "CFC TRT4", "2 - Direito do Trabalho.pdf");
  if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "study-inbox", "2 - Direito do Trabalho.pdf");

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;

  console.log("\n--- CONTEÚDO REAL PÁGINA POR PÁGINA NO PDF (ÍNDICE FÍSICO DO ARQUIVO) ---");
  for (let pNum of [24, 25, 26, 27, 28]) {
    const page = await doc.getPage(pNum);
    const textContent = await page.getTextContent();
    const rawText = (textContent.items as any[]).map(i => i.str).join(" ");
    const clean = cleanHeader(rawText);

    // Identificar rodapé impresso
    const match = rawText.match(/\|\s*(\d{1,3})\b/);
    const printedNum = match ? match[1] : "?";

    console.log(`\n• PÁGINA DO PDF: ${pNum} (Impressa | ${printedNum}):`);
    console.log(`  "${clean.substring(0, 350)}..."`);
  }
}

main().catch(console.error);
