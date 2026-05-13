const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.studyMaterial.updateMany({
    where: { processingStatus: 'PROCESSING' },
    data: { processingStatus: 'PENDING' }
  });
  console.log(`Reset ${result.count} materials to PENDING.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
