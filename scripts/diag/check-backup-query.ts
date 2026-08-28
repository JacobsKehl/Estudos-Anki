import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: currentDbItems } = await supabase
    .from("StudyScheduleItem")
    .select("id, scheduledDate, createdAt")
    .eq("userId", userId)
    .gte("scheduledDate", "2026-08-20T00:00:00.000Z")
    .lte("scheduledDate", "2026-08-20T23:59:59.999Z");

  const backupPath = path.join(process.cwd(), "backups", "json", "pre-realinhamento-paginas.json");
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const bkpItemsMap = new Map((backup.items || []).map((it: any) => [it.id, it]));

  console.log("Checking if the 21 items currently in DB existed in backup:");
  let existingInBackup = 0;
  for (const it of currentDbItems || []) {
    const bkpItem = bkpItemsMap.get(it.id);
    if (bkpItem) {
      existingInBackup++;
      console.log(`  ✅ Item ${it.id} existed in backup! scheduledDate: ${(bkpItem as any).scheduledDate}`);
    } else {
      console.log(`  ❌ Item ${it.id} NOT in backup! createdAt: ${it.createdAt}`);
    }
  }

  console.log(`\nFound in backup: ${existingInBackup} / ${currentDbItems?.length}`);
}

main().catch(console.error);
