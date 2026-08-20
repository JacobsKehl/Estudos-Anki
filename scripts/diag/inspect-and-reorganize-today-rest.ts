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
  const { data: user } = await supabase
    .from("User")
    .select("id")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();

  if (!user) return;
  const userId = user.id;

  console.log("======================================================================");
  console.log("    REORGANIZAÇÃO DO CRONOGRAMA DE HOJE (2026-08-19)                  ");
  console.log("======================================================================\n");

  // 1. Buscar todos os itens agendados com data < amanhã e status PENDING/IN_PROGRESS
  const todayStr = "2026-08-19";
  const { data: existingItems } = await supabase
    .from("StudyScheduleItem")
    .select("id, date, status, title, estimatedMinutes, type, studyBlockId")
    .eq("userId", userId)
    .gte("date", `${todayStr}T00:00:00.000Z`)
    .lte("date", `${todayStr}T23:59:59.999Z`);

  console.log(`Itens agendados hoje na tabela StudyScheduleItem: ${existingItems?.length || 0}`);
  (existingItems || []).forEach(item => {
    console.log(` - ID: ${item.id} | Status: ${item.status} | Título: '${item.title}' (${item.estimatedMinutes} min)`);
  });

  // 2. Buscar matérias do CFC
  const { data: cfcMaterials } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName")
    .in("originalFileName", cfcFileNames);

  const cfcMaterialIds = (cfcMaterials || []).map(m => m.id);

  // 3. Buscar blocos inéditos do CFC em ordem de cadastro/prioridade
  const { data: unstudiedBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, subjectId, materialId, StudySubject:subjectId(name)")
    .eq("userId", userId)
    .eq("theoryStatus", "NOT_STARTED")
    .eq("sourceV1BlockId", null)
    .in("materialId", cfcMaterialIds)
    .order("orderIndex", { ascending: true })
    .order("createdAt", { ascending: true });

  console.log(`\nTotal de blocos inéditos disponíveis do CFC: ${unstudiedBlocks?.length || 0}`);

  // Selecionar os 2 primeiros blocos inéditos para o dia de hoje (Cota: 2 inéditos/dia)
  const selectedForToday = (unstudiedBlocks || []).slice(0, 2);

  console.log("\n📌 BLOCOS SELECIONADOS PARA O CRONOGRAMA REORGANIZADO DE HOJE (2 INÉDITOS):");
  selectedForToday.forEach((b, i) => {
    console.log(` ${i + 1}. [${(b.StudySubject as any)?.name}] "${b.title}" (${b.estimatedStudyMinutes ?? 35} min, pp. ${b.pageStart}–${b.pageEnd})`);
  });
}

main();
