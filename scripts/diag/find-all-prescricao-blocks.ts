/**
 * find-all-prescricao-blocks.ts
 * READ-ONLY: Lista todos os blocos com "Prescrição" no título, com material associado.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase
    .from("User").select("id")
    .eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryStatus, pageStart, pageEnd, estimatedStudyMinutes, materialId, sourceV1BlockId, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId)
    .ilike("title", "%Prescrição%");

  console.log(`\nBlocos com "Prescrição" no título: ${blocks?.length}\n`);
  for (const b of blocks || []) {
    console.log(`  ID:            ${b.id}`);
    console.log(`  Título:        ${b.title}`);
    console.log(`  Material:      ${(b as any).StudyMaterial?.originalFileName}`);
    console.log(`  theoryStatus:  ${b.theoryStatus}`);
    console.log(`  Intervalo:     [${b.pageStart}–${b.pageEnd}]`);
    console.log(`  Minutos:       ${b.estimatedStudyMinutes}`);
    console.log(`  sourceV1:      ${b.sourceV1BlockId}`);
    console.log("");
  }
}

main().catch(console.error);
