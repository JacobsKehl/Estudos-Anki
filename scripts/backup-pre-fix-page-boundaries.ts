import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("    CRIANDO BACKUP PRE-FIX-PAGE-BOUNDARIES VIA REST (HTTPS)          ");
  console.log("======================================================================\n");

  const [
    { data: user },
    { data: blocks },
    { data: schedules },
    { data: scheduleItems }
  ] = await Promise.all([
    supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single(),
    supabase.from("StudyBlock").select("*"),
    supabase.from("StudySchedule").select("*"),
    supabase.from("StudyScheduleItem").select("*")
  ]);

  const backupData = {
    timestamp: new Date().toISOString(),
    user,
    blocksCount: blocks?.length || 0,
    schedulesCount: schedules?.length || 0,
    scheduleItemsCount: scheduleItems?.length || 0,
    blocks,
    schedules,
    scheduleItems
  };

  const backupDir = path.join(process.cwd(), "docs", "temp_migrations");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(backupDir, "pre-fix-page-boundaries.json");
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

  console.log(`✅ Backup salvo com sucesso em: ${backupPath}`);
  console.log(` - Total de StudyBlock: ${blocks?.length}`);
  console.log(` - Total de StudySchedule: ${schedules?.length}`);
  console.log(` - Total de StudyScheduleItem: ${scheduleItems?.length}\n`);
}

main().catch(console.error);
