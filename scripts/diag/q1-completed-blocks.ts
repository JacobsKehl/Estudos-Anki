import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  const { data: subjects } = await supabase.from("StudySubject").select("id, name").eq("userId", userId);
  const subMap = new Map((subjects || []).map(s => [s.id, s.name]));

  // Buscar todos os blocos criados hoje que estão COMPLETED
  const { data: completedBlocks, error } = await supabase
    .from("StudyBlock")
    .select("id, subjectId, pageStart, pageEnd, title, theoryStatus, createdAt")
    .eq("userId", userId)
    .eq("theoryStatus", "COMPLETED")
    .gte("createdAt", "2026-08-27T00:00:00-03:00")
    .order("subjectId", { ascending: true })
    .order("pageStart", { ascending: true });

  if (error) throw error;

  console.log(`TOTAL_COMPLETED_NOVOS=${completedBlocks?.length || 0}\n`);
  completedBlocks?.forEach((b, i) => {
    const sub = subMap.get(b.subjectId) || b.subjectId;
    console.log(`${(i + 1).toString().padStart(2, "0")}. ${sub.padEnd(30)} [${b.pageStart}–${b.pageEnd}]  "${b.title}"`);
  });
}

main().catch(console.error);
