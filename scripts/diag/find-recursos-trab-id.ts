import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const b = await prisma.studyBlock.findFirst({
    where: { title: { contains: "Recursos Trabalhistas" } },
    select: { id: true, title: true }
  });
  console.log("Recursos Trabalhistas Block:", b);
}

main().finally(() => prisma.$disconnect());
