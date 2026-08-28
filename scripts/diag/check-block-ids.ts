import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const b1 = await prisma.studyBlock.findUnique({
    where: { id: "cmss35fow0007iyaoey50kzf4" },
    select: { id: true, title: true, userId: true, theoryStatus: true, possiblyAlreadyStudied: true }
  });
  const b2 = await prisma.studyBlock.findUnique({
    where: { id: "cmss35g1r0009iyaobhjwwlbd" },
    select: { id: true, title: true, userId: true, theoryStatus: true, possiblyAlreadyStudied: true }
  });

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });

  console.log("Gabriela User ID:", gabriela?.id);
  console.log("Block 1:", b1);
  console.log("Block 2:", b2);
}

main().finally(() => prisma.$disconnect());
