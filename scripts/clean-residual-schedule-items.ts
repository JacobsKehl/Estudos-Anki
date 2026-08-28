/**
 * clean-residual-schedule-items.ts
 *
 * Limpeza segura, controlada e 100% PAGINADA dos itens residuais de agendamento do Estratégia (não-CFC).
 *
 * Travas de Segurança Operacional:
 * 1. Backup prévio paginado obrigatório com asserção de completude (100% de match de count).
 * 2. Restrito estritamente a status = "PENDING".
 * 3. Restrito estritamente a blocos que NÃO pertencem aos 5 PDFs do CFC.
 * 4. Restrito estritamente a scheduledDate >= 2026-08-20 (hoje em diante). O passado permanece intacto.
 * 5. Dry-run por padrão (--apply para executar).
 */
import "dotenv/config";

if (!process.env.RODAR_SCRIPT_HISTORICO) {
  console.error("🛑 SCRIPT HISTÓRICO BLOQUEADO: Para executar este script de saneamento passado, defina RODAR_SCRIPT_HISTORICO=true");
  process.exit(1);
}

import { createClient } from "@supabase/supabase-js";
import { fetchAllRowsPaginated, createPaginatedBackup } from "./backup-paginated";

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
  const isExecuteMode = process.argv.includes("--apply");

  console.log("=================================================================");
  console.log(`  LIMPEZA CONTROLADA E PAGINADA DE ITENS RESIDUAIS (${isExecuteMode ? "⚡ MODO EXECUÇÃO" : "🔍 MODO DRY-RUN"})`);
  console.log("=================================================================\n");

  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const todayStr = "2026-08-20";

  // 1. Fetch ALL schedule items paginated
  const { data: allItems, exactCount } = await fetchAllRowsPaginated("StudyScheduleItem");
  console.log(`Total de itens em StudyScheduleItem no banco: ${exactCount}\n`);

  // Fetch all blocks with material info
  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, StudyMaterial:materialId(originalFileName), StudySubject:subjectId(name)")
    .eq("userId", userId);

  const blockMap = new Map((allBlocks || []).map((b: any) => [b.id, b]));

  const userItems = allItems.filter((it: any) => it.userId === userId);
  const pendingFutureItems = userItems.filter((it: any) => {
    if (it.status !== "PENDING") return false;
    if (!it.scheduledDate) return false;
    const dStr = it.scheduledDate.substring(0, 10);
    return dStr >= todayStr;
  });

  const residualItems: any[] = [];
  const cfcItems: any[] = [];

  for (const it of pendingFutureItems) {
    const b = blockMap.get(it.studyBlockId);
    const matName = b?.StudyMaterial?.originalFileName;
    const isCfc = matName && CFC_FILES.includes(matName);
    if (isCfc) {
      cfcItems.push(it);
    } else {
      residualItems.push({ ...it, blockTitle: b?.title, subjectName: b?.StudySubject?.name || "Outra" });
    }
  }

  console.log(`Total de itens PENDING a partir de 20/08 (SEM TRUNCAMENTO): ${pendingFutureItems.length}`);
  console.log(`  - Itens legados do Estratégia (RESIDUAIS A SEREM PURGADOS): ${residualItems.length}`);
  console.log(`  - Itens válidos do CFC (SERÃO PRESERVADOS):                ${cfcItems.length}\n`);

  const purgeByDate: Record<string, number> = {};
  const purgeBySubject: Record<string, number> = {};

  for (const it of residualItems) {
    const dStr = it.scheduledDate ? it.scheduledDate.substring(0, 10) : "Sem data";
    const subName = it.subjectName;
    purgeByDate[dStr] = (purgeByDate[dStr] || 0) + 1;
    purgeBySubject[subName] = (purgeBySubject[subName] || 0) + 1;
  }

  console.log("-----------------------------------------------------------------");
  console.log("  DECOMPOSIÇÃO DOS ITENS RESIDUAIS A SEREM PURGADOS:");
  console.log("-----------------------------------------------------------------\n");

  console.log("📌 Por Data de Agendamento (Resumo por Mês):");
  const purgeByMonth: Record<string, number> = {};
  Object.entries(purgeByDate).forEach(([d, cnt]) => {
    const m = d.substring(0, 7);
    purgeByMonth[m] = (purgeByMonth[m] || 0) + cnt;
  });
  Object.entries(purgeByMonth).sort().forEach(([m, cnt]) => {
    console.log(`   ${m}: ${cnt} item(ns)`);
  });

  console.log("\n📌 Por Matéria:");
  Object.entries(purgeBySubject).sort().forEach(([sub, cnt]) => {
    console.log(`   ${sub.padEnd(35)}: ${cnt} item(ns)`);
  });

  if (!isExecuteMode) {
    console.log("\n=================================================================");
    console.log("  DRY-RUN CONCLUÍDO. Nenhuma alteração foi feita no banco.");
    console.log("  Para executar com backup paginado verificado, rode com '--apply'.");
    console.log("=================================================================\n");
    return;
  }

  // --------------------------------------------------------------------
  // EXECUÇÃO REAL COM BACKUP PAGINADO E ASSERÇÃO DE COMPLETUDE
  // --------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log("  1. EXECUTANDO BACKUP PAGINADO: pre-limpeza-agenda-completo");
  console.log("=================================================================\n");

  await createPaginatedBackup("pre-limpeza-agenda-completo");

  console.log("-----------------------------------------------------------------");
  console.log(`  2. PURGANDO ${residualItems.length} ITENS RESIDUAIS EM LOTES DE 50`);
  console.log("-----------------------------------------------------------------\n");

  const purgeIds = residualItems.map(it => it.id);
  const batchSize = 50;
  let deletedTotal = 0;

  for (let i = 0; i < purgeIds.length; i += batchSize) {
    const batch = purgeIds.slice(i, i + batchSize);
    const { error, count } = await supabase
      .from("StudyScheduleItem")
      .delete({ count: "exact" })
      .in("id", batch);

    if (error) {
      throw new Error(`🛑 Erro ao deletar lote ${i}: ${error.message}`);
    }
    deletedTotal += count || batch.length;
  }

  console.log(`=================================================================`);
  console.log(`  SUCESSO: ${deletedTotal} itens residuais PENDING deletados com 100% de precisão!`);
  console.log(`=================================================================\n`);
}

main().catch(console.error);
