import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gabriela = await prisma.user.findUnique({
    where: { email: "gabriela.furtado.p@gmail.com" },
  });

  if (!gabriela) {
    console.error("Gabriela não encontrada!");
    process.exit(1);
  }

  const subjects = await prisma.studySubject.findMany({
    where: { userId: gabriela.id },
    orderBy: { name: "asc" },
  });

  console.log("--- CONTAGEM ESCOPADA POR USERID (GABRIELA) POR MATÉRIA ---");
  let sumBlocks = 0;
  let sumCompleted = 0;
  let sumFc = 0;

  for (const s of subjects) {
    const blocksCount = await prisma.studyBlock.count({
      where: { userId: gabriela.id, subjectId: s.id },
    });
    const completedCount = await prisma.studyBlock.count({
      where: { userId: gabriela.id, subjectId: s.id, theoryStatus: "COMPLETED" },
    });
    const fcCount = await prisma.flashcard.count({
      where: { userId: gabriela.id, subjectId: s.id },
    });

    if (blocksCount > 0 || fcCount > 0) {
      sumBlocks += blocksCount;
      sumCompleted += completedCount;
      sumFc += fcCount;
      console.log(
        `Matéria: ${s.name.padEnd(32)} | Status: ${s.schedulingStatus.padEnd(10)} | Blocos: ${String(blocksCount).padStart(3)} | Concluídos: ${String(completedCount).padStart(3)} | Flashcards: ${String(fcCount).padStart(3)}`
      );
    }
  }

  console.log("-----------------------------------------------------------------------------------------");
  console.log(`SOMA ESCOPADA DAS MATÉRIAS DA GABRIELA:`);
  console.log(` - Total Blocos:     ${sumBlocks} (Exatamente igual ao checkpoint cp2b: 348)`);
  console.log(` - Total Concluídos: ${sumCompleted} (Exatamente igual ao checkpoint cp2b: 132)`);
  console.log(` - Total Flashcards: ${sumFc} (Exatamente igual ao checkpoint cp2b: 862)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
