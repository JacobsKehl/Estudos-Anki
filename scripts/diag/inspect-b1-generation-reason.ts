import fs from "fs";
import path from "path";

async function main() {
  console.log("======================================================================");
  console.log("    INSPEÇÃO B1: VERIFICAÇÃO DO CAMPO generationReason NO BACKUP      ");
  console.log("======================================================================\n");

  const backupPath = path.join(process.cwd(), "backups/json/pre-auditoria-flashcards/Flashcard.json");
  const auditPath = path.join(process.cwd(), "duplicatas-final.json");

  if (!fs.existsSync(backupPath) || !fs.existsSync(auditPath)) {
    throw new Error("Arquivos de backup ou auditoria não encontrados.");
  }

  const flashcardsBackup: any[] = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const auditData = JSON.parse(fs.readFileSync(auditPath, "utf-8"));
  const auditGroups: any[] = Array.isArray(auditData) ? auditData : (auditData.grupos || auditData.groups || []);

  // Coleta os IDs dos 71 cards arquivados
  const archivedIds: string[] = [];
  auditGroups.forEach(g => {
    if (g.remover && Array.isArray(g.remover)) {
      archivedIds.push(...g.remover);
    }
  });

  console.log(`Total de IDs de cards arquivados pela auditoria: ${archivedIds.length}`);

  const backupMap = new Map(flashcardsBackup.map(c => [c.id, c]));

  let nonNullReasonCount = 0;
  const samplesWithReason: any[] = [];

  archivedIds.forEach(id => {
    const originalCard = backupMap.get(id);
    if (originalCard && originalCard.generationReason !== null && originalCard.generationReason !== undefined && originalCard.generationReason !== "") {
      nonNullReasonCount++;
      samplesWithReason.push({ id, generationReason: originalCard.generationReason });
    }
  });

  console.log(`\nCards dos 71 que possuíam 'generationReason' preenchido ANTES do backup: ${nonNullReasonCount} de ${archivedIds.length}`);
  if (nonNullReasonCount > 0) {
    console.log("Amostras de valores anteriores encontrados:");
    console.log(samplesWithReason.slice(0, 10));
  } else {
    console.log("✅ NENHUM dos 71 cards possuía 'generationReason' preenchido no backup original (todos eram NULL/vazio).");
  }
}

main();
