import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const contents = await prisma.extractedContent.findMany({
    where: {
      material: { originalFileName: { contains: "processual civil 16.pdf" } },
      pageNumber: { lte: 25 }
    },
    orderBy: { pageNumber: "asc" },
    select: { pageNumber: true, text: true }
  });

  console.log("=== MATERIAL PROCESSUAL CIVIL 16.PDF (PÁGINAS 1 A 25) ===");
  contents.forEach(c => {
    const textLower = c.text.toLowerCase();
    if (textLower.includes("jurisdição voluntária") || textLower.includes("corrente") || textLower.includes("teoria") || textLower.includes("natureza")) {
      console.log(`\n--- PÁGINA ${c.pageNumber} ---`);
      console.log(c.text.substring(0, 1500));
    }
  });
}

main().finally(() => prisma.$disconnect());
