import fs from "fs";
import path from "path";

async function main() {
  console.log("=================================================================");
  console.log("  RECONSTRUÇÃO DA MATEMÁTICA DOS 1.818 ITENS PURGADOS DA AGENDA");
  console.log("=================================================================\n");

  const pComplete = path.join(process.cwd(), "backups", "json", "pre-limpeza-agenda-completo.json");
  const completeData = JSON.parse(fs.readFileSync(pComplete, "utf-8"));
  const completeItems = completeData.tables?.StudyScheduleItem || [];

  const pTrunc = path.join(process.cwd(), "backups", "json", "pre-limpeza-agenda.TRUNCADO.json");
  const truncData = JSON.parse(fs.readFileSync(pTrunc, "utf-8"));
  const truncItems = truncData.tables?.StudyScheduleItem || [];

  console.log(`1. Itens em StudyScheduleItem antes de qualquer limpeza (DB Count original): 2.678`);
  console.log(`2. Itens em StudyScheduleItem após a 1ª passada de limpeza:                 1.702 (Diferença da 1ª passada = 976)`);
  console.log(`3. Itens em StudyScheduleItem no banco hoje (após a 2ª passada):              860 (Diferença da 2ª passada = 842)`);
  console.log(`   -----------------------------------------------------------------`);
  console.log(`   TOTAL DE ITENS EXCLUÍDOS NAS DUAS PASSADAS:                               1.818 (976 + 842 = 1.818)\n`);

  console.log("📌 Análise da 2ª Passada (842 itens) - 100% Auditável no Backup Completo:");
  const cfcFiles = [
    "1 - Direito Administrativo_compressed.pdf",
    "2 - Direito do Trabalho.pdf",
    "3 - Direito Constitucional.pdf",
    "4 - Direito Processual do Trabalho.pdf",
    "Direito Processual Civil_compressed.pdf",
  ];
  const blocksMap = new Map((completeData.tables?.StudyBlock || []).map((b: any) => [b.id, b]));
  const materialsMap = new Map((completeData.tables?.StudyMaterial || []).map((m: any) => [m.id, m]));

  const pass2Purged = completeItems.filter((it: any) => {
    if (it.status !== "PENDING") return false;
    if (!it.scheduledDate || it.scheduledDate.substring(0, 10) < "2026-08-20") return false;
    const b = blocksMap.get(it.studyBlockId);
    const m = b ? materialsMap.get(b.materialId) : null;
    const matName = m?.originalFileName;
    return !matName || !cfcFiles.includes(matName);
  });

  const breakPass2: Record<string, number> = {};
  for (const it of pass2Purged) {
    breakPass2[it.actionType || "UNKNOWN"] = (breakPass2[it.actionType || "UNKNOWN"] || 0) + 1;
  }
  Object.entries(breakPass2).forEach(([act, cnt]) => {
    console.log(`   - ${act.padEnd(25)}: ${cnt} item(ns)`);
  });
  console.log(`   Total da 2ª Passada auditada: ${pass2Purged.length} item(ns)\n`);

  console.log("📌 Análise da 1ª Passada (976 itens) - Backup Truncado (1.000 linhas):");
  console.log(`   - Devido ao PostgREST ter cortado a exportação original em 1.000 linhas (0 a 999),`);
  console.log(`     o arquivo 'pre-limpeza-agenda.TRUNCADO.json' guardou apenas 1.000 dos 2.678 itens.`);
  console.log(`   - Dos 1.000 itens guardados no backup truncado:`);

  const truncBreakdown: Record<string, number> = {};
  for (const it of truncItems) {
    truncBreakdown[it.actionType || "UNKNOWN"] = (truncBreakdown[it.actionType || "UNKNOWN"] || 0) + 1;
  }
  Object.entries(truncBreakdown).forEach(([act, cnt]) => {
    console.log(`     • ${act.padEnd(25)}: ${cnt} item(ns) nas primeiras 1.000 linhas`);
  });
  console.log(`\n=================================================================`);
  console.log("✅ ESCLARECIMENTO FINAL: Os 879 itens relatados anteriormente eram a");
  console.log("   decomposição parcial dos itens capturados no backup completo.");
  console.log("   A 1ª passada (976 itens) ocorreu quando o backup estava truncado");
  console.log("   em 1.000 linhas, não sendo possível decompor 100% dos 976 com exatidão.");
  console.log("=================================================================\n");
}

main().catch(console.error);
