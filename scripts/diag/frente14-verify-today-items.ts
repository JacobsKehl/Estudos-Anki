import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";
const scheduleId = "cmt1mofya0001i804r1mql470";

function loadBlueprint(): any[] {
  const csvPath = path.resolve(__dirname, "../../tmp/BLUEPRINT-blocos-cfc.csv");
  const content = fs.readFileSync(csvPath, "utf-8").trim();
  const lines = content.split("\n").slice(1);
  return lines.map((line) => {
    const cols: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) {
        cols.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cols.push(cur.trim());
    return {
      materia: cols[0],
      pdf: cols[1],
      pageStart: parseInt(cols[6], 10),
      pageEnd: parseInt(cols[7], 10),
      minutos: parseInt(cols[9], 10),
      titulo: cols[3],
    };
  });
}

async function main() {
  console.log("=== FRENTE 1.4: CONFERÊNCIA DOS ITENS DE HOJE (28/08) CONTRA BLUEPRINT ===");
  const blueprint = loadBlueprint();

  const { data: todayItems, error } = await supabase
    .from("StudyScheduleItem")
    .select(`
      id,
      dayNumber,
      scheduledDate,
      actionType,
      status,
      estimatedMinutes,
      studyBlockId,
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
    .neq("status", "SKIPPED")
    .gte("scheduledDate", "2026-08-28T00:00:00-03:00")
    .lte("scheduledDate", "2026-08-28T23:59:59-03:00")
    .order("dayNumber", { ascending: true });

  if (error) throw error;

  console.log(`Total de itens ativos em 28/08: ${todayItems?.length}\n`);

  let totalTheoryMinutes = 0;
  const invalidItems: any[] = [];

  for (const item of todayItems || []) {
    const b = item.StudyBlock as any;
    const matFileName = b?.StudyMaterial?.originalFileName;
    const subName = (item.StudySubject as any)?.name;

    if (item.actionType === "THEORY") {
      const match = blueprint.find(
        (r) =>
          r.pdf === matFileName &&
          r.pageStart === b?.pageStart &&
          r.pageEnd === b?.pageEnd
      );

      if (!match) {
        invalidItems.push(item);
        console.log(`❌ ITEM DE TEORIA FORA DO BLUEPRINT: ${item.id} [${subName}] [${b?.pageStart}–${b?.pageEnd}] "${b?.title}"`);
      } else {
        totalTheoryMinutes += match.minutos;
        console.log(`✅ ITEM DE TEORIA DO BLUEPRINT: ${item.id} | ${subName} [${b?.pageStart}–${b?.pageEnd}] "${b?.title}" (${match.minutos} min)`);
      }
    } else {
      console.log(`ℹ️ ITEM DE OUTRO TIPO: ${item.id} | ${item.actionType} | ${subName} ${b ? `[${b.pageStart}–${b.pageEnd}]` : ""}`);
    }
  }

  console.log(`\nSoma dos minutos de teoria de hoje: ${totalTheoryMinutes} minutos`);
  console.log(`Itens fora do blueprint a serem marcados como SKIPPED: ${invalidItems.length}`);
}

main().catch(console.error);
