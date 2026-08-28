/**
 * test-reorganize-with-backup.ts
 *
 * 1. Faz backup seguro de StudyBlock, StudyScheduleItem, StudySchedule com asserção de truncamento.
 * 2. Grava a grade de THEORY ANTES (28/08 a 27/09).
 * 3. Executa reorganizeActiveSchedule(userId, 30) com o código atualizado.
 * 4. Grava a grade de THEORY DEPOIS.
 * 5. Calcula o diff e os 5 portões de integridade contra o blueprint CSV.
 */
import "dotenv/config";

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { reorganizeActiveSchedule } from "../src/lib/scheduler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

// Função para buscar todas as linhas paginadas com asserção estrita
async function fetchAllWithAssertion(table: string) {
  let allRows: any[] = [];
  let page = 0;
  const BATCH = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("userId", userId)
      .range(page * BATCH, (page + 1) * BATCH - 1);

    if (error) throw error;
    if (data && data.length > 0) allRows = allRows.concat(data);
    if (!data || data.length < BATCH) break;
    page++;
  }

  // Verificar contagem real via head
  const { count, error: cErr } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("userId", userId);

  if (cErr) throw cErr;

  if (allRows.length !== count) {
    throw new Error(
      `🚨 ERRO CRÍTICO NO BACKUP: Tabela ${table} truncada! Esperado: ${count}, Obtido: ${allRows.length}`
    );
  }

  return allRows;
}

