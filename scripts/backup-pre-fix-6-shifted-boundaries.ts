import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("    GERANDO BACKUP PRE-FIX-6-SHIFTED-BOUNDARIES EM BACKUPS/JSON/     ");
  console.log("======================================================================\n");

  const backupDir = path.join(process.cwd(), "backups", "json");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(backupDir, "pre-fix-6-shifted-boundaries.json");

  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: blocks } = await supabase.from("StudyBlock").select("*").eq("userId", userId);
  const { data: schedules } = await supabase.from("StudySchedule").select("*").eq("userId", userId);
  const { data: schedItems } = await supabase.from("StudyScheduleItem").select("*");

  const snapshot = {
    createdAt: new Date().toISOString(),
    userId,
    counts: {
      blocks: blocks?.length || 0,
      schedules: schedules?.length || 0,
      schedItems: schedItems?.length || 0
    },
    blocks,
    schedules,
    schedItems
  };

  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), "utf-8");
  console.log(` ✅ Backup gravado com SUCESSO em: ${backupPath}`);
  console.log(`    Total de StudyBlocks salvos: ${snapshot.counts.blocks}`);
  console.log(`    Total de StudySchedules salvos: ${snapshot.counts.schedules}`);
  console.log(`    Total de StudyScheduleItems salvos: ${snapshot.counts.schedItems}\n`);
}

main().catch(console.error);
