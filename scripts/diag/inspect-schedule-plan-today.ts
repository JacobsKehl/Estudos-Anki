import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getAdaptiveStudyPlan } from "../../src/lib/recommendations/adaptive-scheduler";
import { reorganizeOverdueSchedule } from "../../src/lib/scheduler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase
    .from("User")
    .select("id")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();

  if (!user) return;
  const userId = user.id;

  console.log("======================================================================");
  console.log("    INSPEÇÃO DE TAREFAS RECOMENDADAS PELO ADAPTIVE SCHEDULER          ");
  console.log("======================================================================\n");

  const tasks = await getAdaptiveStudyPlan(userId, { maxNewTheoryPerDay: 2, maxBlockReviewsPerDay: 3 });
  console.log(`Total de tarefas geradas pelo agendador adaptativo: ${tasks.length}`);
  tasks.forEach((t, i) => {
    console.log(` [${i + 1}] Tipo: ${t.type} | Matéria: ${t.subjectName} | Bloco: '${t.blockTitle}' (${t.estimatedMinutes} min)`);
  });

  console.log("\n--- TESTE EM DRY-RUN DE reorganizeOverdueSchedule ---");
  const result = await reorganizeOverdueSchedule(userId, false, true, new Date());
  console.log(`Itens que seriam agendados no rollover:`, JSON.stringify(result, null, 2));
}

main();
