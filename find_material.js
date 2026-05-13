const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.studyMaterial.findMany({
    where: { fileName: { contains: 'completo' } },
    select: { id: true, fileName: true, processingStatus: true, processingError: true }
  });
  console.log(JSON.stringify(materials, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
