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

  // Buscar todas as matérias ativas
  const { data: subjects } = await supabase
    .from("StudySubject")
    .select("id, name, examWeight, studyPriority")
    .eq("userId", user.id)
    .not("studyPriority", "in", '("SECONDARY","EXCLUDED")');

  console.log("======================================================================");
  console.log("    SIMULAÇÃO DO GETADAPTIVESTUDYQUEUE(USERID, 2) NA PÁGINA INICIAL   ");
  console.log("======================================================================\n");

  console.log(`Matérias ativas encontradas: ${subjects?.length || 0}`);

  const allTasks: any[] = [];

  for (const subject of (subjects || [])) {
    // Buscar blocos inéditos do CFC para esta matéria
    const { data: blocks } = await supabase
      .from("StudyBlock")
      .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, orderIndex, createdAt")
      .eq("userId", user.id)
      .eq("subjectId", subject.id)
      .eq("theoryStatus", "NOT_STARTED")
      .is("sourceV1BlockId", null)
      .eq("possiblyAlreadyStudied", false)
      .in("materialId", cfcMaterialIds)
      .order("orderIndex", { ascending: true });

    if (blocks && blocks.length > 0) {
      // Pega até 2 por matéria
      blocks.slice(0, 2).forEach(b => {
        allTasks.push({
          type: "THEORY",
          subjectName: subject.name,
          title: b.title,
          estimatedMinutes: b.estimatedStudyMinutes ?? 35,
          pages: `${b.pageStart}–${b.pageEnd}`,
          blockId: b.id
        });
      });
    }
  }

  console.log(`Total de tarefas teóricas geradas: ${allTasks.length}`);
  allTasks.forEach((t, i) => {
    console.log(` [${i + 1}] Matéria: ${t.subjectName} | Bloco: '${t.title}' (${t.estimatedMinutes} min, pp. ${t.pages})`);
  });

  console.log("\n--- SE A PÁGINA RECEBER O LIMITADOR DE 2 TAREFAS (queue.slice(0, 2)) ---");
  allTasks.slice(0, 2).forEach((t, i) => {
    console.log(` [${i + 1}] Matéria: ${t.subjectName} | Bloco: '${t.title}' (${t.estimatedMinutes} min, pp. ${t.pages})`);
  });
}

main();
