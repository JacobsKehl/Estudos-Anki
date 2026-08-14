import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  const blocks = await prisma.studyBlock.findMany({
    where: {
      userId: gabriela.id,
      material: { materialRole: "MAIN_MATERIAL" },
      title: { contains: "Recursos", mode: "insensitive" }
    },
    select: { id: true, title: true, officialTopicId: true }
  });

  console.log("CFC Recursos Blocks:", blocks);
}

main().finally(() => prisma.$disconnect());
