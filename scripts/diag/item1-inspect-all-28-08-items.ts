import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";
const scheduleId = "cmt1mofya0001i804r1mql470";

async function main() {
  console.log("=== ITEM 1: TODOS OS StudyScheduleItem EM 28/08 (SEM FILTRO DE STATUS) ===");

  const { data: items, error } = await supabase
    .from("StudyScheduleItem")
    .select(`
      id,
      dayNumber,
      actionType,
      status,
      reason,
      estimatedMinutes,
      studyBlockId,
      createdAt,
      updatedAt,
      StudyBlock:studyBlockId (
        id,
        title,
        pageStart,
        pageEnd,
        theoryStatus,
        materialId,
        StudyMaterial:materialId (
          id,
          originalFileName
        )
      ),
      StudySubject:subjectId (
        name
      )
    `)
    .eq("userId", userId)
    .eq("scheduleId", scheduleId)
    .gte("scheduledDate", "2026-08-28T00:00:00-03:00")
    .lte("scheduledDate", "2026-08-28T23:59:59-03:00")
    .order("createdAt", { ascending: true });

  if (error) throw error;

  console.log(`Total de itens encontrados para 28/08: ${items?.length}\n`);

  for (const it of items || []) {
    const b = it.StudyBlock as any;
    const mat = b?.StudyMaterial?.originalFileName ?? "SEM_MATERIAL";
    const sub = (it.StudySubject as any)?.name ?? "SEM_MATERIA";

    console.log(`----------------------------------------------------------------------`);
    console.log(`ID: ${it.id} | Action: ${it.actionType} | Status: ${it.status}`);
    console.log(`Matéria: ${sub} | Bloco: [${b?.pageStart ?? "?"}–${b?.pageEnd ?? "?"}] "${b?.title ?? "N/A"}"`);
    console.log(`Material: ${mat} | Minutos: ${it.estimatedMinutes}`);
    console.log(`Reason: ${it.reason}`);
    console.log(`CreatedAt: ${it.createdAt} | UpdatedAt: ${it.updatedAt}`);
  }
}

main().catch(console.error);
