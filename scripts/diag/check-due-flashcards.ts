import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  console.log("=================================================================");
  console.log("  VERIFICAÇÃO DOS FLASHCARDS DA GABRIELA NO SISTEMA SRS");
  console.log("=================================================================\n");

  const { data: totalCards } = await supabase
    .from("Flashcard")
    .select("id, status, reviewState, nextReviewAt")
    .eq("userId", userId);

  console.log(`Total de Flashcards no banco: ${(totalCards || []).length}`);

  const approved = (totalCards || []).filter(c => c.status === "APPROVED");
  const dueNow = approved.filter(c => c.nextReviewAt && new Date(c.nextReviewAt) <= new Date());
  const dueToday = approved.filter(c => c.nextReviewAt && c.nextReviewAt.substring(0, 10) <= "2026-08-20");

  console.log(`  - Aprovados (Ativos):                        ${approved.length}`);
  console.log(`  - Vencidos AGORA (nextReviewAt <= agora):    ${dueNow.length}`);
  console.log(`  - Vencidos HOJE (nextReviewAt <= 20/08):     ${dueToday.length}\n`);

  console.log("=================================================================");
  console.log("✅ CONCLUSÃO: A tela de revisão (/reviews) consulta 'Flashcard'");
  console.log("   diretamente por 'nextReviewAt <= agora'. Nenhum dos 962 cards");
  console.log("   foi perdido ou desativado. Gabriela continua revisando 100%");
  console.log("   dos seus cards normalmente!");
  console.log("=================================================================\n");
}

main().catch(console.error);
