const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

async function main() {
  const user = await prisma.user.findFirst();
  const userId = user.id;
  console.log("Usuário:", user.name || user.email);

  // Verificar novos campos do schema
  const block = await prisma.studyBlock.findFirst({
    select: {
      id: true,
      title: true,
      theoryStatus: true,
      questionsStatus: true,
      flashcardsStatus: true,
      nextActionType: true,
    }
  });
  console.log("\nSample StudyBlock com novos campos:", block);

  const item = await prisma.studyScheduleItem.findFirst({
    select: {
      id: true,
      actionType: true,
      reason: true,
      priorityScore: true,
    }
  });
  console.log("\nSample StudyScheduleItem com novos campos:", item);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); });
