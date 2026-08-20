import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const cfcFileNames = [
  "1 - Direito Administrativo_compressed.pdf",
  "3 - Direito Constitucional_compressed.pdf",
  "3 - Direito Constitucional.pdf",
  "Direito Processual Civil_compressed.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "2 - Direito do Trabalho.pdf"
];

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  if (!user) return;

  const { data: cfcMaterials } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName")
    .in("originalFileName", cfcFileNames);

  const cfcMaterialIds = (cfcMaterials || []).map(m => m.id);

  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryStatus, questionsStatus, flashcardsStatus, possiblyAlreadyStudied, materialId, pageStart, pageEnd, estimatedStudyMinutes, StudyMaterial:materialId(originalFileName)")
    .eq("userId", user.id)
    .is("sourceV1BlockId", null)
    .in("materialId", cfcMaterialIds);

  console.log(`Total de blocos âncora do CFC encontrados: ${blocks?.length || 0}`);

  const statusBreakdown: Record<string, number> = {};
  (blocks || []).forEach(b => {
    const key = `theoryStatus: ${b.theoryStatus} | possiblyAlreadyStudied: ${b.possiblyAlreadyStudied}`;
    statusBreakdown[key] = (statusBreakdown[key] || 0) + 1;
  });

  console.log("\n--- DETALHAMENTO DE STATUS DOS BLOCOS CFC ---");
  for (const [k, v] of Object.entries(statusBreakdown)) {
    console.log(` • ${k}: ${v} blocos`);
  }

  console.log("\n--- AMOSTRA DE BLOCOS NÃO CONCLUÍDOS (NÃO LIDOS) ---");
  const unread = (blocks || []).filter(b => b.theoryStatus !== "COMPLETED");
  unread.slice(0, 10).forEach(b => {
    console.log(` • [${(b as any).StudyMaterial?.originalFileName}] '${b.title}' (${b.estimatedStudyMinutes} min, pp. ${b.pageStart}–${b.pageEnd}) | theoryStatus: ${b.theoryStatus} | possibly: ${b.possiblyAlreadyStudied}`);
  });
}

main();
