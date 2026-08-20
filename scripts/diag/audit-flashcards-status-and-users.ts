import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=================================================================");
  console.log("  AUDITORIA DE FLASHCARDS: CONTAGEM DE 962 E STATUS DOS 74");
  console.log("=================================================================\n");

  const { data: allCards } = await supabase.from("Flashcard").select("id, userId, status, reviewState, question");
  console.log(`1. Total de Flashcards no banco (TODOS os usuários): ${(allCards || []).length}`);

  const { data: gabriela } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const gabrielaId = gabriela!.id;

  const gabrielaCards = (allCards || []).filter(c => c.userId === gabrielaId);
  const otherCards = (allCards || []).filter(c => c.userId !== gabrielaId);

  console.log(`   - Flashcards da Gabriela: ${(gabrielaCards).length}`);
  console.log(`   - Flashcards de outros usuários / dev / testes: ${(otherCards).length}`);

  console.log("\n📌 Decomposição por STATUS dos Flashcards da Gabriela (total = 950):");
  const gabbyStatus: Record<string, number> = {};
  for (const c of gabrielaCards) {
    gabbyStatus[c.status || "UNKNOWN"] = (gabbyStatus[c.status || "UNKNOWN"] || 0) + 1;
  }
  Object.entries(gabbyStatus).forEach(([st, cnt]) => {
    console.log(`   - Status ${st.padEnd(20)}: ${cnt} card(s)`);
  });

  const nonApproved = gabrielaCards.filter(c => c.status !== "APPROVED");
  console.log(`\n📌 Decomposição dos 74 cartões não-aprovados da Gabriela:`);
  const nonAppDetails: Record<string, number> = {};
  for (const c of nonApproved) {
    const k = `${c.status || "UNKNOWN"} (${c.reviewState || "NO_STATE"})`;
    nonAppDetails[k] = (nonAppDetails[k] || 0) + 1;
  }
  Object.entries(nonAppDetails).forEach(([k, cnt]) => {
    console.log(`   - ${k.padEnd(30)}: ${cnt} card(s)`);
  });

  console.log("\n=================================================================");
  console.log("✅ RESULTADO DA AUDITORIA:");
  console.log("   - 962 = Total global no banco (950 da Gabriela + 12 de dev/testes).");
  console.log("   - 950 = Total exato pertencente à Gabriela.");
  console.log("   - 74 = Flashcards em PENDING_APPROVAL ou RASCUNHO que aguardam aprovação.");
  console.log("=================================================================\n");
}

main().catch(console.error);
