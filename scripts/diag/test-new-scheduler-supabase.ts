import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CFC_FILES = [
  "1 - Direito Administrativo_compressed.pdf",
  "2 - Direito do Trabalho.pdf",
  "3 - Direito Constitucional.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "Direito Processual Civil_compressed.pdf",
];

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  console.log("=================================================================");
  console.log("  TESTE DO NOVO AGENDADOR ADAPTATIVO (FILTRO CFC + COTA GLOBAL = 2)");
  console.log("=================================================================\n");

  // Fetch all active subjects
  const { data: subjects } = await supabase
    .from("StudySubject")
    .select("id, name, examWeight, studyPriority")
    .eq("userId", userId)
    .not("studyPriority", "in", "(SECONDARY,EXCLUDED)");

  const tasks: any[] = [];
  const maxNewTheoryPerDay = 2;

  for (const subject of subjects || []) {
    const { data: notStartedBlocks } = await supabase
      .from("StudyBlock")
      .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, orderIndex, theoryStatus, possiblyAlreadyStudied, StudyMaterial:materialId(originalFileName)")
      .eq("userId", userId)
      .eq("subjectId", subject.id)
      .eq("theoryStatus", "NOT_STARTED")
      .is("sourceV1BlockId", null)
      .eq("possiblyAlreadyStudied", false);

    const cfcBlocks = (notStartedBlocks || []).filter((b: any) =>
      b.StudyMaterial?.originalFileName && CFC_FILES.includes(b.StudyMaterial.originalFileName)
    ).sort((a: any, b: any) => a.pageStart - b.pageStart);

    for (const b of cfcBlocks) {
      tasks.push({
        type: "THEORY",
        subjectId: subject.id,
        subjectName: subject.name,
        studyBlockId: b.id,
        blockTitle: b.title,
        estimatedMinutes: b.estimatedStudyMinutes ?? 30,
        priorityScore: (subject.examWeight || 1.0) * 10 + 20,
      });
    }
  }

  // Agrupar por matéria
  const theoryBySubject: Record<string, any[]> = {};
  for (const t of tasks) {
    if (!theoryBySubject[t.subjectId]) theoryBySubject[t.subjectId] = [];
    theoryBySubject[t.subjectId].push(t);
  }

  const selectedTheoryTasks: any[] = [];
  const subjectIds = Object.keys(theoryBySubject);
  subjectIds.sort((a, b) => (theoryBySubject[b][0]?.priorityScore ?? 0) - (theoryBySubject[a][0]?.priorityScore ?? 0));

  for (const subId of subjectIds) {
    if (selectedTheoryTasks.length >= maxNewTheoryPerDay) break;
    const block = theoryBySubject[subId].shift();
    if (block) selectedTheoryTasks.push(block);
  }

  console.log(`Total de tarefas de teoria geradas antes do filtro global: ${tasks.length}`);
  console.log(`Total de tarefas de teoria SELECIONADAS (Cota Global = 2):    ${selectedTheoryTasks.length}\n`);

  console.log("📌 Tarefas de Teoria Selecionadas para o Dia:");
  selectedTheoryTasks.forEach((t, idx) => {
    console.log(`   ${idx + 1}. [${t.subjectName}] "${t.blockTitle}" (${t.estimatedMinutes}m)`);
  });
}

main().catch(console.error);
