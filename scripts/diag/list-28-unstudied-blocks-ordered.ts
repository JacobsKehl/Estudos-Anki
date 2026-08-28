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

  // Balde 1 (28 blocos inéditos do CFC)
  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, estimatedStudyMinutes, pageStart, pageEnd, materialId")
    .eq("userId", userId)
    .is("sourceV1BlockId", null)
    .eq("possiblyAlreadyStudied", false)
    .eq("theoryStatus", "NOT_STARTED")
    .in("materialId", cfcMaterialIds);

  if (!blocks) return;

  const sorted = [...blocks].sort((a, b) => (b.estimatedStudyMinutes || 0) - (a.estimatedStudyMinutes || 0));

  console.log(`======================================================================`);
  console.log(`    LISTA DOS 28 BLOCOS INÉDITOS DO CFC (ORDEM DECRESCENTE DE DURAÇÃO) `);
  console.log(`======================================================================\n`);

  sorted.forEach((b, idx) => {
    const mat = cfcMaterials?.find(m => m.id === b.materialId);
    const pages = (b.pageEnd ?? 0) - (b.pageStart ?? 0) + 1;
    console.log(`${(idx + 1).toString().padStart(2, " ")}. [${b.estimatedStudyMinutes || 0} min] (${pages} págs, pp.${b.pageStart}-${b.pageEnd})`);
    console.log(`    Título: "${b.title}"`);
    console.log(`    Matéria: ${mat?.originalFileName}`);
    console.log(`    ID: ${b.id}\n`);
  });
}

main();
