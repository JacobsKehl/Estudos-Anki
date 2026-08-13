import fs from "fs";
import { PrismaClient } from "@prisma/client";

const envContent = fs.readFileSync(".env", "utf-8");
const getVal = (key: string) => {
  const m = envContent.match(new RegExp(`^${key}=["']?(.*?)["']?$`, "m"));
  return m ? m[1].trim() : "";
};

const directUrl = getVal("DIRECT_URL");
const prisma = new PrismaClient({
  datasources: {
    db: { url: directUrl }
  }
});

async function main() {
  console.log("=== AUDITORIA DE ÓRFÃOS EM StudyBlock.officialTopicId (PRODUÇÃO) ===");

  const query = `
    SELECT b.id, b.title, b."officialTopicId", b."subjectId"
    FROM "StudyBlock" b
    LEFT JOIN "SyllabusTopic" t ON b."officialTopicId" = t.id
    WHERE b."officialTopicId" IS NOT NULL
      AND t.id IS NULL;
  `;

  console.log("SQL executado:");
  console.log(query);

  const orphans: any[] = await prisma.$queryRawUnsafe(query);

  console.log(`\nContagem de órfãos em officialTopicId: ${orphans.length}`);
  if (orphans.length > 0) {
    console.table(orphans);
  } else {
    console.log("0 órfãos. É seguro aplicar a FK.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
