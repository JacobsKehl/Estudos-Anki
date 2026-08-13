import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getPrismaModelNames } from "./backup-via-rest";

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

const testUrl = envVars["TEST_TARGET_URL"];
const testApiKey = envVars["TEST_SUPABASE_SERVICE_ROLE_KEY"];

export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJsonStringify).join(",") + "]";
  }

  const sortedKeys = Object.keys(obj).sort();
  const keyValues = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return "{" + keyValues.join(",") + "}";
}

export function computeCanonicalSha256(rows: any[], templateKeys?: string[]): string {
  // Sort rows deterministically by id or composite key
  const sortedRows = [...rows].sort((a, b) => {
    const idA = String(a.id || a.label || JSON.stringify(a));
    const idB = String(b.id || b.label || JSON.stringify(b));
    return idA.localeCompare(idB);
  });

  const projectedRows = sortedRows.map((row) => {
    if (!templateKeys || templateKeys.length === 0) return row;
    const projected: Record<string, any> = {};
    for (const key of templateKeys) {
      projected[key] = row[key] !== undefined ? row[key] : null;
    }
    return projected;
  });

  const canonicalString = canonicalJsonStringify(projectedRows);
  return crypto.createHash("sha256").update(canonicalString, "utf-8").digest("hex");
}

async function fetchTestProjectTable(tableName: string): Promise<any[]> {
  if (!testUrl || !testApiKey) {
    throw new Error("TEST_TARGET_URL ou TEST_SUPABASE_SERVICE_ROLE_KEY não salvas no .env");
  }

  const pageSize = 1000;
  let offset = 0;
  let allRows: any[] = [];

  while (true) {
    const url = `${testUrl}/rest/v1/${tableName}?select=*&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        apikey: testApiKey,
        Authorization: `Bearer ${testApiKey}`,
      },
    });

    if (!res.ok) {
      if (res.status === 404) return [];
      const errText = await res.text();
      throw new Error(`[TEST FETCH ERROR] Tabela '${tableName}' HTTP ${res.status}: ${errText}`);
    }

    const rows: any[] = await res.json();
    allRows = allRows.concat(rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}

async function main() {
  console.log(`\n======================================================================`);
  console.log(`  AUDITORIA DE RESTAURAÇÃO: COMPARAÇÃO HASH SHA-256 (PROD vs TESTE)`);
  console.log(`======================================================================\n`);

  const prodBackupDir = path.join(process.cwd(), "backups", "json", "cp2b-rest");
  if (!fs.existsSync(prodBackupDir)) {
    throw new Error(`Pasta de backup da produção não encontrada em ${prodBackupDir}`);
  }

  const modelNames = getPrismaModelNames();
  let totalDivergences = 0;
  const hashReport: Array<{ table: string; prodCount: number; testCount: number; prodHash: string; testHash: string; status: string }> = [];

  for (const modelName of modelNames) {
    const prodFile = path.join(prodBackupDir, `${modelName}.json`);
    if (!fs.existsSync(prodFile)) continue;

    const prodRows: any[] = JSON.parse(fs.readFileSync(prodFile, "utf-8"));
    const testRows: any[] = await fetchTestProjectTable(modelName);

    if (prodRows.length === 0 && testRows.length === 0) {
      hashReport.push({
        table: modelName,
        prodCount: 0,
        testCount: 0,
        prodHash: "EMPTY",
        testHash: "EMPTY",
        status: "MATCH (EMPTY)",
      });
      continue;
    }

    // Extract template keys from origin JSON row to ignore new migration columns on test DB
    const templateKeys = prodRows.length > 0 ? Object.keys(prodRows[0]) : [];

    const prodHash = computeCanonicalSha256(prodRows, templateKeys);
    const testHash = computeCanonicalSha256(testRows, templateKeys);

    const isMatch = prodHash === testHash && prodRows.length === testRows.length;
    if (!isMatch) totalDivergences++;

    hashReport.push({
      table: modelName,
      prodCount: prodRows.length,
      testCount: testRows.length,
      prodHash: prodHash.substring(0, 12),
      testHash: testHash.substring(0, 12),
      status: isMatch ? "✅ MATCH" : "❌ DIVERGÊNCIA",
    });

    if (!isMatch) {
      console.warn(`\n⚠️ DIVERGÊNCIA DETECTADA NA TABELA '${modelName}':`);
      console.warn(`   Prod Rows: ${prodRows.length} | Test Rows: ${testRows.length}`);
      console.warn(`   Prod Hash: ${prodHash}`);
      console.warn(`   Test Hash: ${testHash}`);

      if (prodRows.length > 0 && testRows.length > 0) {
        console.warn(`   Amostra de linha da Produção (Prod):`, JSON.stringify(prodRows[0], null, 2));
        console.warn(`   Amostra de linha do Teste (Test):`, JSON.stringify(testRows[0], null, 2));
      }
    }
  }

  console.log(`\n----------------------------------------------------------------------`);
  console.log(` TABELA                     | PROD COUNT | TEST COUNT | SHA-256 MATCH `);
  console.log(`----------------------------------------------------------------------`);
  for (const r of hashReport) {
    console.log(` ${r.table.padEnd(26)} | ${String(r.prodCount).padEnd(10)} | ${String(r.testCount).padEnd(10)} | ${r.status}`);
  }
  console.log(`----------------------------------------------------------------------\n`);

  // GABRIELA RECORTE CHECK
  console.log(`\n======================================================================`);
  console.log(`  VERIFICAÇÃO DA BASELINE cp2b NO RECORTE ESPECÍFICO DA GABRIELA`);
  console.log(`======================================================================\n`);

  const userFile = path.join(prodBackupDir, "User.json");
  const blockFile = path.join(prodBackupDir, "StudyBlock.json");
  const fcFile = path.join(prodBackupDir, "Flashcard.json");

  if (fs.existsSync(userFile) && fs.existsSync(blockFile) && fs.existsSync(fcFile)) {
    const users: any[] = JSON.parse(fs.readFileSync(userFile, "utf-8"));
    const blocks: any[] = JSON.parse(fs.readFileSync(blockFile, "utf-8"));
    const fcs: any[] = JSON.parse(fs.readFileSync(fcFile, "utf-8"));

    const gabriela = users.find((u) => u.email === "gabriela.furtado.p@gmail.com");
    if (!gabriela) {
      console.error("❌ Usuária Gabriela Furtado não encontrada no User.json!");
    } else {
      const gabrielaBlocks = blocks.filter((b) => b.userId === gabriela.id);
      const gabrielaCompleted = gabrielaBlocks.filter((b) => b.theoryStatus === "COMPLETED");
      const gabrielaFcs = fcs.filter((f) => f.userId === gabriela.id);
      const gBlockIds = new Set(gabrielaBlocks.map((b) => b.id));
      const gOrphans = gabrielaFcs.filter((f) => f.studyBlockId && !gBlockIds.has(f.studyBlockId));

      console.log(` Gabriela User ID:                       ${gabriela.id}`);
      console.log(` Gabriela: Total StudyBlocks:           ${gabrielaBlocks.length} (Esperado cp2b: 348) -> ${gabrielaBlocks.length === 348 ? "✅ OK" : "❌ INEXATO"}`);
      console.log(` Gabriela: Teoria COMPLETED:            ${gabrielaCompleted.length} (Esperado cp2b: 132) -> ${gabrielaCompleted.length === 132 ? "✅ OK" : "❌ INEXATO"}`);
      console.log(` Gabriela: Total Flashcards:            ${gabrielaFcs.length} (Esperado cp2b: 862) -> ${gabrielaFcs.length === 862 ? "✅ OK" : "❌ INEXATO"}`);
      console.log(` Gabriela: Flashcards Órfãos:           ${gOrphans.length} (Esperado cp2b: 0)   -> ${gOrphans.length === 0 ? "✅ OK" : "❌ INEXATO"}`);

      if (gabrielaBlocks.length !== 348 || gabrielaCompleted.length !== 132 || gabrielaFcs.length !== 862 || gOrphans.length !== 0) {
        totalDivergences++;
      }
    }
  }

  if (totalDivergences > 0) {
    console.error(`\n❌ AUDITORIA FALHOU: ${totalDivergences} divergências encontradas!`);
    process.exit(1);
  } else {
    console.log(`\n🏆 AUDITORIA SHA-256 E RECORTE CP2B DA GABRIELA: 100% APROVADOS E IDÊNTICOS!\n`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
