import fs from "fs";
import path from "path";
import { extractProjectRef } from "../src/lib/supabase-ref-extractor";

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

const prodDbUrl = envVars["DIRECT_URL"] || envVars["DATABASE_URL"] || envVars["NEXT_PUBLIC_SUPABASE_URL"];

// FK Dependency Order
const FK_ORDERED_TABLES = [
  "User",
  "SyllabusVersion",
  "SyllabusSubject",
  "SyllabusTopic",
  "StudySubject",
  "StudyMaterial",
  "StudyBlock",
  "Flashcard",
  "FlashcardReview",
  "ExtractedContent",
  "QuestionReviewTask",
  "StudySessionLog",
  "WeeklyStudyConfig",
  "WeeklyStudyTarget",
  "StudyBlockSupport",
];

async function insertRowsPostgREST(targetUrl: string, targetApiKey: string, tableName: string, rows: any[]) {
  if (rows.length === 0) return 0;

  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const url = `${targetUrl}/rest/v1/${tableName}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: targetApiKey,
        Authorization: `Bearer ${targetApiKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal, resolution=merge-duplicates",
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[RESTORE ERROR] Falha ao inserir lote na tabela '${tableName}': HTTP ${res.status} - ${errText}`);
    }

    inserted += batch.length;
  }

  return inserted;
}

async function main() {
  const args = process.argv.slice(2);
  const rotulo = args[0] || "cp2b-rest";
  const targetUrl = args[1] || envVars["TEST_TARGET_URL"] || envVars["NEXT_PUBLIC_SUPABASE_URL"];
  const targetApiKey = args[2] || envVars["SUPABASE_SERVICE_ROLE_KEY"] || envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

  console.log(`\n======================================================================`);
  console.log(`  EXECUTANDO RESTAURAÇÃO VIA POSTGREST (HTTPS 443): [${rotulo}]`);
  console.log(`======================================================================\n`);

  // 1. TRAVA RIGIDA POR PROJECT REF
  const prodRef = extractProjectRef(prodDbUrl);
  const targetRef = extractProjectRef(targetUrl);

  console.log(`  🔒 Ref de Produção Detectado: ${prodRef || "N/A"}`);
  console.log(`  🎯 Ref de Destino Detectado:  ${targetRef || "N/A"}`);

  if (!prodRef || !targetRef) {
    throw new Error(`[TRAVA DE SEGURANÇA] Não foi possível extrair os refs do Supabase de ambos os bancos. Abortando.`);
  }

  if (prodRef === targetRef) {
    throw new Error(`[TRAVA DE SEGURANÇA DESTRUTIVA] O ref de destino '${targetRef}' É IGUAL AO DA PRODUÇÃO ('${prodRef}')! Operação de restauração abortada.`);
  }

  console.log(`  ✅ Trava de Segurança Aprovada: Projeto de Destino '${targetRef}' é diferente de Produção ('${prodRef}').\n`);

  const backupDir = path.join(process.cwd(), "backups", "json", rotulo);
  const manifestPath = path.join(backupDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifesto de backup não encontrado em: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  console.log(`📋 Manifesto Carregado: ${manifest.totalTables} tabelas, ${manifest.totalRecords} registros totais.`);

  let totalInsertedSum = 0;

  for (const tableName of FK_ORDERED_TABLES) {
    const jsonFile = path.join(backupDir, `${tableName}.json`);
    if (!fs.existsSync(jsonFile)) {
      console.log(`  ℹ️ Tabela '${tableName}' não possui arquivo de backup. Pulando.`);
      continue;
    }

    const rows: any[] = JSON.parse(fs.readFileSync(jsonFile, "utf-8"));
    console.log(`📥 Inserindo ${rows.length} registros na tabela '${tableName}' via PostgREST...`);

    const count = await insertRowsPostgREST(targetUrl, targetApiKey!, tableName, rows);
    totalInsertedSum += count;
    console.log(`   -> ${count}/${rows.length} inseridos com sucesso na tabela '${tableName}'.`);
  }

  console.log(`\n======================================================================`);
  console.log(`  COMPARAÇÃO DE RESTAURAÇÃO CONTRA MANIFESTO`);
  console.log(`======================================================================`);
  console.log(` Total Esperado no Manifesto: ${manifest.totalRecords} registros`);
  console.log(` Total Inserido com Sucesso:  ${totalInsertedSum} registros`);

  if (totalInsertedSum !== manifest.totalRecords) {
    throw new Error(`[ERRO DE COMPATIBILIDADE] Total de registros inseridos (${totalInsertedSum}) difere do manifesto (${manifest.totalRecords})!`);
  }

  console.log(`\n🏆 BANCO DE TESTE RESTAURADO E COMPROVADAMENTE IDÊNTICO AO MANIFESTO!\n`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\n❌ ERRO FATAL NA RESTAURAÇÃO VIA REST:", err.message);
    process.exit(1);
  });
}
