const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");
dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function main() {
  const extractedPagesCount = await prisma.extractedContent.count();
  const materialsProcessed = await prisma.studyMaterial.findMany({
    where: {
      processingStatus: "PROCESSED"
    },
    select: {
      fileName: true,
      totalPages: true
    }
  });

  const sumTotalPages = materialsProcessed.reduce((acc, m) => acc + (m.totalPages || 0), 0);

  console.log(`=== ESTATÍSTICA DE PÁGINAS LIDAS ===`);
  console.log(`Total de páginas com texto extraído (ExtractedContent): ${extractedPagesCount}`);
  console.log(`Total de páginas de PDFs totalmente processados (PROCESSED): ${sumTotalPages}`);
  console.log(`\nDetalhes por arquivo processado:`);
  materialsProcessed.forEach(m => {
    console.log(`• ${m.fileName}: ${m.totalPages || 0} páginas`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
