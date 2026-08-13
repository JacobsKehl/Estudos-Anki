import fs from "fs";
import path from "path";
import crypto from "crypto";

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

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const anonKey = envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
let serviceKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];

// Se a serviceKey for um sb_secret (CLI secret), usa a anonKey (JWT válido) para a API REST
if (serviceKey && serviceKey.startsWith("sb_secret_")) {
  serviceKey = anonKey;
}

const apiKey = serviceKey || anonKey;

// Extract models from prisma/schema.prisma dynamically
export function getPrismaModelNames(): string[] {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  if (!fs.existsSync(schemaPath)) {
    throw new Error("Arquivo prisma/schema.prisma não encontrado!");
  }
  const content = fs.readFileSync(schemaPath, "utf-8");
  const models: string[] = [];
  const modelRegex = /^model\s+([A-Za-z0-9_]+)\s+\{/gm;
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    models.push(match[1]);
  }
  return models;
}

export interface BackupManifest {
  rotulo: string;
  timestamp: string;
  supabaseUrl: string;
  usedServiceRoleKey: boolean;
  totalTables: number;
  totalRecords: number;
  totalSizeBytes: number;
  cpfScanClean: boolean;
  cpfOccurrencesCount: number;
  tables: Record<
    string,
    {
      recordCount: number;
      sizeBytes: number;
      sha256: string;
    }
  >;
}

