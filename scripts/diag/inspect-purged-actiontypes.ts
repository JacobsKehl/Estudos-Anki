import fs from "fs";
import path from "path";

async function main() {
  const p = path.join(process.cwd(), "backups", "json", "pre-limpeza-agenda-completo.json");
  const backup = JSON.parse(fs.readFileSync(p, "utf-8"));

  const allItems = backup.tables?.StudyScheduleItem || backup.items || [];
  console.log("=================================================================");
  console.log("  ANÁLISE DE ACTIONTYPES NO BACKUP PRE-LIMPEZA-AGENDA-COMPLETO");
  console.log("=================================================================\n");

  console.log(`Total de itens registrados no backup: ${allItems.length}`);

  const cfcFiles = [
    "1 - Direito Administrativo_compressed.pdf",
    "2 - Direito do Trabalho.pdf",
    "3 - Direito Constitucional.pdf",
    "4 - Direito Processual do Trabalho.pdf",
    "Direito Processual Civil_compressed.pdf",
  ];

  // Identificar quais itens teriam sido purgados
  const blocksMap = new Map((backup.tables?.StudyBlock || []).map((b: any) => [b.id, b]));
  const materialsMap = new Map((backup.tables?.StudyMaterial || []).map((m: any) => [m.id, m]));

  const purgeCandidates = allItems.filter((it: any) => {
    if (it.status !== "PENDING") return false;
    if (!it.scheduledDate || it.scheduledDate.substring(0, 10) < "2026-08-20") return false;
    const b = blocksMap.get(it.studyBlockId);
    const m = b ? materialsMap.get(b.materialId) : null;
    const matName = m?.originalFileName;
    return !matName || !cfcFiles.includes(matName);
  });

  console.log(`Total de itens purgados a partir de 20/08: ${purgeCandidates.length}\n`);

  const breakdown: Record<string, number> = {};
  for (const it of purgeCandidates) {
    const act = it.actionType || "UNKNOWN";
    breakdown[act] = (breakdown[act] || 0) + 1;
  }

  console.log("📌 Decomposição por actionType dos itens purgados:");
  Object.entries(breakdown).forEach(([act, cnt]) => {
    console.log(`   - ${act.padEnd(25)}: ${cnt} item(ns)`);
  });
}

main().catch(console.error);
