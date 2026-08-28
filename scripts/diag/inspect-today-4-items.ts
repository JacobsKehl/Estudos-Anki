import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";
const scheduleId = "cmt1mofya0001i804r1mql470";

async function main() {
  console.log("=== ITENS DE TEORIA DE HOJE (28/08/2026) NO CRONOGRAMA ATIVO ===");

  const { data: items, error } = await supabase
    .from("StudyScheduleItem")
    .select(`
      id,
      dayNumber,
      scheduledDate,
      actionType,
      status,
      reason,
      studyBlockId,
      materialId,
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
    .eq("actionType", "THEORY")
    .neq("status", "SKIPPED")
    .gte("scheduledDate", "2026-08-28T00:00:00-03:00")
    .lte("scheduledDate", "2026-08-28T23:59:59-03:00")
    .order("dayNumber", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  console.log(`Total de itens de THEORY em 28/08: ${items?.length}`);
  for (const item of items || []) {
    const b = item.StudyBlock as any;
    const sub = (item.StudySubject as any)?.name || "";
    console.log("------------------------------------------------------------------");
    console.log(`ID          : ${item.id}`);
    console.log(`Matéria     : ${sub}`);
    console.log(`Páginas     : [${b?.pageStart}–${b?.pageEnd}] | ${b?.title}`);
    console.log(`studyBlockId: ${item.studyBlockId}`);
    console.log(`materialId  : ${item.materialId}`);
    console.log(`status      : ${item.status}`);
    console.log(`reason      : ${item.reason}`);
    console.log(`createdAt   : ${item.createdAt}`);
    console.log(`updatedAt   : ${item.updatedAt}`);
  }
}

main().catch(console.error);
