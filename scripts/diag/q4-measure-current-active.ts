import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";
const scheduleId = "cmt1mofya0001i804r1mql470";

function loadBlueprintPages(): Map<string, Set<string>> {
  const csvPath = path.resolve(__dirname, "../../tmp/BLUEPRINT-blocos-cfc.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean).slice(1);
  const map = new Map<string, Set<string>>();

  for (const line of lines) {
    const parts = line.split(",");
    const materia = parts[0].trim();
    const pageStart = parts[6].trim();
    const pageEnd = parts[7].trim();
    if (!map.has(materia)) map.set(materia, new Set());
    map.get(materia)!.add(`${pageStart}-${pageEnd}`);
  }
  return map;
}

async function main() {
  console.log("=== MEDIÇÃO DAS 3 CONTAGENS NO CRONOGRAMA ATIVO ATUAL (cmt1mofya0001i804r1mql470) ===\n");

  const { data: items, error } = await supabase
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

  if (error) throw error;

  const blueprintMap = loadBlueprintPages();
  let itensComBlocoExcluded = 0;
  let itensForaDoBlueprint = 0;

  for (const item of items || []) {
    const b = item.StudyBlock as any;
    const subName = (item.StudySubject as any)?.name || "";

    if (b?.theoryStatus === "EXCLUDED") {
      itensComBlocoExcluded++;
    }

    const bpPages = blueprintMap.get(subName);
    if (b && bpPages) {
      const key = `${b.pageStart}-${b.pageEnd}`;
      if (!bpPages.has(key)) {
        itensForaDoBlueprint++;
      }
    }
  }

  console.log(`ITENS_THEORY_TOTAL = ${items?.length || 0}`);
  console.log(`ITENS_COM_BLOCO_EXCLUDED = ${itensComBlocoExcluded} (esperado: 0)`);
  console.log(`ITENS_FORA_DO_BLUEPRINT = ${itensForaDoBlueprint} (esperado: 0)`);
}

main().catch(console.error);
