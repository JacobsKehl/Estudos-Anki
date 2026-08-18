import fs from "fs";
import path from "path";

async function main() {
  console.log("======================================================================");
  console.log("  INSPEÇÃO B3: OS 8 CARDS DESVINCULADOS DE studyBlockId NO BACKUP    ");
  console.log("======================================================================\n");

  const backupPath = path.join(process.cwd(), "backups/json/pre-auditoria-flashcards/Flashcard.json");
  const reclassPath = path.join(process.cwd(), "reclassificacao-final.json");

  const flashcardsBackup: any[] = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const reclassData = JSON.parse(fs.readFileSync(reclassPath, "utf-8"));
  const reclassList: any[] = Array.isArray(reclassData) ? reclassData : (reclassData.reclassificacoes || reclassData.cards || []);

  const backupMap = new Map(flashcardsBackup.map(c => [c.id, c]));

  const unlinked8: any[] = [];

  reclassList.forEach(item => {
    const originalCard = backupMap.get(item.id);
    if (originalCard && originalCard.studyBlockId !== null) {
      unlinked8.push({
        id: item.id,
        question: originalCard.question.substring(0, 40) + "...",
        previousSubjectId: originalCard.subjectId,
        newSubjectId: item.para_subject_id || item.novo_subject_id || item.para,
        previousStudyBlockId: originalCard.studyBlockId
      });
    }
  });

  console.log(`Total de cards com studyBlockId que foram zerados: ${unlinked8.length}`);
  console.table(unlinked8);
}

main();
