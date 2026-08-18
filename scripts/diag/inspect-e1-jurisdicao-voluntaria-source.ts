import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("   INSPEÇÃO E1: CONFERÊNCIA DE JURISDIÇÃO VOLUNTÁRIA NO INSUMO REAL    ");
  console.log("======================================================================\n");

  const matches = await prisma.extractedContent.findMany({
    where: {
      text: { contains: "voluntária", mode: "insensitive" }
    },
    select: {
      id: true,
      pageNumber: true,
      text: true,
      material: { select: { originalFileName: true } }
    },
    take: 10
  });

  console.log(`Encontrados ${matches.length} trechos no ExtractedContent contendo 'voluntária':\n`);

  matches.forEach((m, idx) => {
    console.log(`[Trecho ${idx + 1}] PDF: '${m.material?.originalFileName}' | Página: ${m.pageNumber}`);
    
    // Procura a linha que fala sobre voluntária
    const lines = m.text.split("\n");
    const relevantLines = lines.filter(l => l.toLowerCase().includes("voluntária") || l.toLowerCase().includes("natureza") || l.toLowerCase().includes("doutrina"));
    console.log(`Linhas Relevantes:\n${relevantLines.join("\n")}\n---`);
  });
}

main().finally(() => prisma.$disconnect());
