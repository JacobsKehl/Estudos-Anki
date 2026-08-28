import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  console.log("=== AUDITORIA DE CONTAGENS E WHERES DE StudyBlock E StudyScheduleItem ===\n");

  // 1. StudyBlock
  const { count: sbGlobal } = await supabase.from("StudyBlock").select("id", { count: "exact", head: true });
  const { count: sbUser } = await supabase.from("StudyBlock").select("id", { count: "exact", head: true }).eq("userId", userId);
  const { count: sbUserExcluded } = await supabase.from("StudyBlock").select("id", { count: "exact", head: true }).eq("userId", userId).eq("theoryStatus", "EXCLUDED");
  const { count: sbUserCompleted } = await supabase.from("StudyBlock").select("id", { count: "exact", head: true }).eq("userId", userId).eq("theoryStatus", "COMPLETED");
  const { count: sbUserNotStarted } = await supabase.from("StudyBlock").select("id", { count: "exact", head: true }).eq("userId", userId).eq("theoryStatus", "NOT_STARTED");

  console.log("StudyBlock:");
  console.log(`  - Total Global (WHERE {}): ${sbGlobal}`);
  console.log(`  - Total Gabriela (WHERE { userId: "${userId}" }): ${sbUser}`);
  console.log(`    - EXCLUDED: ${sbUserExcluded}`);
  console.log(`    - COMPLETED: ${sbUserCompleted}`);
  console.log(`    - NOT_STARTED: ${sbUserNotStarted}`);

  // 2. StudyScheduleItem
  const { count: ssiGlobal } = await supabase.from("StudyScheduleItem").select("id", { count: "exact", head: true });
  const { count: ssiUser } = await supabase.from("StudyScheduleItem").select("id", { count: "exact", head: true }).eq("userId", userId);
  const { count: ssiUserActiveSch } = await supabase.from("StudyScheduleItem").select("id", { count: "exact", head: true }).eq("userId", userId).eq("scheduleId", "cmt1mofya0001i804r1mql470");
  const { count: ssiUserSkipped } = await supabase.from("StudyScheduleItem").select("id", { count: "exact", head: true }).eq("userId", userId).eq("status", "SKIPPED");
  const { count: ssiUserPending } = await supabase.from("StudyScheduleItem").select("id", { count: "exact", head: true }).eq("userId", userId).eq("status", "PENDING");
  const { count: ssiUserCompleted } = await supabase.from("StudyScheduleItem").select("id", { count: "exact", head: true }).eq("userId", userId).eq("status", "COMPLETED");

  console.log("\nStudyScheduleItem:");
  console.log(`  - Total Global (WHERE {}): ${ssiGlobal}`);
  console.log(`  - Total Gabriela (WHERE { userId: "${userId}" }): ${ssiUser}`);
  console.log(`  - No Cronograma Ativo Gabriela (WHERE { userId, scheduleId: "cmt1mofya..." }): ${ssiUserActiveSch}`);
  console.log(`    - PENDING: ${ssiUserPending}`);
  console.log(`    - COMPLETED: ${ssiUserCompleted}`);
  console.log(`    - SKIPPED: ${ssiUserSkipped}`);
}

main().catch(console.error);
