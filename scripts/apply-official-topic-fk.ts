/**
 * Apply the FK constraint: StudyBlock.officialTopicId → SyllabusTopic.id
 *
 * SAFETY:
 * - Pre-check: verifies 0 orphans before applying
 * - Pre-check: verifies constraint doesn't already exist
 * - Requires --apply flag to execute (dry-run by default)
 */
import { PrismaClient } from "@prisma/client";

// Use DATABASE_URL (transaction pooler, port 6543) since DIRECT_URL (5432) may be blocked
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const DRY_RUN = !process.argv.includes("--apply");

async function main() {
  if (DRY_RUN) {
    console.log("🔒 DRY-RUN MODE (pass --apply to execute)\n");
  } else {
    console.log("⚡ APPLY MODE — will create FK constraint\n");
  }

  // 1. Check if FK already exists
  const existingFk = await prisma.$queryRaw<{ constraint_name: string }[]>`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'StudyBlock'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'StudyBlock_officialTopicId_fkey';
  `;

  if (existingFk.length > 0) {
    console.log("✅ FK StudyBlock_officialTopicId_fkey already exists. Nothing to do.");
    return;
  }

  console.log("FK StudyBlock_officialTopicId_fkey does NOT exist yet.\n");

  // 2. Orphan check (safety gate)
  const orphans = await prisma.$queryRaw<{ orphan_count: bigint }[]>`
    SELECT COUNT(*) as orphan_count
    FROM "StudyBlock" sb
    WHERE sb."officialTopicId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "SyllabusTopic" st WHERE st."id" = sb."officialTopicId"
      );
  `;

  const orphanCount = Number(orphans[0].orphan_count);
  console.log(`Orphan check: ${orphanCount} StudyBlock rows with officialTopicId NOT in SyllabusTopic`);

  if (orphanCount > 0) {
    console.error("❌ ABORTING: Found orphans. Fix data before applying FK constraint.");
    process.exit(1);
  }

  console.log("✅ 0 orphans confirmed.\n");

  // 3. Count rows for snapshot
  const blockCount = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM "StudyBlock";
  `;
  const topicCount = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM "SyllabusTopic";
  `;
  const linkedCount = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM "StudyBlock" WHERE "officialTopicId" IS NOT NULL;
  `;

  console.log("── Snapshot before apply ──");
  console.log(`  StudyBlock total: ${blockCount[0].cnt}`);
  console.log(`  SyllabusTopic total: ${topicCount[0].cnt}`);
  console.log(`  StudyBlock with officialTopicId: ${linkedCount[0].cnt}\n`);

  if (DRY_RUN) {
    console.log("🔒 Would execute:");
    console.log('  ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_officialTopicId_fkey"');
    console.log('    FOREIGN KEY ("officialTopicId") REFERENCES "SyllabusTopic"("id")');
    console.log("    ON DELETE SET NULL ON UPDATE CASCADE;");
    console.log("\nRe-run with --apply to execute.");
    return;
  }

  // 4. Apply
  console.log("Applying FK constraint...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "StudyBlock"
    ADD CONSTRAINT "StudyBlock_officialTopicId_fkey"
    FOREIGN KEY ("officialTopicId")
    REFERENCES "SyllabusTopic"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  `);

  console.log("✅ FK constraint created successfully.\n");

  // 5. Verify
  const verify = await prisma.$queryRaw<{ constraint_name: string }[]>`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'StudyBlock'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'StudyBlock_officialTopicId_fkey';
  `;
  console.log(`Verification: FK exists = ${verify.length > 0}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
