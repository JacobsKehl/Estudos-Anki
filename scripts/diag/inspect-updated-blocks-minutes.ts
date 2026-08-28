import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, theoryStatus, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  console.log("=================================================================================");
  console.log("    AFERIÇÃO DE ESTIMATED STUDY MINUTES NOS BLOCOS ALTERADOS                    ");
  console.log("=================================================================================\n");

  const targetPdfs = ["Direito Processual Civil_compressed.pdf", "2 - Direito do Trabalho.pdf"];
  const updatedBlocks = (blocks || []).filter(b => 
    targetPdfs.includes((b as any).StudyMaterial?.originalFileName) && b.pageStart > 0 && b.theoryStatus !== "EXCLUDED"
  );
  updatedBlocks.sort((a, b) => a.pageStart - b.pageStart);

  let totalMinutes = 0;

  for (const b of updatedBlocks) {
    const pagesCount = b.pageEnd - b.pageStart + 1;
    totalMinutes += b.estimatedStudyMinutes;
    console.log(` • [${b.pageStart}–${b.pageEnd}] (${pagesCount} págs) '${b.title}' ➔ Minutos no Banco: ${b.estimatedStudyMinutes} min | Status: ${b.theoryStatus}`);
  }

  console.log(`\n Total de Minutos das Matérias Alteradas: ${totalMinutes} min`);
}

main().catch(console.error);
