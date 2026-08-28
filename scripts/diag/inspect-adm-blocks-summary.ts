import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: material } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName")
    .eq("originalFileName", "1 - Direito Administrativo_compressed.pdf")
    .single();

  if (!material) {
    console.error("Material not found");
    return;
  }

  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, orderIndex, theoryStatus, possiblyAlreadyStudied")
    .eq("materialId", material.id)
    .order("pageStart", { ascending: true });

  console.log("======================================================================");
  console.log("    TODOS OS BLOCOS DO MATERIAL DE DIREITO ADMINISTRATIVO (PÁGINA 1-155)");
  console.log("======================================================================\n");

  blocks?.forEach((b, i) => {
    console.log(`${(i+1).toString().padStart(2, " ")}) pp.${b.pageStart}-${b.pageEnd} (${(b.pageEnd??0)-(b.pageStart??0)+1} págs, ${b.estimatedStudyMinutes}m) [Status: ${b.theoryStatus}, Flagged: ${b.possiblyAlreadyStudied}]`);
    console.log(`    Title: "${b.title}"`);
    console.log(`    ID: ${b.id}\n`);
  });
}

main();
