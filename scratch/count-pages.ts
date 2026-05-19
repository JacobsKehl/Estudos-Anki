import { prisma } from "../src/lib/prisma";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  // 1. Contagem de registros na tabela ExtractedContent
  const extractedPagesCount = await prisma.extractedContent.count();

  // 2. Soma de totalPages de materiais processados
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

main().catch(console.error);
