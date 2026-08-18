import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");

  const blocks = await prisma.studyBlock.findMany({
    where: {
      userId: gabriela.id,
      material: { originalFileName: { contains: "Direito do Trabalho" } }
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      sourceV1BlockId: true,
      possiblyAlreadyStudied: true,
      theoryStatus: true
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Total de blocos em Direito do Trabalho: ${blocks.length}`);
  console.table(blocks.map(b => ({
    id: b.id,
    title: b.title.substring(0, 35),
    created: b.createdAt.toISOString().substring(0, 10),
    sourceV1: b.sourceV1BlockId ? "SIM" : "NÃO",
    possibly: b.possiblyAlreadyStudied ? "SIM" : "NÃO",
    theoryStatus: b.theoryStatus
  })));
}

main().finally(() => prisma.$disconnect());