// Carregar Blueprint CSV para conferência do Lado 5
function loadBlueprintPages(): Map<string, Set<string>> {
  const csvPath = path.resolve(__dirname, "../tmp/BLUEPRINT-blocos-cfc.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean).slice(1);
  const map = new Map<string, Set<string>>(); // materia -> Set("pageStart-pageEnd")

  for (const line of lines) {
    const parts = line.split(",");
    const materia = parts[0].trim();
    const pageStart = parts[6].trim();
    const pageEnd = parts[7].trim();
    if (!map.has(materia)) map.set(materia, new Set());
    map.get(materia)!.add(`${pageStart}-${pageEnd}`);
  }
  return map;
}

async function getTheoryScheduleGrid(startDateStr: string, endDateStr: string) {
  const { data: items, error } = await supabase
    .from("StudyScheduleItem")
    .select(`
      id,
      dayNumber,
      scheduledDate,
      actionType,
      status,
      estimatedMinutes,
      studyBlockId,
      StudyBlock:studyBlockId (
        id,
        title,
        pageStart,
        pageEnd,
        theoryStatus
      ),
      StudySubject:subjectId (
        name
      )
    `)
    .eq("userId", userId)
    .eq("actionType", "THEORY")
    .neq("status", "SKIPPED")
    .gte("scheduledDate", `${startDateStr}T00:00:00-03:00`)
    .lte("scheduledDate", `${endDateStr}T23:59:59-03:00`)
    .order("scheduledDate", { ascending: true })
    .order("dayNumber", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return items || [];
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  PASSO 3: EXECUÇÃO CONTROLADA DO REORGANIZE COM BACKUP");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. BACKUP DEDICADO COM ASSERÇÃO
  console.log("1. Executando backup 'pre-teste-reorganize-28-08'...");
  const blocks = await fetchAllWithAssertion("StudyBlock");
  const items = await fetchAllWithAssertion("StudyScheduleItem");
  const schedules = await fetchAllWithAssertion("StudySchedule");

  const backupData = {
    timestamp: new Date().toISOString(),
    userId,
    counts: {
      StudyBlock: blocks.length,
      StudyScheduleItem: items.length,
      StudySchedule: schedules.length,
    },
    tables: {
      StudyBlock: blocks,
      StudyScheduleItem: items,
      StudySchedule: schedules,
    },
  };

  const backupPath = path.resolve(__dirname, "../backups/json/pre-teste-reorganize-28-08.json");
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf-8");
  console.log(`✅ Backup gravado com sucesso em: ${backupPath}`);
  console.log(`   - StudyBlock: ${blocks.length}`);
  console.log(`   - StudyScheduleItem: ${items.length}`);
  console.log(`   - StudySchedule: ${schedules.length}\n`);

  // 2. GRAVAR GRADE ANTES (28/08 a 27/09)
  console.log("2. Capturando grade ANTES (28/08 a 27/09)...");
  const gridAntes = await getTheoryScheduleGrid("2026-08-28", "2026-09-27");
  console.log(`   Total de itens de THEORY antes: ${gridAntes.length}`);

  // Agrupamento por dia antes
  const byDayAntes: Record<string, typeof gridAntes> = {};
  for (const item of gridAntes) {
    const d = item.scheduledDate.substring(0, 10);
    if (!byDayAntes[d]) byDayAntes[d] = [];
    byDayAntes[d].push(item);
  }
  const dias4Antes = Object.values(byDayAntes).filter(l => l.length >= 4).length;
  console.log(`   Dias com >= 4 blocos antes: ${dias4Antes}\n`);

  // 3. EXECUTAR reorganizeActiveSchedule DIRETO
  console.log("3. Chamando reorganizeActiveSchedule(userId, 30)...");
  const reorgResult = await reorganizeActiveSchedule(userId, 30);
  console.log("   Resultado:", reorgResult, "\n");

  // 4. GRAVAR GRADE DEPOIS (28/08 a 27/09)
  console.log("4. Capturando grade DEPOIS (28/08 a 27/09)...");
  const gridDepois = await getTheoryScheduleGrid("2026-08-28", "2026-09-27");
  console.log(`   Total de itens de THEORY depois: ${gridDepois.length}`);

  const byDayDepois: Record<string, typeof gridDepois> = {};
  for (const item of gridDepois) {
    const d = item.scheduledDate.substring(0, 10);
    if (!byDayDepois[d]) byDayDepois[d] = [];
    byDayDepois[d].push(item);
  }
  const dias4Depois = Object.values(byDayDepois).filter(l => l.length >= 4).length;
  console.log(`   Dias com >= 4 blocos depois: ${dias4Depois}\n`);

  // 5. CALCULAR MÉTRICAS DO DIFF
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  MÉTRICAS DO DIFF (Passo 3.5)");
  console.log("═══════════════════════════════════════════════════════════");

  const blueprintMap = loadBlueprintPages();
  let itensComBlocoExcluded = 0;
  let itensForaDoBlueprint = 0;
  let itensQueMudaramDeBloco = 0;

  const itemAntesMap = new Map(gridAntes.map(i => [i.id, i.studyBlockId]));

  for (const item of gridDepois) {
    const b = item.StudyBlock as any;
    const subName = (item.StudySubject as any)?.name || "";

    // Checar se mudou de bloco
    const prevBlockId = itemAntesMap.get(item.id);
    if (prevBlockId && prevBlockId !== item.studyBlockId) {
      itensQueMudaramDeBloco++;
    }

    // Checar se o bloco é EXCLUDED
    if (b?.theoryStatus === "EXCLUDED") {
      itensComBlocoExcluded++;
    }

    // Checar se as páginas constam no blueprint da matéria
    const bpPages = blueprintMap.get(subName);
    if (b && bpPages) {
      const key = `${b.pageStart}-${b.pageEnd}`;
      if (!bpPages.has(key)) {
        itensForaDoBlueprint++;
      }
    }
  }

  console.log(`ITENS_THEORY_ANTES = ${gridAntes.length}`);
  console.log(`ITENS_THEORY_DEPOIS = ${gridDepois.length}`);
  console.log(`DIAS_COM_4_BLOCOS_ANTES = ${dias4Antes}`);
  console.log(`DIAS_COM_4_BLOCOS_DEPOIS = ${dias4Depois}`);
  console.log(`ITENS_QUE_MUDARAM_DE_BLOCO = ${itensQueMudaramDeBloco}`);
  console.log(`ITENS_COM_BLOCO_EXCLUDED = ${itensComBlocoExcluded} (esperado: 0)`);
  console.log(`ITENS_FORA_DO_BLUEPRINT = ${itensForaDoBlueprint} (esperado: 0)`);
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("Grade dos Próximos 7 Dias DEPOIS:");
  console.log("Data       | Qtd | Blocos");
  console.log("-----------+-----+------------------------------------------------------------------");
  const next7Days = [
    "2026-08-28",
    "2026-08-29",
    "2026-08-30",
    "2026-08-31",
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
  ];
  for (const d of next7Days) {
    const list = byDayDepois[d] || [];
    const desc = list
      .map((i) => {
        const b = i.StudyBlock as any;
        const sub = (i.StudySubject as any)?.name || "";
        return `${sub} [${b?.pageStart}–${b?.pageEnd}]`;
      })
      .join(" | ");
    console.log(`${d} | ${String(list.length).padStart(3)} | ${desc}`);
  }
}

main().catch((err) => {
  console.error("🛑 ERRO NO TESTE:", err);
  process.exit(1);
});
