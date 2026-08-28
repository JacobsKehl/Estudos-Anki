import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function main() {
  const migrationDirName = "20260814101000_create_study_block_gap_note";
  const migrationDirPath = path.join(process.cwd(), "prisma", "migrations", migrationDirName);

  if (!fs.existsSync(migrationDirPath)) {
    fs.mkdirSync(migrationDirPath, { recursive: true });
  }

  const sqlFilePath = path.join(migrationDirPath, "migration.sql");

  console.log("Generating migration.sql via prisma migrate diff...");
  const sql = execSync(
    'npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script',
    { encoding: "utf-8" }
  );

  fs.writeFileSync(sqlFilePath, sql, "utf-8");
  console.log(`Migration generated successfully at ${sqlFilePath}`);
  console.log("SQL Preview:\n", sql);
}

main().catch(console.error);
