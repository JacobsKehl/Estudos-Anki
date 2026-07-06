import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const originalUrl = process.env.DATABASE_URL;
const originalDirectUrl = process.env.DIRECT_URL;

if (!originalUrl) {
  console.error("Erro: DATABASE_URL não definida no ambiente.");
  process.exit(1);
}

function getTestUrls(schemaName: string) {
  let testUrl = originalUrl!;
  if (testUrl.includes("schema=")) {
    testUrl = testUrl.replace(/schema=[^&]*/, `schema=${schemaName}`);
  } else {
    const separator = testUrl.includes("?") ? "&" : "?";
    testUrl = `${testUrl}${separator}schema=${schemaName}`;
  }

  let testDirectUrl = originalDirectUrl;
  if (testDirectUrl) {
    if (testDirectUrl.includes("schema=")) {
      testDirectUrl = testDirectUrl.replace(/schema=[^&]*/, `schema=${schemaName}`);
    } else {
      const separator = testDirectUrl.includes("?") ? "&" : "?";
      testDirectUrl = `${testDirectUrl}${separator}schema=${schemaName}`;
    }
  }

  return { testUrl, testDirectUrl };
}

async function runTestEmpty() {
  console.log("\n========================================================");
  console.log("   TESTE 1: APLICANDO TODAS AS MIGRATIONS EM SCHEMA VAZIO");
  console.log("========================================================\n");

  const schemaName = "test_migration_empty";
  const { testUrl, testDirectUrl } = getTestUrls(schemaName);

  const prisma = new PrismaClient({ datasources: { db: { url: originalUrl } } });
  
  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}";`);
    console.log(`Schema "${schemaName}" criado.`);
    await prisma.$disconnect();

    console.log("Executando 'prisma migrate deploy'...");
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testDirectUrl || "" },
      stdio: "inherit"
    });

    console.log("Verificando status...");
    execSync("npx prisma migrate status", {
      env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testDirectUrl || "" },
      stdio: "inherit"
    });

    console.log("✓ TESTE 1 CONCLUÍDO COM SUCESSO!");
  } catch (err: any) {
    console.error("❌ ERRO NO TESTE 1:", err.message);
    throw err;
  } finally {
    const cleanupPrisma = new PrismaClient({ datasources: { db: { url: originalUrl } } });
    await cleanupPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    console.log(`Schema "${schemaName}" removido.`);
    await cleanupPrisma.$disconnect();
  }
}

async function runTestClone() {
  console.log("\n========================================================");
  console.log("   TESTE 2: APLICANDO MIGRATION SEMANAL SOBRE SCHEMA ATUAL");
  console.log("========================================================\n");

  const schemaName = "test_migration_clone";
  const { testUrl, testDirectUrl } = getTestUrls(schemaName);

  const prisma = new PrismaClient({ datasources: { db: { url: originalUrl } } });
  
  // Caminhos das migrations
  const migrationsPath = path.join(process.cwd(), "prisma", "migrations");
  const weeklyMigrationFolder = "20260702155600_add_weekly_review_schema";
  const sourcePath = path.join(migrationsPath, weeklyMigrationFolder);
  const tempDestPath = path.join(process.cwd(), `temp_${weeklyMigrationFolder}`);

  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}";`);
    console.log(`Schema "${schemaName}" criado.`);
    await prisma.$disconnect();

    // Passo A: Mover temporariamente a migração da revisão semanal para fora da pasta de migrations
    console.log(`Ocultando migração semanal: ${weeklyMigrationFolder}`);
    fs.renameSync(sourcePath, tempDestPath);

    // Passo B: Aplicar apenas migrations antigas (baseline + D+15) no clone
    console.log("Aplicando migrations históricas (baseline + D+15) no clone...");
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testDirectUrl || "" },
      stdio: "inherit"
    });

    // Passo C: Restaurar a migração semanal na pasta de migrations
    console.log(`Restaurando migração semanal...`);
    fs.renameSync(tempDestPath, sourcePath);

    // Passo D: Executar migrate deploy para aplicar apenas a nova migração
    console.log("Aplicando migração da revisão semanal sobre o clone do schema atual...");
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testDirectUrl || "" },
      stdio: "inherit"
    });

    console.log("Verificando status...");
    execSync("npx prisma migrate status", {
      env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testDirectUrl || "" },
      stdio: "inherit"
    });

    console.log("✓ TESTE 2 CONCLUÍDO COM SUCESSO!");
  } catch (err: any) {
    console.error("❌ ERRO NO TESTE 2:", err.message);
    // Garantir restauração se falhar
    if (fs.existsSync(tempDestPath)) {
      fs.renameSync(tempDestPath, sourcePath);
    }
    throw err;
  } finally {
    const cleanupPrisma = new PrismaClient({ datasources: { db: { url: originalUrl } } });
    await cleanupPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    console.log(`Schema "${schemaName}" removido.`);
    await cleanupPrisma.$disconnect();
  }
}

async function main() {
  try {
    await runTestEmpty();
    await runTestClone();
    console.log("\n========================================================");
    console.log("   TODOS OS TESTES DE BANCO FORAM CONCLUÍDOS COM SUCESSO!");
    console.log("========================================================\n");
  } catch (err) {
    console.error("Falha nos testes de migração.");
    process.exit(1);
  }
}

main();
