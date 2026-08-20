import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const label = "pre-realinhamento-paginas";
  console.log(`📦 Criando backup ${label}...\n`);

  const { data: user } = await supabase
    .from("User").select("id")
    .eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: blocks } = await supabase.from("StudyBlock").select("*").eq("userId", userId);
  const { data: subjects } = await supabase.from("StudySubject").select("*").eq("userId", userId);
  const { data: materials } = await supabase.from("StudyMaterial").select("*").eq("userId", userId);
  const { data: schedules } = await supabase.from("StudySchedule").select("*").eq("userId", userId);
  const scheduleIds = (schedules || []).map(s => s.id);
  const { data: items } = scheduleIds.length > 0
    ? await supabase.from("StudyScheduleItem").select("*").in("scheduleId", scheduleIds)
    : { data: [] };

  const backup = {
    timestamp: new Date().toISOString(),
    label,
    userId,
    counts: {
      blocks: blocks?.length ?? 0,
      subjects: subjects?.length ?? 0,
      materials: materials?.length ?? 0,
      schedules: schedules?.length ?? 0,
      items: items?.length ?? 0,
    },
    blocks, subjects, materials, schedules, items,
  };

  const outDir = path.join(__dirname, "..", "backups", "json");
  const outPath = path.join(outDir, `${label}.json`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(backup, null, 2));

  console.log(`✅ Backup salvo em: ${outPath}`);
  console.log(`   Blocos: ${backup.counts.blocks}`);
  console.log(`   Matérias: ${backup.counts.subjects}`);
  console.log(`   Materiais: ${backup.counts.materials}`);
}

main().catch(console.error);
