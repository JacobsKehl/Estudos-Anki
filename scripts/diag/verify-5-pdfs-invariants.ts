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

async function main() {
  console.log("======================================================================");
  console.log("    AFERIÇÃO COMPLETA DE INVARIANTES (LACUNAS E SOBREPOSIÇÕES - 5 PDFS) ");
  console.log("======================================================================\n");

  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, StudyMaterial:materialId(originalFileName)")
    .eq("userId", user!.id);

  let totalGaps = 0;
  let totalOverlaps = 0;

  for (const m of cfcMaterialsInfo) {
    let pdfPath = path.join(downloadsDir, m.folder, m.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "study-inbox", m.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "CFC TRT4", m.name);

    const matBlocks = (blocks || []).filter(b => (b as any).StudyMaterial?.originalFileName === m.name);
    matBlocks.sort((a, b) => a.pageStart - b.pageStart);

    console.log(`📘 VERIFICANDO ${matBlocks.length} BLOCOS DE: '${m.name}'`);

    let gapsCount = 0;
    let overlapCount = 0;

    for (let i = 0; i < matBlocks.length - 1; i++) {
      const curr = matBlocks[i];
      const next = matBlocks[i + 1];

      if (curr.pageEnd + 1 < next.pageStart) {
        gapsCount++;
        totalGaps++;
        console.log(` 🔴 LACUNA DECTETADA entre '${curr.title}' [${curr.pageStart}–${curr.pageEnd}] e '${next.title}' [${next.pageStart}–${next.pageEnd}] (Faltam páginas ${curr.pageEnd + 1}..${next.pageStart - 1})`);
      } else if (curr.pageEnd >= next.pageStart) {
        // Se pageEnd de curr for igual ao pageStart do próximo (ex: 27 e 27 no sub-item de Prescrição no art 611-B), verificar se há sobreposição real de mais de 1 pág
        if (curr.pageEnd > next.pageStart) {
          overlapCount++;
          totalOverlaps++;
          console.log(` 🔴 SOBREPOSIÇÃO DETECTADA entre '${curr.title}' [${curr.pageStart}–${curr.pageEnd}] e '${next.title}' [${next.pageStart}–${next.pageEnd}]`);
        }
      }
    }

    if (gapsCount === 0 && overlapCount === 0) {
      console.log(`  └ ✅ 0 LACUNAS | 0 SOBREPOSIÇÕES (Sequência 100% contígua e perfeita)\n`);
    } else {
      console.log(`  └ ⚠️ Lacunas: ${gapsCount} | Sobreposições: ${overlapCount}\n`);
    }
  }

  console.log("======================================================================");
  console.log("    RESUMO DE INVARIANTES EM TODOS OS 5 PDFS                         ");
  console.log("======================================================================");
  console.log(` Total de Lacunas Encontradas: ${totalGaps}`);
  console.log(` Total de Sobreposições Encontradas: ${totalOverlaps}`);
  console.log("======================================================================\n");
}

main().catch(console.error);
