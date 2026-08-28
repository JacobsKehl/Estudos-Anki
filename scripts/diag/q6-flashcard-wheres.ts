import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  console.log("=== AUDITORIA DOS 3 NÚMEROS DE FLASHCARDS COM SEUS RESPECTIVOS WHERES ===");

  // 1. Total Global no banco (todas as contas)
  const { count: totalGlobal } = await supabase
    .from("Flashcard")
    .select("id", { count: "exact", head: true });

  console.log(`1. Total Global no Banco: ${totalGlobal}`);
  console.log(`   WHERE: {} (sem filtro de userId)\n`);

  // 2. Total da Gabriela (todos os status)
  const { count: totalGabriela } = await supabase
    .from("Flashcard")
    .select("id", { count: "exact", head: true })
    .eq("userId", userId);

  console.log(`2. Total da Gabriela (todos os status): ${totalGabriela}`);
  console.log(`   WHERE: { userId: "${userId}" }\n`);

  // 3. Status breakdown da Gabriela
  const { data: cards } = await supabase
    .from("Flashcard")
    .select("status, reviewState")
    .eq("userId", userId);

  const statusCount: Record<string, number> = {};
  for (const c of cards || []) {
    statusCount[c.status] = (statusCount[c.status] || 0) + 1;
  }
  console.log("3. Breakdown por status da Gabriela:", statusCount);
}

main().catch(console.error);
