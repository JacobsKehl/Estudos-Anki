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

  if (!user) {
    console.error("User not found");
    return;
  }
  const userId = user.id;

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

  // 1. All completed blocks with sourceV1BlockId = null
  const { data: allCompletedWithNullV1 } = await supabase
    .from("StudyBlock")
    .select("id, title, materialId, theoryStatus, theoryCompletedAt, createdAt")
    .eq("userId", userId)
    .eq("theoryStatus", "COMPLETED")
    .is("sourceV1BlockId", null);

  const totalCompleted = allCompletedWithNullV1?.length || 0;
  const cfcCompleted = (allCompletedWithNullV1 || []).filter(b => cfcMaterialIds.includes(b.materialId));
  const estrategiaCompleted = (allCompletedWithNullV1 || []).filter(b => !cfcMaterialIds.includes(b.materialId));
  const nullTheoryCompletedAt = (allCompletedWithNullV1 || []).filter(b => !b.theoryCompletedAt);

  console.log("======================================================================");
  console.log("    AUDITORIA DE ESCOPO DO D3: COMPLETED + sourceV1BlockId IS NULL     ");
  console.log("======================================================================\n");

  console.log(`📊 TOTAL DE BLOCOS CONCLUÍDOS COM sourceV1BlockId = NULL: ${totalCompleted}`);
  console.log(` - Pertencentes aos 5/6 PDFs do CFC:                ${cfcCompleted.length} ✅ (Escopo Correto)`);
  console.log(` - Pertencentes ao Estratégia / Materiais Legados:  ${estrategiaCompleted.length} 🔴 (VAZAMENTO SE NÃO FILTRAR POR MATERIAL!)`);
  console.log(` - Blocos com theoryCompletedAt NULO:               ${nullTheoryCompletedAt.length} ⚠️\n`);

  console.log("--- DETALHAMENTO DOS MATERIAIS DOS BLOCOS NO ESCOPO ---");
  const materialCounts: Record<string, number> = {};
  (allCompletedWithNullV1 || []).forEach(b => {
    materialCounts[b.materialId] = (materialCounts[b.materialId] || 0) + 1;
  });

  for (const [matId, cnt] of Object.entries(materialCounts)) {
    const isCfc = cfcMaterialIds.includes(matId);
    const cfcMat = cfcMaterials?.find(m => m.id === matId);
    console.log(` - Material '${cfcMat?.originalFileName || matId}': ${cnt} blocos | Pertence ao CFC? ${isCfc ? "SIM ✅" : "NÃO 🔴 (ESTRATÉGIA/LEGADO)"}`);
  }
}

main();
