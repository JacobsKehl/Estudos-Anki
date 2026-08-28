import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("   REVERSÃO DOS 8 CARDS (RESTAURAÇÃO DE subjectId E studyBlockId)    ");
  console.log("======================================================================\n");

  const backupPath = path.join(process.cwd(), "backups", "json", "pre-auditoria-flashcards", "Flashcard.json");
  if (!fs.existsSync(backupPath)) throw new Error(`Backup não encontrado em ${backupPath}`);

  const backupCardsArr: any[] = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const backupMap = new Map<string, { subjectId: string; studyBlockId: string | null }>();
  backupCardsArr.forEach(c => backupMap.set(c.id, { subjectId: c.subjectId, studyBlockId: c.studyBlockId }));

  const targetIds = [
    "cmpvu8fty0001l504639s9dml",
    "cmrqawluh0007ib04bi3zoi4l",
    "cmrqawluh000bib04gj32u6dh",
    "cmq74rcjj0005ia04geic99ea",
    "cmq74rcji0003ia04t81e9yzz",
    "cmq74rcjj0007ia0480ot3cf3",
    "cmrtti8nv000zl704skf7xk4m",
    "cmppzlvps0007le04ndt596f9"
  ];

  console.log(`Revertendo ${targetIds.length} cards para os valores originais do backup pre-auditoria-flashcards...\n`);

  for (const id of targetIds) {
    const orig = backupMap.get(id);
    if (!orig) {
      console.warn(`⚠️ ID ${id} não encontrado no backup! Skipping...`);
      continue;
    }

    await prisma.flashcard.update({
      where: { id },
      data: {
        subjectId: orig.subjectId,
        studyBlockId: orig.studyBlockId
      }
    });

    console.log(`✅ Card [${id}] restaurado: subjectId=${orig.subjectId} | studyBlockId=${orig.studyBlockId}`);
  }

  console.log("\n======================================================================");
  console.log("            REVERSÃO DOS 8 CARDS CONCLUÍDA COM SUCESSO                ");
  console.log("======================================================================\n");
}

main().finally(() => prisma.$disconnect());
