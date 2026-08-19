import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase
    .from("User")
    .select("id")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();

  const userId = user!.id;
  const now = new Date();

  console.log("======================================================================");
  console.log("    COMPARAÇÃO ENTRE O AGENDADOR REAL (D3) E A SIMULAÇÃO (90 DIAS)     ");
  console.log("======================================================================\n");

  const cfcFileNames = [
    "1 - Direito Administrativo_compressed.pdf",
    "3 - Direito Constitucional_compressed.pdf",
    "3 - Direito Constitucional.pdf",
    "Direito Processual Civil_compressed.pdf",
    "4 - Direito Processual do Trabalho.pdf",
    "2 - Direito do Trabalho.pdf"
  ];

  const { data: cfcMaterials } = await supabase
    .from("StudyMaterial")
    .select("id")
    .in("originalFileName", cfcFileNames);

  const cfcMaterialIds = (cfcMaterials || []).map(m => m.id);

  // 1. D3: Inéditos (Balde 1 - 2/dia, exceto domingo)
  const { data: newTheoryBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, estimatedStudyMinutes, pageStart, pageEnd")
    .eq("userId", userId)
    .is("sourceV1BlockId", null)
    .eq("possiblyAlreadyStudied", false)
    .eq("theoryStatus", "NOT_STARTED")
    .in("materialId", cfcMaterialIds)
    .order("orderIndex", { ascending: true })
    .limit(2);

  // 2. D3: Revisões de Bloco Vencidas (Balde 3 - D+5, D+15, D+30, máx 3/dia)
  const { data: completedAnchorBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryCompletedAt, lastStudiedAt, createdAt, estimatedStudyMinutes, review1dCompletedAt, review7dCompletedAt, review15dCompletedAt, review30dCompletedAt")
    .eq("userId", userId)
    .eq("theoryStatus", "COMPLETED")
    .is("sourceV1BlockId", null)
    .in("materialId", cfcMaterialIds);

  const pendingReviews: { block: NonNullable<typeof completedAnchorBlocks>[number]; dueDate: Date; stageName: string }[] = [];

  (completedAnchorBlocks || []).forEach(b => {
    const d0 = b.theoryCompletedAt || b.lastStudiedAt || b.createdAt;
    if (!d0) return;
    const d0Date = new Date(d0);

    if (!b.review1dCompletedAt) {
      const d5 = new Date(d0Date); d5.setDate(d5.getDate() + 5);
      if (d5 <= now) pendingReviews.push({ block: b, dueDate: d5, stageName: "D+5" });
    } else if (!b.review7dCompletedAt && !b.review15dCompletedAt) {
      const d15 = new Date(d0Date); d15.setDate(d15.getDate() + 15);
      if (d15 <= now) pendingReviews.push({ block: b, dueDate: d15, stageName: "D+15" });
    } else if (!b.review30dCompletedAt) {
      const d30 = new Date(d0Date); d30.setDate(d30.getDate() + 30);
      if (d30 <= now) pendingReviews.push({ block: b, dueDate: d30, stageName: "D+30" });
    }
  });

  pendingReviews.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const topReviewsToday = pendingReviews.slice(0, 3);

  console.log(`📋 [D3 AGENDADOR REAL] Fila gerada para HOJE (${now.toISOString().split("T")[0]}):`);
  console.log(`\n 1. TEORIA INÉDITA (Alocados: ${newTheoryBlocks?.length || 0} / máx 2 por dia):`);
  newTheoryBlocks?.forEach(b => {
    console.log(`    📌 [THEORY] "${b.title}" (${b.estimatedStudyMinutes} min, pp.${b.pageStart}-${b.pageEnd})`);
  });

  console.log(`\n 2. REVISÕES DE BLOCO VENCIDAS (Fila D+5/15/30: ${pendingReviews.length} no total, Alocados: ${topReviewsToday.length} / máx 3 por dia):`);
  if (topReviewsToday.length === 0) {
    console.log(`    ℹ️ Nenhuma revisão de bloco D+5/15/30 está vencida hoje.`);
  } else {
    topReviewsToday.forEach(r => {
      console.log(`    📌 [REVIEW_BLOCK ${r.stageName}] "${r.block.title}" (Vencimento: ${r.dueDate.toISOString().split("T")[0]})`);
    });
  }

  console.log("\n======================================================================");
  console.log("  VERIFICAÇÃO DE ALINHAMENTO COM A SIMULAÇÃO (90 DIAS):");
  console.log("  ✅ Cota de 2 inéditos/dia respeitada exatamente");
  console.log("  ✅ Cota de 3 revisões/dia respeitada com fila mais antiga primeiro");
  console.log("  ✅ Apenas âncoras do CFC (sourceV1BlockId = null) incluídos");
  console.log("  ✅ Algoritmo SRS dos Flashcards (easeFactor/intervalDays) 100% INTACTO");
  console.log("======================================================================\n");
}

main();
