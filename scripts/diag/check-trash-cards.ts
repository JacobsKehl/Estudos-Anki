import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) return;
  const userId = gabriela.id;

  const revGeral = await prisma.studySubject.findFirst({ where: { name: "Revisão Geral" } });
  const revGeralTrt = await prisma.studySubject.findFirst({ where: { name: "Revisão Geral TRT" } });

  console.log("Cards ainda em Revisão Geral:");
  if (revGeral) {
    const cards = await prisma.flashcard.findMany({
      where: { userId, subjectId: revGeral.id },
      select: { id: true, question: true, answer: true, status: true }
    });
    console.log(cards);
  }

  console.log("Cards ainda em Revisão Geral TRT:");
  if (revGeralTrt) {
    const cards = await prisma.flashcard.findMany({
      where: { userId, subjectId: revGeralTrt.id },
      select: { id: true, question: true, answer: true, status: true }
    });
    console.log(cards);
  }
}

main().finally(() => prisma.$disconnect());
