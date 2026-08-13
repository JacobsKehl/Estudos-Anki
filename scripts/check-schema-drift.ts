import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Load .env variables natively
const envPath = path.join(process.cwd(), ".env");
const envVars: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([\w_]+)\s*=\s*"(.*)"\s*$/) || line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      envVars[match[1]] = match[2].trim();
    }
  }
}

const directUrl = envVars["DIRECT_URL"] || envVars["DATABASE_URL"];

async function main() {
  console.log(`\n======================================================================`);
  console.log(`  AUDITORIA DE SCHEMA DRIFT (SCHEMA.PRISMA vs BANCO REAL)`);
  console.log(`======================================================================\n`);

  if (!directUrl) {
    console.error("Erro: DIRECT_URL ou DATABASE_URL não configuradas no .env");
    process.exit(1);
  }

  console.log("🔍 Verificando se há diferenças (drift) entre o schema do Prisma e o banco de dados...");
  console.log(`   Host da conexão: ${directUrl.replace(/:[^:@]+@/, ":****@")}\n`);

  try {
    const diffOutput = execSync(
      `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-url "${directUrl}" --script`,
      { encoding: "utf-8" }
    );

    const trimmed = diffOutput.trim();

    if (!trimmed || trimmed === "-- This is an empty script.") {
      console.log("✅ NENHUM DRIFT DETECTADO! O schema aplicado no banco está 100% alinhado com o prisma/schema.prisma.\n");
    } else {
      console.warn("⚠️ DRIFT DETECTADO ENTRE O SCHEMA DO PRISMA E O BANCO DE DADOS!");
      console.warn("   Diferenças encontradas:");
      console.warn("----------------------------------------------------------------------");
      console.warn(trimmed);
      console.warn("----------------------------------------------------------------------\n");
    }
  } catch (err: any) {
    console.error("❌ FALHA AO AUDITAR DRIFT (Conexão TCP indisponível ou erro no Prisma CLI):", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
