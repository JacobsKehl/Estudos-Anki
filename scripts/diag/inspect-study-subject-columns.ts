import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const columns: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'StudySubject';
  `);

  console.log("Colunas da tabela StudySubject no banco:");
  console.table(columns);
}

main().finally(() => prisma.$disconnect());
