import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const b = await prisma.studyBlock.findFirst({
    where: { title: { contains: "8.112" } },
    select: { id: true, title: true }
  });
  console.log("8.112 Block ID:", b);
}

main().finally(() => prisma.$disconnect());
