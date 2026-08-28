import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase
    .from("User")
    .select("id")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();
  const userId = user!.id;

  const cfcFileNames = [
    "1 - Direito Administrativo_compressed.pdf",
    "3 - Direito Constitucional_compressed.pdf",
    "3 - Direito Constitucional.pdf",
    "Direito Processual Civil_compressed.pdf",
    "4 - Direito Processual do Trabalho.pdf",
    "2 - Direito do Trabalho.pdf"
  ];

  const { data: cfcMaterials } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName")
    .in("originalFileName", cfcFileNames);

  const cfcMaterialIds = (cfcMaterials || []).map(m => m.id);

  // Balde 1 (28 blocos inéditos do CFC em ordem de processamento)
  const { data: newTheoryBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, estimatedStudyMinutes, pageStart, pageEnd, materialId, createdAt")
    .eq("userId", userId)
    .is("sourceV1BlockId", null)
    .eq("possiblyAlreadyStudied", false)
    .eq("theoryStatus", "NOT_STARTED")
    .in("materialId", cfcMaterialIds)
    .order("createdAt", { ascending: true });

  console.log(`Total de blocos inéditos do Balde 1: ${newTheoryBlocks?.length}`);
  
  if (!newTheoryBlocks) return;

  // No dia 19/08 (quarta-feira): 2 blocos (índices 0, 1)
  // No dia 20/08 (quinta-feira): 2 blocos (índices 2, 3)
  // No dia 21/08 (sexta-feira): 2 blocos (índices 4, 5)

  console.log("\n--- BLOCS ALOCADOS NO DIA 21/08/2026 (PICO DE CARGA) ---");
  const day21Blocks = newTheoryBlocks.slice(4, 6);
  day21Blocks.forEach((b, i) => {
    const mat = cfcMaterials?.find(m => m.id === b.materialId);
    console.log(`\nBloco ${i + 1} de 21/08:`);
    console.log(`- ID: ${b.id}`);
    console.log(`- Título: "${b.title}"`);
    console.log(`- Matéria: ${mat?.originalFileName}`);
    console.log(`- Páginas: pp. ${b.pageStart} a ${b.pageEnd} (Total: ${(b.pageEnd ?? 0) - (b.pageStart ?? 0) + 1} páginas)`);
    console.log(`- estimatedStudyMinutes: ${b.estimatedStudyMinutes} minutos (${((b.estimatedStudyMinutes || 0)/60).toFixed(1)} horas)`);
  });

  console.log("\n--- RESUMO DE TODOS OS BLCOS DO BALDE 1 (28) ---");
  newTheoryBlocks.forEach((b, idx) => {
    console.log(`[${idx + 1}] ${b.title} | pp.${b.pageStart}-${b.pageEnd} | ${b.estimatedStudyMinutes}m`);
  });
}

main();
