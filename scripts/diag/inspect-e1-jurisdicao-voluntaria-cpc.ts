import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log(" INSPEÇÃO E1 (DETALHADA): JURISDIÇÃO VOLUNTÁRIA NOS PDFs DE PROC. CIVIL ");
  console.log("======================================================================\n");

  const matches = await prisma.extractedContent.findMany({
    where: {
      text: { contains: "jurisdição voluntária", mode: "insensitive" }
    },
    select: {
      id: true,
      pageNumber: true,
      text: true,
      material: { select: { originalFileName: true } }
    }
  });

  console.log(`Encontrados ${matches.length} trechos sobre 'jurisdição voluntária' nos materiais do curso:\n`);

  matches.forEach((m, idx) => {
    console.log(`[Item ${idx + 1}] PDF: '${m.material?.originalFileName}' | Página: ${m.pageNumber}`);
    const lines = m.text.split("\n");
    const matchedLines = lines.filter(l => l.toLowerCase().includes("jurisdição") || l.toLowerCase().includes("voluntária") || l.toLowerCase().includes("doutrina"));
    console.log(matchedLines.slice(0, 15).join("\n"));
    console.log("\n--------------------------------------------------\n");
  });
}

main().finally(() => prisma.$disconnect());
