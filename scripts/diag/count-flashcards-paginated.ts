import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  const { data: subjects } = await supabase
    .from("StudySubject")
    .select("id, name")
    .eq("userId", userId);

  const subMap = new Map<string, string>();
  for (const s of subjects || []) subMap.set(s.id, s.name);

  let allCards: any[] = [];
  let page = 0;
  const BATCH = 1000;
  while (true) {
    const { data: cards } = await supabase
      .from("Flashcard")
      .select("id, subjectId, nextReviewAt, status, reviewState")
      .eq("userId", userId)
      .range(page * BATCH, (page + 1) * BATCH - 1);

    if (cards && cards.length > 0) allCards = allCards.concat(cards);
    if (!cards || cards.length < BATCH) break;
    page++;
  }

  console.log(`Total de Flashcards carregados: ${allCards.length}`);

  const now = new Date();
  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);

  const cardsBySubject: Record<string, { total: number; dueNext7Days: number }> = {};

  for (const c of allCards) {
    const sName = subMap.get(c.subjectId) || "Sem Matéria";
    if (!cardsBySubject[sName]) cardsBySubject[sName] = { total: 0, dueNext7Days: 0 };
    cardsBySubject[sName].total++;

    if (c.nextReviewAt) {
      const rev = new Date(c.nextReviewAt);
      if (rev <= next7Days) {
        cardsBySubject[sName].dueNext7Days++;
      }
    }
  }

  console.log("\nDistribuição de Flashcards por Matéria:");
  console.log("Matéria                         | Total Flashcards | Vencem Próx. 7 Dias");
  console.log("--------------------------------+------------------+--------------------");
  for (const [sub, cnt] of Object.entries(cardsBySubject)) {
    console.log(`${sub.padEnd(31)} | ${String(cnt.total).padStart(16)} | ${String(cnt.dueNext7Days).padStart(19)}`);
  }
}

main().catch(console.error);
