import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  console.log("=== VERIFICAÇÃO 1: ESTADO DA GRADE DE 27 E 28/08 ===");

  const { data: schedule } = await supabase
    .from("StudySchedule")
    .select("id, title, status, updatedAt")
    .eq("userId", userId)
    .eq("status", "ACTIVE")
    .order("createdAt", { ascending: false })
    .limit(1)
    .single();

  console.log(`Cronograma Ativo: ID=${schedule?.id} | status=${schedule?.status} | updatedAt=${schedule?.updatedAt}\n`);

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
      updatedAt,
      createdAt,
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
    .eq("scheduleId", schedule?.id)
    .neq("status", "SKIPPED")
    .gte("scheduledDate", "2026-08-27T00:00:00-03:00")
    .lte("scheduledDate", "2026-08-28T23:59:59-03:00")
    .order("scheduledDate", { ascending: true })
    .order("dayNumber", { ascending: true });

  if (error) throw error;

  console.log("Itens para 27/08 e 28/08 no cronograma ativo:");
  console.log("Data       | Dia | Ação              | Status | Matéria                   | Páginas | UpdatedAt                | Título");
  console.log("-----------+-----+-------------------+--------+---------------------------+---------+--------------------------+------------------------------");

  const theory27 = (items || []).filter(i => i.scheduledDate.startsWith("2026-08-27") && i.actionType === "THEORY");
  const theory28 = (items || []).filter(i => i.scheduledDate.startsWith("2026-08-28") && i.actionType === "THEORY");

  for (const item of items || []) {
    const dStr = item.scheduledDate.split("T")[0];
    const act = (item.actionType || "").padEnd(17);
    const st = (item.status || "").padEnd(6);
    const sub = ((item.StudySubject as any)?.name || "").padEnd(25);
    const block = item.StudyBlock as any;
    const pages = block ? `[${block.pageStart}–${block.pageEnd}]`.padEnd(7) : "       ";
    const upAt = item.updatedAt || "N/A";
    const title = block?.title || (item.actionType === "REVIEW_FLASHCARDS" ? "Sessão diária SRS" : "Sem Bloco");

    console.log(`${dStr} | ${String(item.dayNumber).padStart(3)} | ${act} | ${st} | ${sub} | ${pages} | ${upAt} | ${title}`);
  }

  console.log("\n----------------------------------------------------------------------------------");
  console.log(`Itens de THEORY em 27/08: ${theory27.length} (esperado: 4)`);
  console.log(`Itens de THEORY em 28/08: ${theory28.length} (esperado: 4)`);
  console.log("----------------------------------------------------------------------------------\n");

  // Checar se há logs recentes do cron
  console.log("=== ÚLTIMOS LOGS DE StudySessionLog OU SESSÃO ===");
  const { data: logs } = await supabase
    .from("StudySessionLog")
    .select("id, createdAt, startedAt, completedAt, totalMinutes")
    .eq("userId", userId)
    .order("createdAt", { ascending: false })
    .limit(5);

  console.log(logs || []);
}

main().catch(console.error);
