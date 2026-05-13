const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

async function main() {
  // Resetar todos os materiais com erro de worker para IMPORTED
  const result = await prisma.studyMaterial.updateMany({
    where: {
      organizationStatus: "ERROR",
      processingError: { contains: "worker" }
    },
    data: {
      organizationStatus: "IMPORTED",
      processingError: null
    }
  });
  console.log(`Resetados ${result.count} materiais para IMPORTED`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); });
