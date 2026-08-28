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

  const dtBlocks = (blocks || []).filter(b => (b as any).StudyMaterial?.originalFileName === "2 - Direito do Trabalho.pdf");
  dtBlocks.sort((a, b) => a.pageStart - b.pageStart);

  console.log("=================================================================================");
  console.log("    PÁGINAS GRAVADAS NO BANCO REAL HOJE (DIREITO DO TRABALHO)                    ");
  console.log("=================================================================================\n");

  dtBlocks.forEach(b => {
    console.log(` • [${b.pageStart}–${b.pageEnd}] '${b.title}' | ID: ${b.id} | Status: ${b.theoryStatus}`);
  });
}

main().catch(console.error);
