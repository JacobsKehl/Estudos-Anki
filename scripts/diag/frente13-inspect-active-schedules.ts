import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  console.log("=== FRENTE 1.3: LEITURA DE CRONOGRAMAS ATIVOS (StudySchedule) DA GABRIELA ===");

  const { data: schedules, error } = await supabase
    .from("StudySchedule")
    .select("id, status, title, createdAt, updatedAt")
    .eq("userId", userId)
    .eq("status", "ACTIVE")
    .order("createdAt", { ascending: true });

  if (error) throw error;

  console.log(`\nTotal de StudySchedule com status = "ACTIVE" da Gabriela: ${schedules?.length}\n`);

  for (const s of schedules || []) {
    // Contar itens de hoje (28/08) neste cronograma
    const { count: todayItemsCount } = await supabase
      .from("StudyScheduleItem")
      .select("id", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("scheduleId", s.id)
      .neq("status", "SKIPPED")
      .gte("scheduledDate", "2026-08-28T00:00:00-03:00")
      .lte("scheduledDate", "2026-08-28T23:59:59-03:00");

    console.log(`- ID: ${s.id}`);
    console.log(`  Título: ${s.title}`);
    console.log(`  CreatedAt: ${s.createdAt}`);
    console.log(`  UpdatedAt: ${s.updatedAt}`);
    console.log(`  Itens NÃO-SKIPPED de HOJE (28/08): ${todayItemsCount}`);
  }
}

main().catch(console.error);
