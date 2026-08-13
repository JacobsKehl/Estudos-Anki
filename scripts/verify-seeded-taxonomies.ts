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
  console.log("=== CONFERÊNCIA DE TAXONOMIAS SEMEADAS EM PRODUÇÃO ===");

  const versions: any[] = await prisma.$queryRawUnsafe(`
    SELECT v.id, v.label, v."isActive", COUNT(t.id)::int as topic_count
    FROM "SyllabusVersion" v
    LEFT JOIN "SyllabusTopic" t ON t."versionId" = v.id
    GROUP BY v.id, v.label, v."isActive"
    ORDER BY v.id;
  `);

  console.table(versions);

  const activeVersions: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, label, "isActive" FROM "SyllabusVersion" WHERE "isActive" = true;
  `);

  console.log(`\nVersões Ativas Encontradas: ${activeVersions.length}`);
  console.log(JSON.stringify(activeVersions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
