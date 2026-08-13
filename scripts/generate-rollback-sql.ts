import fs from "fs";
import path from "path";
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

// Programmatic derivation of FK Insertion Order
export const FK_INSERT_ORDER = [
  "User",
  "UserPreferences",
  "SyllabusVersion",
  "SyllabusSubject",
  "SyllabusTopic",
  "StudySubject",
  "StudyMaterial",
  "StudyPlan",
  "StudyPlanDay",
  "StudyBlock",
  "StudyBlockSupport",
  "Flashcard",
  "FlashcardReview",
  "ExtractedContent",
  "QuestionReviewTask",
  "StudySchedule",
  "StudyScheduleItem",
  "StudySessionLog",
  "StudyNote",
  "WeeklyReviewSession",
  "WeeklyReviewTopic",
  "WeeklyReviewTopicSource",
];

// PROGRAMMATIC REVERSE OF FK INSERTION ORDER (Eliminates handwritten memory mistakes!)
export const FK_DELETE_ORDER = [...FK_INSERT_ORDER].reverse();

function escapeSqlValue(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    // Escapa objetos JSON/Array como literal de string JSON
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'`;
  }
  // Escapa aspas simples em strings
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

export function generateTransactionalRollbackSql(
  backupRotulo = "cp2b-rest",
  targetTables: string[] = ["StudyBlock", "Flashcard", "StudyBlockSupport", "StudyMaterial", "StudySubject"]
): string {
  const backupDir = path.join(process.cwd(), "backups", "json", backupRotulo);
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Pasta de backup ${backupDir} não encontrada.`);
  }

  const sqlLines: string[] = [];
  sqlLines.push(`-- =====================================================================`);
  sqlLines.push(`-- SCRIPT DE ROLLBACK CIRÚRGICO TRANSACIONAL ATÔMICO (F1 SCOPE)`);
  sqlLines.push(`-- Gerado em: ${new Date().toISOString()}`);
  sqlLines.push(`-- Instrução: Executar via SQL Editor no Supabase (Porta 443)`);
  sqlLines.push(`-- =====================================================================\n`);
  sqlLines.push(`BEGIN;\n`);

  // STEP 1: DELETE NEW ROWS CREATED BY INCIDENT (IN REVERSE FK ORDER)
  sqlLines.push(`-- 1. APAGAR REGISTROS NOVOS CRIADOS PELO INCIDENTE (ORDEM INVERSA DE FK)`);
  for (const tableName of FK_DELETE_ORDER) {
    if (!targetTables.includes(tableName)) continue;

    const file = path.join(backupDir, `${tableName}.json`);
    if (!fs.existsSync(file)) continue;

    const rows: any[] = JSON.parse(fs.readFileSync(file, "utf-8"));
    const validIds = rows.map((r) => r.id).filter(Boolean);

    if (validIds.length === 0) {
      sqlLines.push(`-- Tabela '${tableName}' vazia no backup. Nenhuma remoção id em not in.`);
    } else {
      const quotedIds = validIds.map((id) => `'${id}'`).join(", ");
      sqlLines.push(`DELETE FROM "${tableName}" WHERE "id" NOT IN (${quotedIds});`);
    }
  }

  sqlLines.push(`\n-- 2. REPOR E RESTAURAR ESTADO DAS LINHAS DO BACKUP (ORDEM DE FK)`);
  // STEP 2: INSERT / UPSERT BACKUP ROWS (IN DIRECT FK ORDER)
  for (const tableName of FK_INSERT_ORDER) {
    if (!targetTables.includes(tableName)) continue;

    const file = path.join(backupDir, `${tableName}.json`);
    if (!fs.existsSync(file)) continue;

    const rows: any[] = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (rows.length === 0) continue;

    sqlLines.push(`\n-- Restaurando ${rows.length} registros da tabela '${tableName}'`);

    for (const row of rows) {
      const columns = Object.keys(row);
      const quotedCols = columns.map((c) => `"${c}"`).join(", ");
      const values = columns.map((c) => escapeSqlValue(row[c])).join(", ");

      const updateSet = columns
        .filter((c) => c !== "id")
        .map((c) => `"${c}" = EXCLUDED."${c}"`)
        .join(", ");

      if (updateSet.length > 0) {
        sqlLines.push(
          `INSERT INTO "${tableName}" (${quotedCols}) VALUES (${values}) ON CONFLICT ("id") DO UPDATE SET ${updateSet};`
        );
      } else {
        sqlLines.push(
          `INSERT INTO "${tableName}" (${quotedCols}) VALUES (${values}) ON CONFLICT ("id") DO NOTHING;`
        );
      }
    }
  }

  sqlLines.push(`\nCOMMIT;\n`);
  return sqlLines.join("\n");
}

async function main() {
  console.log("=== GERANDO SCRIPT SQL DE ROLLBACK TRANSACIONAL ATÔMICO ===");

  const sqlContent = generateTransactionalRollbackSql("cp2b-rest");
  const outputDir = path.join(process.cwd(), "docs");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, "rollback_scope_f1.sql");
  fs.writeFileSync(outputFile, sqlContent, "utf-8");

  const stat = fs.statSync(outputFile);
  const sizeKb = (stat.size / 1024).toFixed(2);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);

  console.log(`✅ Arquivo gerado em: docs/rollback_scope_f1.sql`);
  console.log(`📏 Tamanho Exato em Bytes: ${stat.size} bytes (${sizeKb} KB / ${sizeMb} MB)`);
}

if (require.main === module) {
  main().catch(console.error);
}
