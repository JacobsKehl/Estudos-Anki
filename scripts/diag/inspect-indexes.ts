import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const indexes: any[] = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('SyllabusVersion', 'SyllabusTopic');
  `);

  console.log("Índices no PostgreSQL:");
  console.table(indexes);
}

main().finally(() => prisma.$disconnect());
