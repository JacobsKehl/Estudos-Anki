import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const cfcMaterialsInfo = [
  { name: "1 - Direito Administrativo_compressed.pdf", folder: "CFC TRT4" },
  { name: "3 - Direito Constitucional_compressed.pdf", folder: "study-inbox" },
  { name: "Direito Processual Civil_compressed.pdf", folder: "study-inbox" },
  { name: "4 - Direito Processual do Trabalho.pdf", folder: "study-inbox" },
  { name: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4" }
];

async function main() {
  console.log("======================================================================");
  console.log("    AUDITORIA SISTÊMICA NOS 5 PDFS: LACUNAS & FRONTEIRAS DESLOCADAS ");
  console.log("======================================================================\n");

  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";

  // Buscar todos os blocos do usuário
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, materialId, StudyMaterial:materialId(originalFileName)")
    .eq("userId", user!.id);

  let totalGapsFound = 0;
  let totalOverlapsFound = 0;
  let totalShiftedBoundariesFound = 0;

  for (const matInfo of cfcMaterialsInfo) {
    console.log(`\n======================================================================`);
    console.log(` 📘 AUDITANDO PDF: '${matInfo.name}'`);
    console.log(`======================================================================`);

    const matBlocks = (allBlocks || []).filter(
      b => (b as any).StudyMaterial?.originalFileName === matInfo.name
    );

    if (matBlocks.length === 0) {
      console.log(` ⚠️ Nenhum bloco encontrado no banco para este material.`);
      continue;
    }

    // Ordenar por pageStart
    matBlocks.sort((a, b) => a.pageStart - b.pageStart);

    console.log(`Total de blocos no banco: ${matBlocks.length}`);
    const minPage = matBlocks[0].pageStart;
    const maxPage = matBlocks[matBlocks.length - 1].pageEnd;
    console.log(`Mapeamento de páginas no banco: p.${minPage} até p.${maxPage}\n`);

    // 1. Checar Lacunas e Sobreposições
    const pageCoveredMap = new Map<number, string[]>();
    for (const b of matBlocks) {
      for (let p = b.pageStart; p <= b.pageEnd; p++) {
        if (!pageCoveredMap.has(p)) pageCoveredMap.set(p, []);
        pageCoveredMap.get(p)!.push(b.title);
      }
    }

    const gaps: number[] = [];
    const overlaps: { page: number; blocks: string[] }[] = [];

    for (let p = minPage; p <= maxPage; p++) {
      const cov = pageCoveredMap.get(p) || [];
      if (cov.length === 0) gaps.push(p);
      else if (cov.length > 1) overlaps.push({ page: p, blocks: cov });
    }

    console.log(`--- 1. CHECAGEM DE INVARIANTE (LACUNAS E SOBREPOSIÇÕES) ---`);
    if (gaps.length === 0) {
      console.log(` ✅ 0 Lacunas encontradas (cobertura 100% contínua).`);
    } else {
      console.log(` 🔴 LACUNAS ENCONTRADAS: Páginas ${gaps.join(", ")} estão sem bloco!`);
      totalGapsFound += gaps.length;
    }

    if (overlaps.length === 0) {
      console.log(` ✅ 0 Sobreposições encontradas.`);
    } else {
      console.log(` 🔴 SOBREPOSIÇÕES ENCONTRADAS: ${overlaps.length} páginas com múltiplos blocos.`);
      totalOverlapsFound += overlaps.length;
    }

    // 2. Checar Fronteiras Deslocadas (Shifted Boundaries) via leitura do PDF
    // Localizar arquivo físico
    let pdfPath = path.join(downloadsDir, "study-inbox", matInfo.name);
    if (!fs.existsSync(pdfPath)) {
      pdfPath = path.join(downloadsDir, "CFC TRT4", matInfo.name);
    }
    if (!fs.existsSync(pdfPath)) {
      pdfPath = path.join(downloadsDir, matInfo.name);
    }

    if (fs.existsSync(pdfPath)) {
      const data = new Uint8Array(fs.readFileSync(pdfPath));
      const loadingTask = pdfjs.getDocument({ data });
      const doc = await loadingTask.promise;

      console.log(`\n--- 2. CHECAGEM DE FRONTEIRA DESLOCADA (PDF REAL) ---`);
      for (let i = 1; i < matBlocks.length; i++) {
        const prevB = matBlocks[i - 1];
        const currB = matBlocks[i];
        const pageNum = currB.pageStart;

        if (pageNum <= doc.numPages) {
          const page = await doc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = (textContent.items as any[]).map(item => item.str).join(" ");

          // Procurar se a primeira página do novo bloco contém resíduos de fim de capítulo anterior
          const hasPrevResidual = /^(Fim|Conclusão|Exercícios|Gabarito|Rito Sumário|PAD-RS)\b/i.test(pageText.trim()) ||
                                  (pageText.length < 300 && !pageText.toLowerCase().includes(currB.title.toLowerCase().substring(0, 10)));

          console.log(` • Bloco '${currB.title.substring(0, 45)}...' (Pág Start: ${currB.pageStart})`);
          console.log(`   └ Topo da Pág ${currB.pageStart}: "${pageText.substring(0, 110)}..."`);
        }
      }
    } else {
      console.log(` ⚠️ Arquivo PDF não encontrado localmente para verificação de layout.`);
    }
  }

  console.log(`\n======================================================================`);
  console.log(`  RESUMO DA AUDITORIA SISTÊMICA NOS 5 PDFS`);
  console.log(`======================================================================`);
  console.log(` Total de Lacunas Encontradas: ${totalGapsFound}`);
  console.log(` Total de Sobreposições Encontradas: ${totalOverlapsFound}`);
  console.log(`======================================================================`);
}

main().catch(console.error);
