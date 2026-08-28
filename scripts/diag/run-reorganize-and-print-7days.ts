import "dotenv/config";

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { reorganizeActiveSchedule } from "../src/lib/scheduler";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  console.log("=== EXECUTANDO REORGANIZAÇÃO DO CRONOGRAMA ===");
  const reorgResult = await reorganizeActiveSchedule(userId, 30);
  console.log("Resultado da reorganização:", reorgResult);

  console.log("\n=== GRADE DOS PRÓXIMOS 7 DIAS ===");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end7Days = new Date(today);
  end7Days.setDate(end7Days.getDate() + 7);

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
      studyBlock:StudyBlock (
        id,
        title,
        pageStart,
        pageEnd,
        theoryStatus
      ),
      subject:StudySubject (
        name
      )
    `)
    .eq("userId", userId)
    .gte("scheduledDate", today.toISOString())
    .lte("scheduledDate", end7Days.toISOString())
    .order("scheduledDate", { ascending: true })
    .order("dayNumber", { ascending: true });

  if (error) throw error;

  let excludedCount = 0;

  console.log("\nData       | Dia | Ação              | Matéria                   | Status Bloco | Págs    | Título do Bloco");
  console.log("-----------+-----+-------------------+---------------------------+--------------+---------+----------------------------------------------");

  for (const item of items || []) {
    const dateStr = item.scheduledDate ? item.scheduledDate.split("T")[0] : "Sem Data";
    const action = (item.actionType || "").padEnd(17);
    const subjectName = ((item.subject as any)?.name || "Sem Matéria").padEnd(25);
    const block = (item.studyBlock as any);
    const bStatus = (block?.theoryStatus || "N/A").padEnd(12);
    const pages = block ? `[${block.pageStart}–${block.pageEnd}]`.padEnd(7) : "       ";
    const title = block?.title || (item.actionType === "REVIEW_FLASHCARDS" ? "Sessão diária SRS" : "Sem Bloco");

    if (block?.theoryStatus === "EXCLUDED") {
      excludedCount++;
    }

    console.log(`${dateStr} | ${String(item.dayNumber).padStart(3)} | ${action} | ${subjectName} | ${bStatus} | ${pages} | ${title}`);
  }

  console.log("\n--------------------------------------------------------------------------------------------");
  console.log(`Total de itens exibidos: ${items?.length || 0}`);
  console.log(`Itens apontando para bloco EXCLUDED: ${excludedCount} (esperado: 0)`);
  console.log("--------------------------------------------------------------------------------------------\n");

  if (excludedCount > 0) {
    console.error("🛑 ERRO: Existem itens apontando para blocos EXCLUDED!");
    process.exit(1);
  }
}

main().catch(console.error);
