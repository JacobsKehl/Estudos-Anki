import "dotenv/config";
import { fetchAllRowsPaginated } from "../backup-paginated";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: allItems, exactCount } = await fetchAllRowsPaginated("StudyScheduleItem");
  const userPending = allItems.filter((it: any) => it.userId === userId && it.status === "PENDING" && it.scheduledDate && it.scheduledDate.substring(0, 10) >= "2026-08-20");

  console.log("=================================================================");
  console.log("  VERIFICAÇÃO FINAL DA AGENDA LIMPA DE GABRIELA");
  console.log("=================================================================\n");

  console.log(`Total de itens na tabela StudyScheduleItem no banco: ${exactCount}`);
  console.log(`Total de itens PENDING futuros (20/08 em diante):       ${userPending.length}\n`);

  const byDate: Record<string, number> = {};
  for (const it of userPending) {
    const dStr = it.scheduledDate.substring(0, 10);
    byDate[dStr] = (byDate[dStr] || 0) + 1;
  }

  console.log("📌 Itens por dia (Próximos 7 dias):");
  Object.entries(byDate).sort().slice(0, 10).forEach(([d, cnt]) => {
    console.log(`   ${d}: ${cnt} item(ns)`);
  });
}

main().catch(console.error);
