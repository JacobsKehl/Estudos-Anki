/**
 * Check current state of production DB to determine which migrations
 * from 4/5/6 are already applied.
 *
 * READ-ONLY: No mutations.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  console.log("=== MIGRATION STATE CHECK ===\n");

  // 1. Check if StudySubject has canonicalKey column
  const ssColumns = await prisma.$queryRaw<{ column_name: string; is_nullable: string; data_type: string }[]>`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'StudySubject'
    ORDER BY ordinal_position;
  `;
  console.log("── StudySubject columns ──");
  for (const c of ssColumns) {
    console.log(`  ${c.column_name} (${c.data_type}, nullable=${c.is_nullable})`);
  }
  const hasCanonicalKey = ssColumns.some((c) => c.column_name === "canonicalKey");
  console.log(`\n  ✅ canonicalKey exists: ${hasCanonicalKey}\n`);

  // 2. Check if StudyBlock has possiblyAlreadyStudied and sourceV1BlockId columns
  const sbColumns = await prisma.$queryRaw<{ column_name: string; is_nullable: string; data_type: string }[]>`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'StudyBlock'
      AND column_name IN ('possiblyAlreadyStudied', 'sourceV1BlockId', 'officialTopicId')
    ORDER BY ordinal_position;
  `;
  console.log("── StudyBlock relevant columns ──");
  for (const c of sbColumns) {
    console.log(`  ${c.column_name} (${c.data_type}, nullable=${c.is_nullable})`);
  }
  const hasPossiblyStudied = sbColumns.some((c) => c.column_name === "possiblyAlreadyStudied");
  const hasSourceV1 = sbColumns.some((c) => c.column_name === "sourceV1BlockId");
  const hasOfficialTopicId = sbColumns.some((c) => c.column_name === "officialTopicId");
  console.log(`\n  ✅ possiblyAlreadyStudied exists: ${hasPossiblyStudied}`);
  console.log(`  ✅ sourceV1BlockId exists: ${hasSourceV1}`);
  console.log(`  ✅ officialTopicId exists: ${hasOfficialTopicId}\n`);

  // 3. Check if FK constraint StudyBlock_officialTopicId_fkey exists
  const fkConstraints = await prisma.$queryRaw<{ constraint_name: string; table_name: string }[]>`
    SELECT constraint_name, table_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'StudyBlock'
      AND constraint_type = 'FOREIGN KEY'
    ORDER BY constraint_name;
  `;
  console.log("── StudyBlock FK constraints ──");
  for (const c of fkConstraints) {
    console.log(`  ${c.constraint_name} (${c.table_name})`);
  }
  const hasOfficialTopicFk = fkConstraints.some((c) => c.constraint_name === "StudyBlock_officialTopicId_fkey");
  console.log(`\n  ✅ StudyBlock_officialTopicId_fkey exists: ${hasOfficialTopicFk}\n`);

  // 4. Check unique indexes on SyllabusTopic
  const topicIndexes = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'SyllabusTopic'
    ORDER BY indexname;
  `;
  console.log("── SyllabusTopic indexes ──");
  for (const i of topicIndexes) {
    console.log(`  ${i.indexname}: ${i.indexdef}`);
  }

  // 5. Check Prisma migrations table
  const migrations = await prisma.$queryRaw<{ migration_name: string; finished_at: Date }[]>`
    SELECT migration_name, finished_at
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL
    ORDER BY finished_at DESC
    LIMIT 12;
  `;
  console.log("\n── Last 12 Prisma migrations ──");
  for (const m of migrations) {
    console.log(`  ${m.migration_name} (${m.finished_at})`);
  }

  // 6. Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Migration 4 (canonicalKey on StudySubject): ${hasCanonicalKey ? "ALREADY APPLIED" : "NEEDS APPLYING"}`);
  console.log(`Migration 4/5 (FK officialTopicId → SyllabusTopic): ${hasOfficialTopicFk ? "ALREADY APPLIED" : "NEEDS APPLYING"}`);
  console.log(`Migration 6 (possiblyAlreadyStudied, sourceV1BlockId): ${hasPossiblyStudied && hasSourceV1 ? "ALREADY APPLIED" : "NEEDS APPLYING"}`);
  console.log(`Migration 7 (SyllabusTopic unique index fix): ${topicIndexes.some(i => i.indexname === "SyllabusTopic_version_subject_topicCode_key") ? "ALREADY APPLIED" : "NEEDS APPLYING"}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
