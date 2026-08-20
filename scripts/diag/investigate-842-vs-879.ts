import fs from "fs";
import path from "path";

async function main() {
  const pComplete = path.join(process.cwd(), "backups", "json", "pre-limpeza-agenda-completo.json");
  const completeData = JSON.parse(fs.readFileSync(pComplete, "utf-8"));
  const completeItems = completeData.tables?.StudyScheduleItem || [];

  const cfcFiles = [
    "1 - Direito Administrativo_compressed.pdf",
    "2 - Direito do Trabalho.pdf",
    "3 - Direito Constitucional.pdf",
    "4 - Direito Processual do Trabalho.pdf",
    "Direito Processual Civil_compressed.pdf",
  ];
  const blocksMap = new Map((completeData.tables?.StudyBlock || []).map((b: any) => [b.id, b]));
  const materialsMap = new Map((completeData.tables?.StudyMaterial || []).map((m: any) => [m.id, m]));

  const nonCfcItems = completeItems.filter((it: any) => {
    const b = blocksMap.get(it.studyBlockId);
    const m = b ? materialsMap.get(b.materialId) : null;
    const matName = m?.originalFileName;
    return !matName || !cfcFiles.includes(matName);
  });

  console.log(`Total de itens não-CFC no backup completo: ${nonCfcItems.length}`);
  const statusBreakdown: Record<string, number> = {};
  for (const it of nonCfcItems) {
    statusBreakdown[it.status || "UNKNOWN"] = (statusBreakdown[it.status || "UNKNOWN"] || 0) + 1;
  }
  console.log("Decomposição por status dos não-CFC:", statusBreakdown);

  const pendingNotCfc = nonCfcItems.filter((it: any) => it.status === "PENDING");
  console.log(`Não-CFC com PENDING: ${pendingNotCfc.length}`);
  const dateBreakdown: Record<string, number> = {};
  for (const it of pendingNotCfc) {
    const d = it.scheduledDate ? it.scheduledDate.substring(0, 10) : "NO_DATE";
    const range = d < "2026-08-20" ? "Passados (<20/08)" : "Futuros (>=20/08)";
    dateBreakdown[range] = (dateBreakdown[range] || 0) + 1;
  }
  console.log("Decomposição por data dos PENDING não-CFC:", dateBreakdown);
}

main().catch(console.error);
