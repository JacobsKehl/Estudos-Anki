import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";
const scheduleId = "cmt1mofya0001i804r1mql470";

async function main() {
  const { data: items } = await supabase
    .from("StudyScheduleItem")
    .select(`
      id,
      dayNumber,
      scheduledDate,
      actionType,
      status,
      studyBlockId,
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
    .neq("status", "SKIPPED");

  for (const item of items || []) {
    const b = item.StudyBlock as any;
    if (b?.theoryStatus === "EXCLUDED" || !b) {
      console.log("ITEM COM BLOCO EXCLUDED:", item.id, item.scheduledDate, (item.StudySubject as any)?.name, b?.title, b?.pageStart, b?.pageEnd, b?.theoryStatus);
    }
  }
}

main().catch(console.error);
