/**
 * backup-paginated.ts
 *
 * Utility para backup 100% completo e paginado de tabelas do Supabase por HTTPS PostgREST.
 *
 * Funcionalidades:
 * 1. Paginação via .range(from, to) em lotes de 1000 linhas para ignorar qualquer limite do server.
 * 2. Asserção estrita de completude: realiza select("*", { count: "exact" }) e compara count vs exportados.
 * 3. Se a asserção falhar em QUALQUER tabela, a execução aborta imediatamente e NENHUM arquivo é salvo.
 * 4. Salva snapshots em `backups/json/<rotulo>.json`.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES_TO_BACKUP = [
  "User",
  "StudySubject",
  "StudyMaterial",
  "StudyBlock",
  "Flashcard",
  "StudySchedule",
  "StudyScheduleItem",
  "ExtractedContent",
  "StudySessionLog",
];

export async function fetchAllRowsPaginated(tableName: string): Promise<{ data: any[]; exactCount: number }> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let page = 0;
  let exactCount = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = (page + 1) * PAGE_SIZE - 1;

    const { data, count, error } = await supabase
      .from(tableName)
      .select("*", { count: "exact" })
      .range(from, to);

    if (error) {
      throw new Error(`🛑 Erro ao buscar tabela '${tableName}' (pág ${page}): ${error.message}`);
    }

    if (page === 0 && count !== null) {
      exactCount = count;
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
    }

    if (!data || data.length < PAGE_SIZE) {
      break;
    }

    page++;
  }

  if (allRows.length !== exactCount) {
    throw new Error(`🛑 ASSERÇÃO DE COMPLETUDE FALHOU na tabela '${tableName}': Banco tem ${exactCount} linhas, mas foram exportadas ${allRows.length} linhas.`);
  }

  return { data: allRows, exactCount };
}

export async function createPaginatedBackup(label: string): Promise<{ backupPath: string; summaryTable: any[] }> {
  console.log("=================================================================");
  console.log(`  CRIANDO BACKUP PAGINADO COM ASSERÇÃO DE COMPLETUDE [${label}]`);
  console.log("=================================================================\n");

  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user?.id || null;

  const backupData: Record<string, any> = {
    timestamp: new Date().toISOString(),
    label,
    userId,
    tables: {},
  };

  const summaryTable: Array<{ Table: string; DBCount: number; ExportedCount: number; Status: string }> = [];

  for (const table of TABLES_TO_BACKUP) {
    const { data, exactCount } = await fetchAllRowsPaginated(table);
    backupData.tables[table] = data;

    const isOk = data.length === exactCount;
    summaryTable.push({
      Table: table,
      DBCount: exactCount,
      ExportedCount: data.length,
      Status: isOk ? "✅ 100% COMPLETO" : "❌ TRUNCADO",
    });

    console.log(`  [${table.padEnd(20)}] DB Count: ${exactCount.toString().padStart(5)} | Exported: ${data.length.toString().padStart(5)} | ${isOk ? "✅ OK" : "❌ ERRO"}`);
  }

  const backupDir = path.join(process.cwd(), "backups", "json");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const backupPath = path.join(backupDir, `${label}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

  console.log(`\n=================================================================`);
  console.log(`✅ SUCESSO: Backup paginado salvo e verificado em:`);
  console.log(`   ${backupPath}`);
  console.log(`=================================================================\n`);

  return { backupPath, summaryTable };
}

if (process.argv[1] && process.argv[1].endsWith("backup-paginated.ts")) {
  const label = process.argv[2] || "pre-limpeza-agenda";
  createPaginatedBackup(label).catch(console.error);
}
