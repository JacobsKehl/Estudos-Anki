import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("    VERIFICAÇÃO DA CONVENÇÃO DE pageStart / pageEnd NO BANCO DE DADOS  ");
  console.log("======================================================================\n");

  // 1. Procurar o bloco anterior ao de Licitações em Direito Administrativo
  const { data: admBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, StudyMaterial:materialId(originalFileName)")
    .order("pageStart", { ascending: true });

  const cfcAdmBlocks = (admBlocks || []).filter(b => (b as any).StudyMaterial?.originalFileName === "1 - Direito Administrativo_compressed.pdf");

  console.log("--- BLOCOS DE DIREITO ADMINISTRATIVO NO BANCO (ORDENADOS POR PAGESTART) ---");
  cfcAdmBlocks.forEach(b => {
    console.log(` • [${b.pageStart}–${b.pageEnd}] ${b.title} (ID: ${b.id})`);
  });

  // Identificar bloco anterior a Licitações (que termina perto de 88/89)
  const prevBlock = cfcAdmBlocks.find(b => b.pageEnd === 88 || (b.pageStart < 90 && b.pageEnd >= 80));
  console.log("\n📌 Bloco imediatamente anterior a Licitações:");
  console.log(` - ID: ${prevBlock?.id}`);
  console.log(` - Título: '${prevBlock?.title}'`);
  console.log(` - Intervalo atual: ${prevBlock?.pageStart}–${prevBlock?.pageEnd}`);

  // 2. Testar convenção de pageStart/pageEnd em 3 blocos intocados do CFC
  const sampleBlocks = (admBlocks || []).filter(b => [
    "Dos Direitos e Garantias Fundamentais",
    "Agentes Públicos",
    "Recursos Trabalhistas"
  ].some(t => b.title.includes(t))).slice(0, 3);

  const pdfPath = "C:\\Users\\henrique.kehl\\Downloads\\CFC TRT4\\1 - Direito Administrativo_compressed.pdf";
  if (fs.existsSync(pdfPath)) {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjs.getDocument({ data });
    const doc = await loadingTask.promise;

    console.log("\n--- TESTE DE CONVENÇÃO (PÁGINA DO PDF VS NUMERAÇÃO IMPRESSA) ---");
    for (const b of cfcAdmBlocks.slice(0, 3)) {
      const pageIndex = b.pageStart; // Testa pageStart como índice do PDF (1-based)
      if (pageIndex <= doc.numPages) {
        const page = await doc.getPage(pageIndex);
        const textContent = await page.getTextContent();
        const text = (textContent.items as any[]).map(i => i.str).join(" ");
        
        // Procurar por número impresso no rodapé (geralmente isolado no texto ou perto de bordas)
        const matches = text.match(/\b\d{1,3}\b/g) || [];
        console.log(`\n• Bloco no Banco: '${b.title}' | pageStart = ${b.pageStart}`);
        console.log(`  - Abrindo PDF na página física (índice 1-based) = ${pageIndex}:`);
        console.log(`  - Trecho do topo: "${text.substring(0, 140)}..."`);
      }
    }
  }
}

main().catch(console.error);
