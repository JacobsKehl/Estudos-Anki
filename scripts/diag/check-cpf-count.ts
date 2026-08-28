import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const allExt = await prisma.extractedContent.findMany({ select: { text: true } });
  const cpfRegex = /\b\d{3}\.?:?\s*?\d{3}\.?:?\s*?\d{3}-?\s*?\d{2}\b/g;

  let count = 0;
  for (const ext of allExt) {
    const matches = ext.text.match(cpfRegex);
    if (matches) {
      count += matches.length;
    }
  }

  console.log(`Total de ocorrências de CPF no banco (Node Regex): ${count}`);
}

main().finally(() => prisma.$disconnect());
