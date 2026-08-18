import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const block = await prisma.studyBlock.findUnique({
    where: { id: "cmss361lj004hiyaodwrvf1xa" },
    include: { gapNote: true }
  });

  console.log("======================================================================");
  console.log("ESTADO DO BLOCO RECURSOS TRABALHISTAS EM BANCO:");
  console.log("======================================================================\n");
  console.log(`- ID: ${block?.id}`);
  console.log(`- Title: ${block?.title}`);
  console.log(`- theoryStatus: ${block?.theoryStatus}`);
  console.log(`- userId: ${block?.userId}`);
  console.log(`- gapNote:`, block?.gapNote);
}

main().finally(() => prisma.$disconnect());
