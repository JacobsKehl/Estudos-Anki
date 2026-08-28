import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("    INVESTIGAÇÃO DOS 5 BLOCOS DUPLICADOS & CARDS ASSOCIADOS (ITEM 2) ");
  console.log("======================================================================\n");

  const targetIds = [
    "cmsxk52in0001jm04xbpimqk0",
    "cmsxk52jt0003jm04kuwpuum4",
    "cmsxk52kg0005jm04owcpff4e",
    "cmsxk52l10007jm04g6oxglkd",
    "cmsxk52ln0009jm04dl3ssbrs"
  ];

  const cardsCount = await prisma.flashcard.count({
    where: {
      studyBlockId: { in: targetIds }
    }
  });

  console.log(`Flashcards vinculados aos 5 blocos duplicados de 17/08: ${cardsCount}`);

  const cards = await prisma.flashcard.findMany({
    where: { studyBlockId: { in: targetIds } },
    select: { id: true, question: true, answer: true, studyBlockId: true, status: true }
  });

  if (cards.length > 0) {
    console.log("--- LISTA DOS CARDS VINCULADOS AOS 5 BLOCOS NOVOS ---");
    console.table(cards);
  } else {
    console.log("✅ Os 5 blocos duplicados criados em 17/08 NÃO POSSUEM NENHUM FLASHCARD VINCULADO no banco de dados.");
  }

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

  // Reverter os 5 blocos: theoryStatus = "NOT_STARTED", theoryCompletedAt = null
  console.log("\nRevertendo o status dos 5 blocos para 'NOT_STARTED' e theoryCompletedAt = null...");
  await prisma.studyBlock.updateMany({
    where: { id: { in: targetIds } },
    data: {
      theoryStatus: "NOT_STARTED",
      theoryCompletedAt: null,
      description: "ISOLADO_DUPLICADO | Re-processamento sobreposto de 17/08/2026"
    }
  });

  // Conferir total de blocos COMPLETED da Gabriela
  const completedBlocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      theoryStatus: "COMPLETED"
    },
    select: { id: true, title: true, theoryCompletedAt: true }
  });

  console.log(`\n--- CONTAGEM DE BLOCOS COM theoryStatus = 'COMPLETED' DA GABRIELA (${completedBlocks.length}) ---`);
  console.table(completedBlocks.map(b => ({
    id: b.id,
    title: b.title.substring(0, 45),
    completedAt: b.theoryCompletedAt?.toISOString() || "NULO"
  })));
}

main().finally(() => prisma.$disconnect());
