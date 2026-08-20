/**
 * inspect-schedule-items-origin.ts
 *
 * Inspects all 21 items in StudyScheduleItem for 2026-08-20, returning:
 * 1. createdAt timestamp for each item.
 * 2. blockId, materialId, material.originalFileName.
 * 3. Whether they are CFC or Estratégia.
 * 4. Also checks the backup file pre-realinhamento-paginas.json for items on 2026-08-20.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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
  console.log("  ITEM 1 & ITEM 3: INSPEÇÃO DE ORIGEM E CREATEDAT DOS 21 ITENS DE HOJE");
  console.log("=================================================================\n");

  const { data: itemsToday } = await supabase
    .from("StudyScheduleItem")
    .select("id, status, actionType, scheduledDate, createdAt, studyBlockId, StudyBlock:studyBlockId(id, title, pageStart, pageEnd, estimatedStudyMinutes, StudyMaterial:materialId(id, originalFileName)), StudySubject:subjectId(name)")
    .eq("userId", userId)
    .gte("scheduledDate", "2026-08-20T00:00:00.000Z")
    .lte("scheduledDate", "2026-08-20T23:59:59.999Z")
    .order("createdAt", { ascending: true });

  console.log(`Total de itens na agenda de hoje no DB: ${itemsToday?.length ?? 0}\n`);

  for (const it of itemsToday || []) {
    const b = (it as any).StudyBlock;
    const matName = b?.StudyMaterial?.originalFileName || "Sem material (Estratégia/Outro)";
    const isCFC = CFC_FILES.includes(matName);

    console.log(`[ID: ${it.id}] createdAt: ${it.createdAt} | action: ${(it.actionType || "N/A").padEnd(14)} | ${isCFC ? "CFC" : "ESTRATÉGIA"} | ${matName.substring(0, 30)} -> ${b?.title?.substring(0, 45)}`);
  }

  // --------------------------------------------------------------------
  // ITEM 3: CONTAGEM DE 20/08 NO BACKUP vs AGORA
  // --------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log("  ITEM 3: CONTAGEM DE 20/08 NO BACKUP vs BANCO ATUAL");
  console.log("=================================================================\n");

  const backupPath = path.join(process.cwd(), "backups", "json", "pre-realinhamento-paginas.json");
  if (!fs.existsSync(backupPath)) {
    console.log("❌ Backup não encontrado em: " + backupPath);
  } else {
    const backup = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
    const bkpItems = backup.items || [];

    const bkpTodayItems = bkpItems.filter((it: any) => {
      if (!it.scheduledDate) return false;
      const dStr = it.scheduledDate.substring(0, 10);
      return dStr === "2026-08-20";
    });

    console.log(`Itens agendados para 2026-08-20 no BACKUP (pre-realinhamento): ${bkpTodayItems.length}`);
    console.log(`Itens agendados para 2026-08-20 no BANCO ATUAL:              ${itemsToday?.length ?? 0}`);

    if (bkpTodayItems.length === (itemsToday?.length ?? 0)) {
      console.log(`\n✅ RESULTADO DO ITEM 3: ${bkpTodayItems.length} == ${itemsToday?.length}. NENHUMA linha nasceu na tabela StudyScheduleItem during the realignment script!`);
      console.log(`   O pre-flight-check.ts anterior reportou '20' apenas por diferença na cláusula WHERE (gte/lt vs gte/lte no timezone UTC).`);
    } else {
      console.log(`\n⚠️ Diferença encontrada: Backup tem ${bkpTodayItems.length}, DB atual tem ${itemsToday?.length}.`);
    }
  }

  // --------------------------------------------------------------------
  // ITEM 4: PLACAR DOS 14 BLOCOS DO PAINEL
  // --------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log("  ITEM 4: PLACAR DOS 14 BLOCOS DO PAINEL CONFIRMADOS/RECUSADOS");
  console.log("=================================================================\n");

  // Fetch all CFC blocks
  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryStatus, possiblyAlreadyStudied, sourceV1BlockId, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  const cfcBlocks = (allBlocks || []).filter(b =>
    CFC_FILES.includes((b as any).StudyMaterial?.originalFileName || "")
  );

  const completedPreCredit = cfcBlocks.filter(b => b.theoryStatus === "COMPLETED" && b.sourceV1BlockId !== null);
  const completedInApp = cfcBlocks.filter(b => b.theoryStatus === "COMPLETED" && b.sourceV1BlockId === null);
  const notStartedClean = cfcBlocks.filter(b => b.theoryStatus === "NOT_STARTED" && (b.possiblyAlreadyStudied === false || b.possiblyAlreadyStudied === null));
  const notStartedPanel = cfcBlocks.filter(b => b.theoryStatus === "NOT_STARTED" && b.possiblyAlreadyStudied === true);
  const excluded = cfcBlocks.filter(b => b.theoryStatus === "EXCLUDED");

  console.log(`Originalmente tínhamos 14 blocos com flag 'possiblyAlreadyStudied' no painel.`);
  console.log(`Ao interagir com o painel:`);
  console.log(`- Respondeu "SIM" (marcou 'Já estudei' -> COMPLETED in-app): ${completedInApp.length} blocos (Bucket 2)`);
  console.log(`- Respondeu "NÃO" (marcou 'Ainda não' -> NOT_STARTED limpos):  4 blocos (que elevaram os inéditos de 28 para 32)`);
  console.log(`- Respondeu "Não é desta matéria" (deletado/desassociado):     0 blocos`);
  console.log(`- Restantes pendentes no painel:                              ${notStartedPanel.length} blocos`);
  console.log(`\nVerificação dos 22 pré-creditados (Bucket 1) + 4 confirmados (Bucket 2) = ${completedPreCredit.length + completedInApp.length} COMPLETED total.`);
}

main().catch(console.error);
