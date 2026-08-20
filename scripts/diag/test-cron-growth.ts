/**
 * test-cron-growth.ts
 *
 * Teste do Item 3:
 * 1. Consulta o número de itens em StudyScheduleItem para 2026-08-20 no banco ATUAL.
 * 2. Simula a chamada de reorganizeActiveSchedule(userId, 30) como o cron faz.
 * 3. Consulta o número de itens para 2026-08-20 IMEDIATAMENTE APÓS.
 * 4. Verifica se a chamada do cron insere novas linhas na tabela.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { reorganizeActiveSchedule } from "@/lib/scheduler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  console.log("=================================================================");
  console.log("  TESTE DO ITEM 3: HIPÓTESE A (REORGANIZEACTIVESCHEDULE INSERE LINHAS?)");
  console.log("=================================================================\n");

  const queryItemsForToday = async () => {
    const { data: items } = await supabase
      .from("StudyScheduleItem")
      .select("id, status, actionType, scheduledDate, createdAt")
      .eq("userId", userId)
      .gte("scheduledDate", "2026-08-20T00:00:00.000Z")
      .lte("scheduledDate", "2026-08-20T23:59:59.999Z");
    return items || [];
  };

  const before = await queryItemsForToday();
  console.log(`📊 Itens em StudyScheduleItem para 2026-08-20 ANTES da reorganização: ${before.length}`);

  console.log(`\n⏳ Executando reorganizeActiveSchedule(userId, 30)...`);
  try {
    const res = await reorganizeActiveSchedule(userId, 30);
    console.log(`   Resultado da reorganização: itens afetados = ${res?.itemsCount}`);
  } catch (err: any) {
    console.error(`   Erro na reorganização:`, err.message);
  }

  const after = await queryItemsForToday();
  console.log(`\n📊 Itens em StudyScheduleItem para 2026-08-20 DEPOIS da reorganização: ${after.length}`);

  if (after.length > before.length) {
    console.log(`\n🔴 HIPÓTESE A CONFIRMADA: reorganizeActiveSchedule INSERIU ${after.length - before.length} NOVA(S) LINHA(S) NO BANCO!`);
  } else if (after.length === before.length) {
    console.log(`\n✅ HIPÓTESE B CONFIRMADA: reorganizeActiveSchedule NÃO inseriu novas linhas para hoje (${before.length} == ${after.length}).`);
  } else {
    console.log(`\nℹ️ Linhas foram removidas (${before.length} → ${after.length}).`);
  }
}

main().catch(console.error);
