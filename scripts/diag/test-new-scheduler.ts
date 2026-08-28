import "dotenv/config";
import { getAdaptiveStudyPlan } from "@/lib/recommendations/adaptive-scheduler";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  console.log("=================================================================");
  console.log("  TESTE DO NOVO AGENDADOR COM FILTRO CFC, COTA GLOBAL E RODÍZIO");
  console.log("=================================================================\n");

  const queue = await getAdaptiveStudyPlan(userId, { maxNewTheoryPerDay: 2, maxBlockReviewsPerDay: 3 });

  const theoryTasks = queue.filter(t => t.type === "THEORY");
  const reviewBlockTasks = queue.filter(t => t.type === "REVIEW_BLOCK");
  const reviewCardTasks = queue.filter(t => t.type === "REVIEW_FLASHCARDS");

  console.log(`Total de tarefas retornadas na fila adaptativa: ${queue.length}`);
  console.log(`  - THEORY (Teoria nova CFC):       ${theoryTasks.length} bloco(s) [Cota global de 2]`);
  console.log(`  - REVIEW_BLOCK (D3):              ${reviewBlockTasks.length} bloco(s)`);
  console.log(`  - REVIEW_FLASHCARDS (Flashcards): ${reviewCardTasks.length} sessão/ões\n`);

  console.log("📌 Tarefas de Teoria Selecionadas:");
  theoryTasks.forEach((t, idx) => {
    console.log(`   ${idx + 1}. ${t.subjectName}: "${t.blockTitle}" (${t.estimatedMinutes}m, score: ${t.priorityScore})`);
  });
}

main().catch(console.error);
