import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const contents = await prisma.extractedContent.findMany({
    where: {
      material: { originalFileName: { contains: "processual civil 1.pdf" } },
      pageNumber: { lte: 40 }
    },
    orderBy: { pageNumber: "asc" },
    select: { pageNumber: true, text: true }
  });

  console.log("=== MATERIAL PROCESSUAL CIVIL 1.PDF (PÁGINAS 1 A 40) ===");
  contents.forEach(c => {
    const textLower = c.text.toLowerCase();
    if (textLower.includes("jurisdição voluntária") || textLower.includes("voluntária")) {
      console.log(`\n--- PÁGINA ${c.pageNumber} ---`);
      console.log(c.text);
    }
  });
}

main().finally(() => prisma.$disconnect());
