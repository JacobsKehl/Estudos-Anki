/**
 * reaponta-revisoes-orfas.ts
 *
 * As 3 StudyScheduleItem (REVIEW_BLOCK PENDING, cronograma ativo) que apontam para
 * StudyBlock EXCLUDED são reapontadas para o bloco novo equivalente (mesmo materialId,
 * mesmo pageStart/pageEnd, não-EXCLUDED) da reconstrução de 27/08.
 *
 * NADA de DELETE, NADA de SKIPPED: o conteúdo é legítimo, só o registro do bloco morreu.
 *
 * Trava: se para algum item o par (pageStart, pageEnd) do bloco novo não bater EXATAMENTE
 * com o do bloco antigo, o script aborta sem escrever nada.
 *
 * Dry-run por padrão. --apply para executar.
 * Rode o backup-pre-reaponta-revisoes-orfas-2026-09-16.ts ANTES deste script.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";
const ACTIVE_SCHEDULE_ID = "cmt1mofya0001i804r1mql470";

// Lista explícita: item PENDING → bloco antigo (EXCLUDED) → bloco novo (candidato único, achado por leitura)
const REAPONTAMENTOS = [
  { itemId: "cmtas9fy8000hla04cyulht6z", oldBlockId: "cmss35lzw001diyaooztifeec", newBlockId: "cmmtbiihn499j7zrrv5a3u4ma" },
  { itemId: "cmt7weoh9000hjw04jqgpwhjh", oldBlockId: "cmss3610r004biyaohko7qmtu", newBlockId: "cmmtbiihpbpb00p8hh1bfa817" },
  { itemId: "cmt7ycuc3000dl804z51irtpy", oldBlockId: "cmss35rdw002biyao66lb4gyx", newBlockId: "cmmtbiihn4hf5unrg4w8k1yoz" },
];

async function main() {
  const isApply = process.argv.includes("--apply");

  console.log("=================================================================");
  console.log(`  REAPONTAR REVISÕES ÓRFÃS (${isApply ? "⚡ MODO APPLY" : "🔍 MODO DRY-RUN"})`);
  console.log("=================================================================\n");

  const plan: { itemId: string; oldBlockId: string; newBlockId: string }[] = [];

  for (const r of REAPONTAMENTOS) {
    const { data: item, error: itemErr } = await supabase
      .from("StudyScheduleItem")
      .select("id, userId, scheduleId, actionType, status, studyBlockId, scheduledDate")
      .eq("id", r.itemId)
      .single();
    if (itemErr) throw itemErr;

    const { data: oldBlock, error: oldErr } = await supabase
      .from("StudyBlock")
      .select("id, title, pageStart, pageEnd, theoryStatus, materialId")
      .eq("id", r.oldBlockId)
      .single();
    if (oldErr) throw oldErr;

    const { data: newBlock, error: newErr } = await supabase
      .from("StudyBlock")
      .select("id, title, pageStart, pageEnd, theoryStatus, materialId")
      .eq("id", r.newBlockId)
      .single();
    if (newErr) throw newErr;

    console.log(`--- item ${item.id} ---`);
    console.log(`  userId=${item.userId} scheduleId=${item.scheduleId} actionType=${item.actionType} status=${item.status} scheduledDate=${item.scheduledDate}`);
    console.log(`  studyBlockId ATUAL: ${item.studyBlockId}`);
    console.log(`  bloco ANTIGO: [${oldBlock.pageStart}-${oldBlock.pageEnd}] "${oldBlock.title}" theoryStatus=${oldBlock.theoryStatus} materialId=${oldBlock.materialId}`);
    console.log(`  bloco NOVO:   [${newBlock.pageStart}-${newBlock.pageEnd}] "${newBlock.title}" theoryStatus=${newBlock.theoryStatus} materialId=${newBlock.materialId}`);

    // TRAVA 1: escopo — item tem que ser do usuário certo, do schedule ativo, REVIEW_BLOCK PENDING, e apontar hoje para o bloco antigo esperado
    if (item.userId !== userId) throw new Error(`🛑 ABORTADO: item ${item.id} não é da Gabriela (userId=${item.userId})`);
    if (item.scheduleId !== ACTIVE_SCHEDULE_ID) throw new Error(`🛑 ABORTADO: item ${item.id} não está no cronograma ativo (scheduleId=${item.scheduleId})`);
    if (item.actionType !== "REVIEW_BLOCK" || item.status !== "PENDING") throw new Error(`🛑 ABORTADO: item ${item.id} não é REVIEW_BLOCK PENDING (actionType=${item.actionType}, status=${item.status})`);
    if (item.studyBlockId !== r.oldBlockId) throw new Error(`🛑 ABORTADO: item ${item.id} não aponta mais para o bloco antigo esperado (studyBlockId=${item.studyBlockId}, esperado=${r.oldBlockId})`);

    // TRAVA 2: bloco antigo tem que estar de fato EXCLUDED (senão não é órfã)
    if (oldBlock.theoryStatus !== "EXCLUDED") throw new Error(`🛑 ABORTADO: bloco antigo ${oldBlock.id} não está EXCLUDED (theoryStatus=${oldBlock.theoryStatus}) — não é órfã`);

    // TRAVA 3: bloco novo NÃO pode estar EXCLUDED
    if (newBlock.theoryStatus === "EXCLUDED") throw new Error(`🛑 ABORTADO: bloco novo ${newBlock.id} também está EXCLUDED`);

    // TRAVA 4: mesmo materialId (mesmo PDF/matéria)
    if (newBlock.materialId !== oldBlock.materialId) throw new Error(`🛑 ABORTADO: bloco novo ${newBlock.id} é de material diferente do antigo (${newBlock.materialId} != ${oldBlock.materialId})`);

    // TRAVA 5 (a que importa): pageStart/pageEnd têm que bater EXATAMENTE
    if (newBlock.pageStart !== oldBlock.pageStart || newBlock.pageEnd !== oldBlock.pageEnd) {
      throw new Error(
        `🛑 ABORTADO: páginas não batem para item ${item.id}. Antigo=[${oldBlock.pageStart}-${oldBlock.pageEnd}] Novo=[${newBlock.pageStart}-${newBlock.pageEnd}]. NÃO escolha "o mais parecido" — pare e chame o Henrique.`
      );
    }

    console.log(`  ✅ páginas idênticas [${oldBlock.pageStart}-${oldBlock.pageEnd}] — reaponte seguro\n`);

    plan.push({ itemId: item.id, oldBlockId: oldBlock.id, newBlockId: newBlock.id });
  }

  console.log("=================================================================");
  console.log(`  PLANO: ${plan.length} item(ns) terão studyBlockId trocado`);
  console.log("=================================================================");
  plan.forEach((p) => console.log(`  ${p.itemId}: ${p.oldBlockId} → ${p.newBlockId}`));

  if (!isApply) {
    console.log("\n=================================================================");
    console.log("  DRY-RUN CONCLUÍDO. Nenhuma alteração foi feita no banco.");
    console.log("  Rode com '--apply' para executar.");
    console.log("=================================================================\n");
    return;
  }

  console.log("\n=================================================================");
  console.log("  EXECUTANDO — update de studyBlockId, um item por vez");
  console.log("=================================================================\n");

  for (const p of plan) {
    const { error, count } = await supabase
      .from("StudyScheduleItem")
      .update({ studyBlockId: p.newBlockId })
      .eq("id", p.itemId)
      .eq("studyBlockId", p.oldBlockId) // trava extra: só troca se ainda estiver apontando pro antigo
      .select("id");

    if (error) throw new Error(`🛑 Erro ao atualizar item ${p.itemId}: ${error.message}`);
    console.log(`  ✅ ${p.itemId}: studyBlockId → ${p.newBlockId}`);
  }

  console.log("\n=================================================================");
  console.log(`  SUCESSO: ${plan.length} item(ns) reapontados.`);
  console.log("=================================================================\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
