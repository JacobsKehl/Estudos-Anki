import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) return;
  const userId = gabriela.id;

  console.log("SELECT status, COUNT(*):");
  const statusGroup = await prisma.flashcard.groupBy({
    by: ["status"],
    where: { userId },
    _count: { id: true }
  });
  console.table(statusGroup);

  console.log("CONTAGEM POR MATÉRIA (APPROVED):");
  const activeCards = await prisma.flashcard.findMany({
    where: { userId, status: "APPROVED" },
    select: { subject: { select: { name: true } } }
  });
  const counts: Record<string, number> = {};
  activeCards.forEach(c => {
    const sName = c.subject?.name || "Sem Matéria";
    counts[sName] = (counts[sName] || 0) + 1;
  });
  console.table(counts);

  const trashNames = ["Revisão Geral TRT", "Revisão Geral"];
  const trashSubjects = await prisma.studySubject.findMany({
    where: { name: { in: trashNames } }
  });
  console.log("\nMATÉRIAS-LIXO (Status & Cards):");
  for (const ts of trashSubjects) {
    const cardCount = await prisma.flashcard.count({
      where: { userId, subjectId: ts.id, status: "APPROVED" }
    });
    console.log(`- ${ts.name}: schedulingStatus=${ts.schedulingStatus}, APPROVED cards=${cardCount}`);
  }
}

main().finally(() => prisma.$disconnect());
