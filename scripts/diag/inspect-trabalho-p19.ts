import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, StudyMaterial:materialId(originalFileName)")
    .eq("userId", user!.id);

  const dptBlocks = (blocks || []).filter(b => (b as any).StudyMaterial?.originalFileName === "4 - Direito Processual do Trabalho.pdf");
  console.log("--- BLOCOS DE DIREITO PROCESSUAL DO TRABALHO ---");
  dptBlocks.sort((a, b) => a.pageStart - b.pageStart).forEach(b => {
    console.log(` • [${b.pageStart}–${b.pageEnd}] ${b.title} (ID: ${b.id})`);
  });
}

main();
