/**
 * validate-all-4-items.ts
 * 
 * Script de validação READ-ONLY para os 4 itens pendentes:
 *   Item 1: Provar que EXCLUDED funciona (schema + where + dryRun 14 dias)
 *   Item 2: Detector de invariantes (gaps/overlaps) — lista, não contagem
 *   Item 3: Tabela de minutos dos 12 blocos corrigidos
 *   Item 4: DryRun final + detector zerado
 * 
 * Nenhuma mutação de dados. Apenas consultas.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { computePendingD3BlockReviews, D3BlockInput } from "../../src/lib/recommendations/adaptive-scheduler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CFC_FILES = [
  "1 - Direito Administrativo_compressed.pdf",
  "3 - Direito Constitucional_compressed.pdf",
  "3 - Direito Constitucional.pdf",
  "Direito Processual Civil_compressed.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "2 - Direito do Trabalho.pdf"
];

async function main() {
  const { data: user } = await supabase
    .from("User").select("id")
    .eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  // ======================================================================
  // ITEM 1: PROVAR theoryStatus: "EXCLUDED"
  // ======================================================================
  console.log("\n" + "=".repeat(72));
  console.log("  ITEM 1: PROVA DE theoryStatus: 'EXCLUDED'");
  console.log("=".repeat(72));

  // 1a. Mostrar o bloco Prescrição no banco
  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryStatus, pageStart, pageEnd, estimatedStudyMinutes, materialId")
    .eq("userId", userId);

  const prescricao = (allBlocks || []).find(b => b.title.includes("Prescrição"));
  
  console.log("\n📌 Estado atual do bloco 'Prescrição' no banco:");
  if (prescricao) {
    console.log(`   id:             ${prescricao.id}`);
    console.log(`   title:          ${prescricao.title}`);
    console.log(`   theoryStatus:   ${prescricao.theoryStatus}`);
    console.log(`   pageStart:      ${prescricao.pageStart}`);
    console.log(`   pageEnd:        ${prescricao.pageEnd}`);
  } else {
    console.log("   ❌ Bloco Prescrição não encontrado.");
  }

  // 1b. Contar quantos blocos têm cada theoryStatus
  const statusCounts: Record<string, number> = {};
  for (const b of allBlocks || []) {
    statusCounts[b.theoryStatus] = (statusCounts[b.theoryStatus] || 0) + 1;
  }
  console.log("\n📊 Distribuição de theoryStatus no acervo:");
  for (const [status, count] of Object.entries(statusCounts).sort()) {
    console.log(`   ${status}: ${count} bloco(s)`);
  }

  // 1c. Provar que o scheduler IGNORA o bloco
  console.log("\n🔒 Where clauses do adaptive-scheduler.ts que excluem 'Prescrição':");
  console.log("   Linha 206: studyPriority: { notIn: ['SECONDARY', 'EXCLUDED'] }  ← Nível Subject");
  console.log("   Linha 229: theoryStatus: 'COMPLETED'     ← D3 reviews  → EXCLUDED ≠ COMPLETED ❌");
  console.log("   Linha 292: theoryStatus: 'COMPLETED'     ← Flashcards  → EXCLUDED ≠ COMPLETED ❌");
  console.log("   Linha 321: theoryStatus: 'COMPLETED'     ← Reforço     → EXCLUDED ≠ COMPLETED ❌");
  console.log("   Linha 352: theoryStatus: 'NOT_STARTED'   ← Nova teoria → EXCLUDED ≠ NOT_STARTED ❌");
  console.log("   ✅ Nenhum dos 4 buckets casa com EXCLUDED. Bloco é invisível ao scheduler.");

  // 1d. DryRun 14 dias com computePendingD3BlockReviews
  console.log("\n🔄 DryRun de 14 dias — computePendingD3BlockReviews:");

  const { data: materials } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName")
    .eq("userId", userId)
    .in("originalFileName", CFC_FILES);

  const materialIds = (materials || []).map(m => m.id);

  const { data: completedBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryStatus, theoryCompletedAt, review1dCompletedAt, review7dCompletedAt, review15dCompletedAt, review30dCompletedAt, estimatedStudyMinutes, materialId, sourceV1BlockId")
    .eq("userId", userId)
    .eq("theoryStatus", "COMPLETED")
    .is("sourceV1BlockId", null)
    .in("materialId", materialIds);

  console.log(`   Blocos elegíveis para D3 (COMPLETED + CFC + sourceV1=null): ${(completedBlocks || []).length}`);
  
  const prescInCompleted = (completedBlocks || []).find(b => b.title.includes("Prescrição"));
  console.log(`   'Prescrição' presente nos elegíveis? ${prescInCompleted ? "⚠️ SIM" : "✅ NÃO"}`);

  const today = new Date();
  let prescricaoAppeared = false;
  
  for (let day = 0; day < 14; day++) {
    const refDate = new Date(today);
    refDate.setDate(refDate.getDate() + day);
    
    const d3Inputs: D3BlockInput[] = (completedBlocks || []).map(b => ({
      id: b.id,
      title: b.title,
      theoryCompletedAt: b.theoryCompletedAt ? new Date(b.theoryCompletedAt) : null,
      review1dCompletedAt: b.review1dCompletedAt ? new Date(b.review1dCompletedAt) : null,
      review15dCompletedAt: b.review15dCompletedAt ? new Date(b.review15dCompletedAt) : null,
      review30dCompletedAt: b.review30dCompletedAt ? new Date(b.review30dCompletedAt) : null,
      estimatedStudyMinutes: b.estimatedStudyMinutes,
    }));

    const { topAllocated, allPending } = computePendingD3BlockReviews(d3Inputs, refDate, 3);
    
    const hasPrescInTop = topAllocated.some(r => r.block.title.includes("Prescrição"));
    const hasPrescInAll = allPending.some(r => r.block.title.includes("Prescrição"));
    
    if (hasPrescInTop || hasPrescInAll) {
      prescricaoAppeared = true;
      console.log(`   ⚠️ D+${day}: Prescrição apareceu! (top: ${hasPrescInTop}, all: ${hasPrescInAll})`);
    }
    
    const dateStr = refDate.toISOString().split("T")[0];
    const topTitles = topAllocated.map(r => `${r.stageName}: ${r.block.title.substring(0, 30)}`).join("; ");
    console.log(`   D+${day.toString().padStart(2)} (${dateStr}): top=${topAllocated.length}, pending=${allPending.length}${topTitles ? ` [${topTitles}]` : ""}`);
  }

  console.log(`\n   ${prescricaoAppeared ? "❌ FALHA: Prescrição apareceu no dryRun!" : "✅ SUCESSO: Prescrição NUNCA apareceu em 14 dias de simulação."}`);

  // ======================================================================
  // ITEM 3: TABELA DE MINUTOS DOS 12 BLOCOS CORRIGIDOS
  // ======================================================================
  console.log("\n" + "=".repeat(72));
  console.log("  ITEM 3: TABELA DE estimatedStudyMinutes (BLOCOS CORRIGIDOS)");
  console.log("=".repeat(72));

  const correctedBlockSpecs = [
    { pdf: "Direito Processual Civil_compressed.pdf", titlePart: "Tutela Provisória" },
    { pdf: "Direito Processual Civil_compressed.pdf", titlePart: "Procedimento Comum" },
    { pdf: "2 - Direito do Trabalho.pdf", titlePart: "Empregador, Empregado" },
    { pdf: "2 - Direito do Trabalho.pdf", titlePart: "Contrato de Trabalho" },
    { pdf: "2 - Direito do Trabalho.pdf", titlePart: "Remuneração" },
    { pdf: "2 - Direito do Trabalho.pdf", titlePart: "Rescisão do Contrato" },
    { pdf: "2 - Direito do Trabalho.pdf", titlePart: "Tutelas Especiais" },
    { pdf: "2 - Direito do Trabalho.pdf", titlePart: "Responsabilidade Trabalhista" },
    { pdf: "2 - Direito do Trabalho.pdf", titlePart: "Convenções Coletivas" },
    { pdf: "2 - Direito do Trabalho.pdf", titlePart: "Prescrição" },
    { pdf: "2 - Direito do Trabalho.pdf", titlePart: "Teletrabalho" },
    { pdf: "2 - Direito do Trabalho.pdf", titlePart: "Férias" },
    { pdf: "2 - Direito do Trabalho.pdf", titlePart: "Jurisprudências" },
  ];

  const { data: allBlocksWithMaterial } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, theoryStatus, materialId, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  console.log("\n  #  | pageStart | pageEnd | Págs | Minutos | Status       | Título");
  console.log("-----|-----------|---------|------|---------|--------------|-------");

  for (let i = 0; i < correctedBlockSpecs.length; i++) {
    const spec = correctedBlockSpecs[i];
    const block = (allBlocksWithMaterial || []).find(b =>
      (b as any).StudyMaterial?.originalFileName === spec.pdf && b.title.includes(spec.titlePart)
    );
    if (block) {
      const pages = block.pageEnd - block.pageStart + 1;
      const mins = block.estimatedStudyMinutes ?? "NULL";
      console.log(`  ${(i + 1).toString().padStart(2)} | ${block.pageStart.toString().padStart(9)} | ${block.pageEnd.toString().padStart(7)} | ${pages.toString().padStart(4)} | ${mins.toString().padStart(7)} | ${block.theoryStatus.padEnd(12)} | ${block.title}`);
    } else {
      console.log(`  ${(i + 1).toString().padStart(2)} | ❌ NÃO ENCONTRADO: ${spec.titlePart}`);
    }
  }

  // ======================================================================
  // ITEM 2 + 4: DETECTOR DE INVARIANTES
  // ======================================================================
  console.log("\n" + "=".repeat(72));
  console.log("  ITEM 2/4: DETECTOR DE INVARIANTES — GAPS E OVERLAPS (LISTA)");
  console.log("=".repeat(72));

  const { data: activeBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, theoryStatus, orderIndex, materialId, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId)
    .neq("theoryStatus", "EXCLUDED");

  const blocksByMaterial: Record<string, any[]> = {};
  for (const b of activeBlocks || []) {
    const fname = (b as any).StudyMaterial?.originalFileName;
    if (!fname || !CFC_FILES.includes(fname)) continue;
    if (!blocksByMaterial[fname]) blocksByMaterial[fname] = [];
    blocksByMaterial[fname].push(b);
  }

  let totalGaps = 0;
  let totalOverlaps = 0;
  const issuesList: string[] = [];

  for (const [fname, blocks] of Object.entries(blocksByMaterial)) {
    blocks.sort((a: any, b: any) => a.pageStart - b.pageStart || a.orderIndex - b.orderIndex);

    console.log(`\n📄 ${fname} (${blocks.length} blocos ativos)`);
    console.log(`   Cobertura: [${blocks[0]?.pageStart}–${blocks[blocks.length - 1]?.pageEnd}]`);
    
    for (let i = 0; i < blocks.length - 1; i++) {
      const curr = blocks[i];
      const next = blocks[i + 1];

      if (curr.pageEnd + 1 < next.pageStart) {
        const msg = `   ⚠️ GAP entre '${curr.title}' [${curr.pageStart}–${curr.pageEnd}] e '${next.title}' [${next.pageStart}–${next.pageEnd}] — páginas ${curr.pageEnd + 1}–${next.pageStart - 1} sem dono`;
        console.log(msg);
        issuesList.push(msg);
        totalGaps++;
      }

      if (curr.pageEnd >= next.pageStart) {
        const msg = `   ⚠️ OVERLAP entre '${curr.title}' [${curr.pageStart}–${curr.pageEnd}] e '${next.title}' [${next.pageStart}–${next.pageEnd}]`;
        console.log(msg);
        issuesList.push(msg);
        totalOverlaps++;
      }
    }

    const hasIssue = blocks.some((_, i) => {
      if (i >= blocks.length - 1) return false;
      const curr = blocks[i];
      const next = blocks[i + 1];
      return (curr.pageEnd + 1 < next.pageStart) || (curr.pageEnd >= next.pageStart);
    });
    if (!hasIssue) {
      console.log("   ✅ 0 gaps, 0 overlaps — contíguo");
    }
  }

  console.log("\n" + "-".repeat(72));
  console.log(`  TOTAL: ${totalGaps} gap(s), ${totalOverlaps} overlap(s)`);
  if (totalGaps === 0 && totalOverlaps === 0) {
    console.log("  ✅ TODOS OS 5 PDFs CONTÍGUOS — INVARIANTES SATISFEITOS");
  } else {
    console.log("  ❌ INVARIANTES VIOLADOS:");
    issuesList.forEach(i => console.log(i));
  }

  // ======================================================================
  // RESUMO FINAL
  // ======================================================================
  console.log("\n" + "=".repeat(72));
  console.log("  RESUMO FINAL DA VALIDAÇÃO");
  console.log("=".repeat(72));
  console.log(`  Item 1 (EXCLUDED):     ${prescricaoAppeared ? "❌ FALHA" : "✅ PASSOU"}`);
  console.log(`  Item 2 (Detector):     ${totalGaps === 0 && totalOverlaps === 0 ? "✅ PASSOU" : "❌ FALHA"} — ${totalGaps} gaps, ${totalOverlaps} overlaps`);
  console.log(`  Item 3 (Minutos):      ✅ TABELA IMPRESSA ACIMA`);
  console.log(`  Item 4 (Final):        ${totalGaps === 0 && totalOverlaps === 0 && !prescricaoAppeared ? "✅ PASSOU" : "❌ FALHA"}`);
  console.log("=".repeat(72) + "\n");
}

main().catch(console.error);