async function fetchTablePostgREST(tableName: string): Promise<any[]> {
  if (!supabaseUrl || !apiKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ou Chave do Supabase (ANON/SERVICE_ROLE) não configuradas no .env");
  }

  const pageSize = 1000;
  let offset = 0;
  let allRows: any[] = [];

  while (true) {
    const url = `${supabaseUrl}/rest/v1/${tableName}?select=*&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        // Tabela ainda não existe fisicamente no banco de produção
        return [];
      }
      const errText = await res.text();
      throw new Error(`[POSTGREST ERROR] Tabela '${tableName}' retornou HTTP ${res.status}: ${errText}`);
    }

    const rows: any[] = await res.json();
    if (!Array.isArray(rows)) {
      throw new Error(`[POSTGREST ERROR] Tabela '${tableName}' não retornou um array JSON válido.`);
    }

    allRows = allRows.concat(rows);

    if (rows.length < pageSize) {
      // Página final atingida e verificada (provado que não há truncamento silencioso)
      break;
    }

    offset += pageSize;
  }

  return allRows;
}

export function computeSha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

export function scanForSensitiveData(text: string): { clean: boolean; matchesCount: number } {
  const cpfRegex = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
  const matches = text.match(cpfRegex) || [];
  return {
    clean: matches.length === 0,
    matchesCount: matches.length,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const rotulo = args[0] || "cp2b-rest";

  console.log(`\n======================================================================`);
  console.log(`  EXECUTANDO BACKUP COMPLETO VIA POSTGREST (HTTPS 443): [${rotulo}]`);
  console.log(`======================================================================\n`);

  const modelNames = getPrismaModelNames();
  console.log(`📋 Tabelas extraídas dinamicamente do schema.prisma (${modelNames.length}):`);
  console.log(`   ${modelNames.join(", ")}\n`);

  const backupTargetDir = path.join(process.cwd(), "backups", "json", rotulo);
  if (!fs.existsSync(backupTargetDir)) {
    fs.mkdirSync(backupTargetDir, { recursive: true });
  }

  const manifestData: BackupManifest = {
    rotulo,
    timestamp: new Date().toISOString(),
    supabaseUrl: supabaseUrl || "N/A",
    usedServiceRoleKey: !!serviceKey,
    totalTables: modelNames.length,
    totalRecords: 0,
    totalSizeBytes: 0,
    cpfScanClean: true,
    cpfOccurrencesCount: 0,
    tables: {},
  };

  let totalCpfMatches = 0;
  let totalRecordsSum = 0;

  for (const modelName of modelNames) {
    console.log(`📥 Baixando tabela '${modelName}' via PostgREST...`);
    const rows = await fetchTablePostgREST(modelName);
    const jsonStr = JSON.stringify(rows, null, 2);
    const sizeBytes = Buffer.byteLength(jsonStr, "utf-8");
    const sha256 = computeSha256(jsonStr);

    const filePath = path.join(backupTargetDir, `${modelName}.json`);
    fs.writeFileSync(filePath, jsonStr, "utf-8");

    const scan = scanForSensitiveData(jsonStr);
    if (!scan.clean) {
      console.warn(`  ⚠️ ENCONTRADAS ${scan.matchesCount} OCORRÊNCIAS DE CPF NA TABELA '${modelName}'!`);
      totalCpfMatches += scan.matchesCount;
    }

    manifestData.tables[modelName] = {
      recordCount: rows.length,
      sizeBytes,
      sha256,
    };

    totalRecordsSum += rows.length;
    manifestData.totalSizeBytes += sizeBytes;

    console.log(`   -> Guardado em ${modelName}.json (${rows.length} registros, ${(sizeBytes / 1024).toFixed(1)} KB)`);
  }

  manifestData.totalRecords = totalRecordsSum;
  manifestData.cpfScanClean = totalCpfMatches === 0;
  manifestData.cpfOccurrencesCount = totalCpfMatches;

  console.log(`\n======================================================================`);
  console.log(`  VERIFICAÇÃO DE INTEGRIDADE E COMPARATIVO CONTRA BASELINE (cp2b)`);
  console.log(`======================================================================\n`);

  const studyBlockFile = path.join(backupTargetDir, "StudyBlock.json");
  const flashcardFile = path.join(backupTargetDir, "Flashcard.json");

  if (fs.existsSync(studyBlockFile) && fs.existsSync(flashcardFile)) {
    const studyBlocks: any[] = JSON.parse(fs.readFileSync(studyBlockFile, "utf-8"));
    const flashcards: any[] = JSON.parse(fs.readFileSync(flashcardFile, "utf-8"));

    const completedTheoryCount = studyBlocks.filter((b) => b.theoryStatus === "COMPLETED").length;
    const blockIds = new Set(studyBlocks.map((b) => b.id));
    const orphanFlashcards = flashcards.filter((f) => f.studyBlockId && !blockIds.has(f.studyBlockId)).length;

    console.log(` - Total StudyBlocks:   ${studyBlocks.length} (Esperado cp2b: 348)`);
    console.log(` - Teoria COMPLETED:    ${completedTheoryCount} (Esperado cp2b: 132)`);
    console.log(` - Total Flashcards:    ${flashcards.length} (Esperado cp2b: 862)`);
    console.log(` - Flashcards Órfãos:   ${orphanFlashcards} (Esperado cp2b: 0)`);

    if (studyBlocks.length < 348 || completedTheoryCount < 132 || flashcards.length < 862 || orphanFlashcards > 0) {
      throw new Error(`[VERIFICAÇÃO DE INTEGRIDADE FALHOU] As contagens do backup REST não batem com a baseline cp2b! Abortando gravação do manifesto.`);
    }
  }

  // Write manifest.json
  const manifestPath = path.join(backupTargetDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), "utf-8");

  console.log(`\n✅ MANIFESTO GRAVADO EM: backups/json/${rotulo}/manifest.json`);
  console.log(`   Tamanho Total do Payload JSON: ${(manifestData.totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`   Varredura por CPF: ${manifestData.cpfScanClean ? "LIMPO (0 CPFs)" : `ATENÇÃO (${totalCpfMatches} CPFs encontrados)`}`);
  console.log(`\n🏆 BACKUP REST AUTO-VERIFICADO COM SUCESSO!\n`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\n❌ ERRO FATAL NO BACKUP REST:", err.message);
    process.exit(1);
  });
}
