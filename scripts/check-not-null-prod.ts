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
  const result: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('needsManualReview', 'possiblyAlreadyStudied');
  `);

  console.log("=== VERIFICAÇÃO DE COLUNAS NOT NULL APLICADAS EM PRODUÇÃO ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
