const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log('> Creating _prisma_migrations table if it doesn\'t exist...');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
  
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" CHARACTER VARYING(36) PRIMARY KEY NOT NULL,
        "checksum" CHARACTER VARYING(64) NOT NULL,
        "finished_at" TIMESTAMP WITH TIME ZONE,
        "migration_name" CHARACTER VARYING(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMP WITH TIME ZONE,
        "started_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        "applied_steps_count" INTEGER DEFAULT 0 NOT NULL
      );
    `);
    console.log('> Table _prisma_migrations created/verified successfully.');
  } catch (error) {
    console.error('> Error creating _prisma_migrations table:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
