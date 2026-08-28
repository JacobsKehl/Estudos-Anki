import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  const precreditedBlock = await prisma.studyBlock.findFirst({
    where: {
      userId: gabriela.id,
      theoryStatus: "COMPLETED",
      sourceV1BlockId: { not: null }
    },
    select: {
      id: true,
      title: true,
      theoryStatus: true,
      sourceV1BlockId: true,
      possiblyAlreadyStudied: true
    }
  });

  console.log("======================================================================");
  console.log("CONFIRMAÇÃO DO CAMPO sourceV1BlockId PARA BLOCOS PRÉ-CREDITADOS F1");
  console.log("======================================================================\n");
  console.log("Bloco pré-creditado encontrado:", precreditedBlock);
}

main().finally(() => prisma.$disconnect());
