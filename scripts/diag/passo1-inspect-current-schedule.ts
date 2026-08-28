import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";
const scheduleId = "cmt1mofya0001i804r1mql470";

async function main() {
  console.log("==========================================================================");
  console.log("  PASSO 1: INSPEÇÃO DO CRONOGRAMA ATIVO (cmt1mofya0001i804r1mql470)");
  console.log("==========================================================================\n");

  // 1. dailyReminderTime e preferências
  const { data: pref } = await supabase
    .from("UserPreferences")
    .select("emailReminderTime, lastDailyReminderSentAt, scheduleGenerationMode, updatedAt")
    .eq("userId", userId)
    .single();

  console.log("Preferências de Lembrete:");
  console.log(`  - emailReminderTime: ${pref?.emailReminderTime} (Janela: 08:00 - 08:20 BRT)`);
  console.log(`  - lastDailyReminderSentAt: ${pref?.lastDailyReminderSentAt}`);
  console.log(`  - scheduleGenerationMode: ${pref?.scheduleGenerationMode}\n`);

  // 2. Itens de THEORY por dia de 28/08 a 05/09
  const { data: items, error } = await supabase
    .from("StudyScheduleItem")
    .select(`
      id,
      dayNumber,
      scheduledDate,
      actionType,
      status,
      estimatedMinutes,
      studyBlockId,
      createdAt,
      updatedAt,
      StudyBlock:studyBlockId (
        id,
        title,
        pageStart,
        pageEnd,
        theoryStatus
      ),
      StudySubject:subjectId (
        name
      )
    `)
    .eq("userId", userId)
    .eq("scheduleId", scheduleId)
    .neq("status", "SKIPPED")
    .gte("scheduledDate", "2026-08-28T00:00:00-03:00")
    .lte("scheduledDate", "2026-09-05T23:59:59-03:00")
    .order("scheduledDate", { ascending: true })
    .order("dayNumber", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  // Agrupar itens de THEORY por dia
  const theoryByDay: Record<string, typeof items> = {};
  for (const item of items || []) {
    if (item.actionType === "THEORY") {
      const d = item.scheduledDate ? item.scheduledDate.substring(0, 10) : "Sem Data";
      if (!theoryByDay[d]) theoryByDay[d] = [];
      theoryByDay[d].push(item);
    }
  }

  console.log("a) Quantidade de itens de THEORY por dia (28/08 a 05/09):");
  console.log("Data       | Qtd THEORY | Detalhes dos Blocos");
  console.log("-----------+------------+------------------------------------------------------------------");
  const daysList = [
    "2026-08-28",
    "2026-08-29",
    "2026-08-30",
    "2026-08-31",
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
  ];
  for (const d of daysList) {
    const list = theoryByDay[d] || [];
    const desc = list
      .map((i) => {
        const b = i.StudyBlock as any;
        const sub = (i.StudySubject as any)?.name || "";
        return `${sub} [${b?.pageStart}–${b?.pageEnd}]`;
      })
      .join(" | ");
    console.log(`${d} | ${String(list.length).padStart(10)} | ${desc}`);
  }

  // 3. updatedAt mais recente entre TODOS os itens do cronograma ativo
  const { data: allItems } = await supabase
    .from("StudyScheduleItem")
    .select("updatedAt")
    .eq("userId", userId)
    .eq("scheduleId", scheduleId)
    .order("updatedAt", { ascending: false })
    .limit(1);

  console.log(`\nb) updatedAt mais recente no cronograma: ${allItems?.[0]?.updatedAt}`);

  // 4. Detalhe completo dos itens de 29/08 e 30/08
  console.log("\nc) Detalhes dos itens de 29/08 e 30/08:");
  const items2930 = (items || []).filter(
    (i) => i.scheduledDate.startsWith("2026-08-29") || i.scheduledDate.startsWith("2026-08-30")
  );

  console.log("ID                       | Data       | Ação              | Status  | Matéria                   | Págs    | CreatedAt                | UpdatedAt                | Título");
  console.log("-------------------------+------------+-------------------+---------+---------------------------+---------+--------------------------+--------------------------+------------------------------");
  for (const i of items2930) {
    const dStr = i.scheduledDate.substring(0, 10);
    const act = (i.actionType || "").padEnd(17);
    const st = (i.status || "").padEnd(7);
    const sub = ((i.StudySubject as any)?.name || "").padEnd(25);
    const b = i.StudyBlock as any;
    const pages = b ? `[${b.pageStart}–${b.pageEnd}]`.padEnd(7) : "       ";
    const title = b?.title || (i.actionType === "REVIEW_FLASHCARDS" ? "Sessão diária SRS" : "Sem Bloco");
    console.log(`${i.id.padEnd(24)} | ${dStr} | ${act} | ${st} | ${sub} | ${pages} | ${i.createdAt || "N/A"} | ${i.updatedAt || "N/A"} | ${title}`);
  }
}

main().catch(console.error);
