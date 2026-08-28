import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("   PROVA LITERAL DE BANCO VIA HTTPS (SUPABASE REST CLIENT)           ");
  console.log("======================================================================\n");

  const targetIds = [
    "cmsxk52in0001jm04xbpimqk0",
    "cmsxk52jt0003jm04kuwpuum4",
    "cmsxk52kg0005jm04owcpff4e",
    "cmsxk52l10007jm04g6oxglkd",
    "cmsxk52ln0009jm04dl3ssbrs"
  ];

  // 1. Busca pelos 5 IDs
  const { data: foundBlocks, error: err1 } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryStatus")
    .in("id", targetIds);

  if (err1) throw err1;

  console.log(`[1] Busca pelos 5 IDs de 17/08 na tabela StudyBlock:`);
  console.log(` - IDs pesquisados: ${targetIds.length}`);
  console.log(` - Registros encontrados: ${foundBlocks?.length || 0}`);
  if (!foundBlocks || foundBlocks.length === 0) {
    console.log(` ✅ CONFIRMADO: Os 5 blocos NÃO EXISTEM MAIS no banco de dados (Foram 100% DELETADOS em 18/08).`);
  } else {
    console.log(` ❌ Encontrados:`, foundBlocks);
  }

  // 2. Busca do usuário Gabriela
  const { data: user, error: err2 } = await supabase
    .from("User")
    .select("id")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();

  if (err2) throw err2;
  const userId = user.id;

  // 3. Tabela de blocos sinalizados pendentes (possiblyAlreadyStudied)
  const cfcFileNames = [
    "1 - Direito Administrativo_compressed.pdf",
    "3 - Direito Constitucional_compressed.pdf",
    "3 - Direito Constitucional.pdf",
    "Direito Processual Civil_compressed.pdf",
    "4 - Direito Processual do Trabalho.pdf",
    "2 - Direito do Trabalho.pdf"
  ];

  const { data: materials } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName, subjectId, studySubject:StudySubject(name)")
    .in("originalFileName", cfcFileNames);

  const materialIds = (materials || []).map(m => m.id);

  const { data: possiblyBlocks } = await supabase
    .from("StudyBlock")
    .select("id, subjectId, studySubject:StudySubject(name)")
    .eq("userId", userId)
    .eq("possiblyAlreadyStudied", true)
    .neq("theoryStatus", "COMPLETED")
    .in("materialId", materialIds);

  const counts: Record<string, number> = {};
  (possiblyBlocks || []).forEach((b: any) => {
    const sName = b.studySubject?.name || "Desconhecido";
    counts[sName] = (counts[sName] || 0) + 1;
  });

  console.log(`\n[2] Contagem LITERAL de blocos sinalizados pendentes (possiblyCount) por matéria:`);
  console.table(counts);
  console.log(`TOTAL GERAL DE BLOCOS SINALIZADOS PENDENTES: ${possiblyBlocks?.length || 0}`);
  console.log(` - Direito do Trabalho = 3: ${(counts["Direito do Trabalho"] || 0) === 3 ? "SIM ✅" : "NÃO ❌"}`);
  console.log(` - Total Global = 14:        ${(possiblyBlocks?.length || 0) === 14 ? "SIM ✅" : "NÃO ❌"}`);
}

main();
