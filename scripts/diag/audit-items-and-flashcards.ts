import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  console.log("=== AUDITORIA COMPLETA DE FLASHCARDS, SRS E BLOCOS DE HOJE ===\n");

  // 1. COUNT de StudyBlock criados hoje (27/08)
  const { data: blocksToday } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, theoryStatus, createdAt")
    .eq("userId", userId)
    .gte("createdAt", "2026-08-27T00:00:00-03:00")
    .order("createdAt", { ascending: true });

  console.log(`1. Total de StudyBlock com createdAt de HOJE (27/08): ${blocksToday?.length || 0} (esperado: 94)`);

  const activeToday = (blocksToday || []).filter(b => b.theoryStatus !== "EXCLUDED");
  const excludedToday = (blocksToday || []).filter(b => b.theoryStatus === "EXCLUDED");
  console.log(`   - Ativos de teoria: ${activeToday.length}`);
  console.log(`   - Excluded (TEC): ${excludedToday.length}\n`);

  // 2. COUNT de Flashcard cujo studyBlockId está nos 94 blocos novos
  const newBlockIds = (blocksToday || []).map(b => b.id);
  const { data: cardsOnNewBlocks } = await supabase
    .from("Flashcard")
    .select("id, studyBlockId, subjectId")
    .eq("userId", userId)
    .in("studyBlockId", newBlockIds);

  console.log(`2. Total de Flashcard associados aos 94 blocos NOVOS: ${cardsOnNewBlocks?.length || 0} (esperado: 0)`);

  // 3. Distribuição de todos os 1019 Flashcards por matéria
  const { data: allCards } = await supabase
    .from("Flashcard")
    .select("id, subjectId, state, nextReviewAt, StudySubject:subjectId(name)")
    .eq("userId", userId);

  const cardsBySubject: Record<string, { total: number; next7DaysReviews: number }> = {};

  const now = new Date();
  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);

  for (const card of allCards || []) {
    const subName = (card.StudySubject as any)?.name || "Sem Matéria";
    if (!cardsBySubject[subName]) cardsBySubject[subName] = { total: 0, next7DaysReviews: 0 };
    cardsBySubject[subName].total++;

    if (card.nextReviewAt) {
      const revDate = new Date(card.nextReviewAt);
      if (revDate <= next7Days) {
        cardsBySubject[subName].next7DaysReviews++;
      }
    }
  }

  console.log("\n3. Distribuição dos Flashcards e Revisões SRS por Matéria:");
  console.log("Matéria                         | Total Flashcards | Revisões Próximos 7 Dias");
  console.log("--------------------------------+------------------+-------------------------");
  for (const [sub, counts] of Object.entries(cardsBySubject)) {
    console.log(`${sub.padEnd(31)} | ${String(counts.total).padStart(16)} | ${String(counts.next7DaysReviews).padStart(23)}`);
  }

  // 4. Por que REVIEW_FLASHCARDS aparece como "Direito do Trabalho"
  console.log("\n4. Investigação do item REVIEW_FLASHCARDS na tabela StudyScheduleItem:");
  const { data: srsItems } = await supabase
    .from("StudyScheduleItem")
    .select("id, scheduledDate, actionType, subjectId, StudySubject:subjectId(name)")
    .eq("userId", userId)
    .eq("actionType", "REVIEW_FLASHCARDS")
    .order("scheduledDate", { ascending: true })
    .limit(5);

  console.log(srsItems || []);
}

main().catch(console.error);
