const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.studyMaterial.findMany({
    select: { id: true, fileName: true, filePath: true, processingStatus: true }
  });
  console.log(JSON.stringify(materials, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
