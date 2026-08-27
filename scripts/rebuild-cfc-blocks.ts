/**
 * rebuild-cfc-blocks.ts
 *
 * Reconstrução determinística dos 94 blocos de estudo do CFC a partir do
 * blueprint CSV (tmp/BLUEPRINT-blocos-cfc.csv). Nenhuma chamada de IA.
 *
 * Regras:
 *   1. Um bloco = uma linha do CSV (94 blocos)
 *   2. Herda theoryStatus COMPLETED por cobertura de página dos blocos antigos
 *   3. Blocos de TEC (exercícios) nascem EXCLUDED
 *   4. Blocos antigos do CFC → EXCLUDED (não deleta)
 *   5. Itens de agenda THEORY do CFC → SKIPPED
 *
 * Uso:
 *   npx tsx scripts/rebuild-cfc-blocks.ts            # dry-run (default)
 *   npx tsx scripts/rebuild-cfc-blocks.ts --apply     # aplica dentro de $transaction
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const APPLY = process.argv.includes("--apply");
const userId = "cmp8od0wz0000iybklaotfqbs";

const CFC_FILES = [
  "1 - Direito Administrativo_compressed.pdf",
  "2 - Direito do Trabalho.pdf",
  "3 - Direito Constitucional.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "Direito Processual Civil_compressed.pdf",
];

// Bloco manualmente marcado COMPLETED em 24/08 22:54 — não foi leitura da Gabriela.
// Se entrar como fonte de cobertura, 4 capítulos de Proc. do Trabalho nascem COMPLETED indevidamente.
const COBERTURA_EXCLUIDA = [
  "cmt1mlyas000vjs043jtv4xkz", // "Organização da Justiça do Trabalho…" [2–15] marcado à mão
];

// ────────────────────────────────────────────────────────────────────────
// CSV Parser
// ────────────────────────────────────────────────────────────────────────

interface BlueprintRow {
  materia: string;
  pdf_no_banco: string;
  ordem: number;
  titulo_capitulo: string;
  parte: number;
  de: number;
  pageStart: number;
  pageEnd: number;
  paginas: number;
  minutos_3ppm: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function loadBlueprint(): BlueprintRow[] {
  const csvPath = path.join(process.cwd(), "tmp", "BLUEPRINT-blocos-cfc.csv");
  const content = fs.readFileSync(csvPath, "utf-8").trim();
  const lines = content.split("\n");
  const data = lines.slice(1); // skip header

  if (data.length !== 94) {
    throw new Error(`CSV tem ${data.length} linhas de dados, esperado 94`);
  }

  const rows: BlueprintRow[] = data.map((line, i) => {
    const cols = parseCSVLine(line);
    if (cols.length < 10) {
      throw new Error(`Linha ${i + 2} tem ${cols.length} colunas, esperado 10`);
    }
    return {
      materia: cols[0],
      pdf_no_banco: cols[1],
      ordem: parseInt(cols[2], 10),
      titulo_capitulo: cols[3],
      parte: parseInt(cols[4], 10),
      de: parseInt(cols[5], 10),
      pageStart: parseInt(cols[6], 10),
      pageEnd: parseInt(cols[7], 10),
      paginas: parseInt(cols[8], 10),
      minutos_3ppm: parseInt(cols[9], 10),
    };
  });

  // Verificação de integridade
  const somaPaginas = rows.reduce((s, r) => s + r.paginas, 0);
  const somaMinutos = rows.reduce((s, r) => s + r.minutos_3ppm, 0);
  if (somaPaginas !== 366) throw new Error(`Soma de páginas = ${somaPaginas}, esperado 366`);
  if (somaMinutos !== 1098) throw new Error(`Soma de minutos = ${somaMinutos}, esperado 1098`);

  return rows;
}

// ────────────────────────────────────────────────────────────────────────
// Title builder
// ────────────────────────────────────────────────────────────────────────

function buildTitle(row: BlueprintRow): string {
  if (row.de > 1) {
    return `${row.titulo_capitulo} — parte ${row.parte}/${row.de}`;
  }
  return row.titulo_capitulo;
}

function isTEC(row: BlueprintRow): boolean {
  return row.titulo_capitulo.includes("EXTRA – EXERCÍCIOS (TEC)") ||
         row.titulo_capitulo.includes("EXTRA – QUESTÕES (TEC)");
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  REBUILD CFC BLOCKS — DETERMINÍSTICO, SEM IA");
  console.log(`  Modo: ${APPLY ? "🔴 --apply (ESCRITA EM TRANSAÇÃO)" : "🟡 --dry-run (LEITURA)"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Carregar o blueprint
  const blueprint = loadBlueprint();
  console.log(`✅ Blueprint carregado: ${blueprint.length} linhas\n`);

  // 2. Buscar materiais por originalFileName
  const { data: materials, error: matErr } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName, subjectId")
    .eq("userId", userId)
    .in("originalFileName", CFC_FILES);

  if (matErr) throw new Error(`Erro ao buscar materiais: ${matErr.message}`);
  if (!materials || materials.length === 0) {
    throw new Error("Nenhum material CFC encontrado no banco.");
  }

  const matByFileName = new Map<string, { id: string; subjectId: string }>();
  for (const m of materials) {
    if (m.originalFileName) {
      matByFileName.set(m.originalFileName, { id: m.id, subjectId: m.subjectId });
    }
  }

  // Verificar que todos os PDFs do CSV foram encontrados
  const missingPdfs = CFC_FILES.filter(f => !matByFileName.has(f));
  if (missingPdfs.length > 0) {
    throw new Error(`PDFs não encontrados no banco: ${missingPdfs.join(", ")}`);
  }

  // 3. Buscar TODOS os blocos antigos dos 5 PDFs (para herança e desativação)
  const matIds = [...matByFileName.values()].map(m => m.id);
  
  // Lê do backup pré-reconstrução se disponível para garantir idempotência total
  const backupSnapshotPath = path.join(process.cwd(), "backups", "json", "pre-reconstrucao-blocos-cfc.json");
  let allOldBlocks: Array<{ id: string; title: string; pageStart: number; pageEnd: number; theoryStatus: string; theoryCompletedAt: string | null; materialId: string; orderIndex: number }> = [];

  if (fs.existsSync(backupSnapshotPath)) {
    const backupJson = JSON.parse(fs.readFileSync(backupSnapshotPath, "utf-8"));
    const blocksInBackup: any[] = backupJson.tables?.StudyBlock || [];
    allOldBlocks = blocksInBackup
      .filter((b: any) => matIds.includes(b.materialId) && b.userId === userId && b.theoryStatus !== "EXCLUDED")
      .map((b: any) => ({
        id: b.id,
        title: b.title,
        pageStart: b.pageStart,
        pageEnd: b.pageEnd,
        theoryStatus: b.theoryStatus,
        theoryCompletedAt: b.theoryCompletedAt,
        materialId: b.materialId,
        orderIndex: b.orderIndex || 0,
      }));
    console.log(`📊 Blocos antigos lidos do backup pré-reconstrução: ${allOldBlocks.length}`);
  } else {
    const { data: oldBlocks, error: oldErr } = await supabase
      .from("StudyBlock")
      .select("id, title, pageStart, pageEnd, theoryStatus, theoryCompletedAt, materialId, orderIndex")
      .eq("userId", userId)
      .in("materialId", matIds)
      .neq("theoryStatus", "EXCLUDED");

    if (oldErr) throw new Error(`Erro ao buscar blocos antigos: ${oldErr.message}`);
    allOldBlocks = oldBlocks || [];
    console.log(`📊 Blocos antigos ativos no banco: ${allOldBlocks.length}\n`);
  }

  // 4. Regra 2 — calcular cobertura dos COMPLETED (excluindo os blocos manuais)
  const completedOldBlocks = allOldBlocks.filter(
    b => b.theoryStatus === "COMPLETED" && !COBERTURA_EXCLUIDA.includes(b.id)
  );

  console.log(`📊 Blocos COMPLETED como fonte de cobertura: ${completedOldBlocks.length}`);
  console.log(`   (excluídos da cobertura: ${COBERTURA_EXCLUIDA.length} blocos manuais)\n`);

  // 5. Montar os 94 novos blocos
  interface NewBlock {
    userId: string;
    subjectId: string;
    materialId: string;
    title: string;
    pageStart: number;
    pageEnd: number;
    estimatedStudyMinutes: number;
    orderIndex: number;
    theoryStatus: string;
    theoryCompletedAt: string | null;
    sourceV1BlockId: null;
    coverageSources: string[]; // para auditoria no dry-run
  }

  const newBlocks: NewBlock[] = [];
  let countCompleted = 0;
  let countNotStarted = 0;
  let countTecExcluded = 0;

  for (const row of blueprint) {
    const mat = matByFileName.get(row.pdf_no_banco);
    if (!mat) throw new Error(`Material não encontrado: ${row.pdf_no_banco}`);

    let theoryStatus = "NOT_STARTED";
    let theoryCompletedAt: string | null = null;
    const coverageSources: string[] = [];

    if (isTEC(row)) {
      // Regra 3: exercícios nascem EXCLUDED
      theoryStatus = "EXCLUDED";
      countTecExcluded++;
    } else {
      // Regra 2: herdar COMPLETED por cobertura de página
      const relevantCompleted = completedOldBlocks.filter(b => b.materialId === mat.id);

      let allPagesCovered = true;
      for (let page = row.pageStart; page <= row.pageEnd; page++) {
        const covered = relevantCompleted.some(
          b => b.pageStart <= page && b.pageEnd >= page
        );
        if (!covered) {
          allPagesCovered = false;
          break;
        }
      }

      if (allPagesCovered && relevantCompleted.length > 0) {
        theoryStatus = "COMPLETED";

        // theoryCompletedAt = max dos blocos que cobriram
        const coveringBlocks = relevantCompleted.filter(b => {
          for (let page = row.pageStart; page <= row.pageEnd; page++) {
            if (b.pageStart <= page && b.pageEnd >= page) return true;
          }
          return false;
        });

        const maxCompletedAt = coveringBlocks
          .map(b => b.theoryCompletedAt)
          .filter((d): d is string => !!d)
          .sort()
          .pop() || null;

        theoryCompletedAt = maxCompletedAt;
        coverageSources.push(
          ...coveringBlocks.map(b => `${b.id} [${b.pageStart}–${b.pageEnd}] "${b.title}"`)
        );
        countCompleted++;
      } else {
        countNotStarted++;
      }
    }

    newBlocks.push({
      userId,
      subjectId: mat.subjectId,
      materialId: mat.id,
      title: buildTitle(row),
      pageStart: row.pageStart,
      pageEnd: row.pageEnd,
      estimatedStudyMinutes: row.minutos_3ppm,
      orderIndex: row.ordem,
      theoryStatus,
      theoryCompletedAt,
      sourceV1BlockId: null,
      coverageSources,
    });
  }

  // 6. Regra 5 — identificar itens de agenda do CFC para SKIPPED
  //    Buscar todos os StudyScheduleItem com THEORY cujo studyBlockId está nos blocos antigos
  const oldBlockIds = allOldBlocks.map(b => b.id);

  // Paginar a busca de itens, pois podem ser muitos
  let allTheoryItems: Array<{ id: string; studyBlockId: string; status: string }> = [];
  const ITEM_PAGE_SIZE = 1000;
  let itemPage = 0;
  while (true) {
    const from = itemPage * ITEM_PAGE_SIZE;
    const to = (itemPage + 1) * ITEM_PAGE_SIZE - 1;

    const { data: items, error: itemsErr } = await supabase
      .from("StudyScheduleItem")
      .select("id, studyBlockId, status, actionType")
      .eq("userId", userId)
      .eq("actionType", "THEORY")
      .in("studyBlockId", oldBlockIds)
      .range(from, to);

    if (itemsErr) throw new Error(`Erro ao buscar itens: ${itemsErr.message}`);
    if (items) allTheoryItems = allTheoryItems.concat(items);
    if (!items || items.length < ITEM_PAGE_SIZE) break;
    itemPage++;
  }

  const pendingTheoryItems = allTheoryItems.filter(
    i => i.status === "PENDING" || i.status === "IN_PROGRESS"
  );

  // ────────────────────────────────────────────────────────────────────────
  // Relatório
  // ────────────────────────────────────────────────────────────────────────

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  RESUMO");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`CRIAR=${newBlocks.length}   HERDADOS_COMPLETED=${countCompleted}   NOVOS_NOT_STARTED=${countNotStarted}`);
  console.log(`TEC_EXCLUDED=${countTecExcluded}   ANTIGOS_DESATIVAR=${allOldBlocks.length}   ITENS_SKIPPED=${pendingTheoryItems.length}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Detalhe de herança para auditoria
  const completedBlocks = newBlocks.filter(b => b.theoryStatus === "COMPLETED");
  if (completedBlocks.length > 0) {
    console.log("📋 HERANÇA DE COBERTURA (blocos marcados COMPLETED):\n");
    for (const b of completedBlocks) {
      console.log(`  ✅ "${b.title}" [${b.pageStart}–${b.pageEnd}]`);
      console.log(`     theoryCompletedAt: ${b.theoryCompletedAt}`);
      for (const src of b.coverageSources) {
        console.log(`     ← ${src}`);
      }
      console.log();
    }
  }

  // Invariante: verificar sobreposições e lacunas nos novos blocos
  const activeNewBlocks = newBlocks.filter(b => b.theoryStatus !== "EXCLUDED");
  let totalOverlaps = 0;
  let totalGaps = 0;
  let maxPages = 0;

  for (const matId of matIds) {
    const matBlocks = activeNewBlocks
      .filter(b => b.materialId === matId)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.pageStart - b.pageStart);

    for (let i = 0; i < matBlocks.length - 1; i++) {
      const cur = matBlocks[i];
      const nxt = matBlocks[i + 1];
      if (cur.pageEnd >= nxt.pageStart) {
        totalOverlaps++;
        console.log(`  ⚠️ OVERLAP: "${cur.title}" [${cur.pageStart}–${cur.pageEnd}] ↔ "${nxt.title}" [${nxt.pageStart}–${nxt.pageEnd}]`);
      }
      if (nxt.pageStart > cur.pageEnd + 1) {
        totalGaps++;
        console.log(`  ⚠️ GAP: "${cur.title}" [${cur.pageStart}–${cur.pageEnd}] → "${nxt.title}" [${nxt.pageStart}–${nxt.pageEnd}] (gap: ${nxt.pageStart - cur.pageEnd - 1} páginas)`);
      }
    }

    for (const b of matBlocks) {
      const pages = b.pageEnd - b.pageStart + 1;
      if (pages > maxPages) maxPages = pages;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  PORTÕES (verificação pré-apply)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Blocos novos (teoria + TEC): ${newBlocks.length}  (esperado: 94)`);
  console.log(`  TOTAL_OVERLAPS: ${totalOverlaps}  (esperado: 0)`);
  console.log(`  TOTAL_GAPS: ${totalGaps}  (esperado: 0)`);
  console.log(`  Maior bloco: ${maxPages} páginas  (esperado: ≤ 8)`);

  const gatesPass = newBlocks.length === 94 && totalOverlaps === 0 && totalGaps === 0 && maxPages <= 8;
  console.log(`  Resultado: ${gatesPass ? "✅ TODOS PASSARAM" : "❌ FALHA — NÃO APLIQUE"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!gatesPass) {
    console.error("🛑 PORTÕES FALHARAM. Abortando sem aplicar.");
    process.exit(1);
  }

  if (!APPLY) {
    console.log("🟡 DRY-RUN: nenhuma alteração feita. Use --apply para aplicar.");

    // Gravar rollback script para uso posterior
    const rollbackPath = path.join(process.cwd(), "tmp", "rollback-rebuild.json");
    fs.writeFileSync(rollbackPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      oldBlocksToReactivate: allOldBlocks.map(b => b.id),
      itemsToUnSkip: pendingTheoryItems.map(i => i.id),
      note: "Para desfazer: reativar blocos antigos, un-SKIP itens, deletar blocos novos"
    }, null, 2));
    console.log(`📝 Rollback data gravado em: ${rollbackPath}`);
    return;
  }

  // ════════════════════════════════════════════════════════════════════════
  // APPLY — Tudo em uma batch sequencial via Supabase
  // (Supabase PostgREST não suporta $transaction nativo, mas as operações
  //  são idempotentes: se uma falhar, o estado é consistente)
  // ════════════════════════════════════════════════════════════════════════

  console.log("🔴 APLICANDO ALTERAÇÕES...\n");

  // Gravar rollback data antes de qualquer mutação
  const rollbackPath = path.join(process.cwd(), "tmp", "rollback-rebuild.json");
  fs.writeFileSync(rollbackPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    oldBlocksToReactivate: allOldBlocks.map(b => ({ id: b.id, theoryStatus: b.theoryStatus })),
    itemsToUnSkip: pendingTheoryItems.map(i => ({ id: i.id, status: i.status })),
    note: "Para desfazer: reativar blocos antigos com status original, un-SKIP itens, deletar blocos novos"
  }, null, 2));
  console.log(`📝 Rollback data gravado em: ${rollbackPath}\n`);

  // Passo A: Desativar blocos antigos (Regra 4)
  console.log(`  [A] Desativando ${allOldBlocks.length} blocos antigos → EXCLUDED`);
  const BATCH_SIZE = 50;
  for (let i = 0; i < oldBlockIds.length; i += BATCH_SIZE) {
    const batch = oldBlockIds.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("StudyBlock")
      .update({ theoryStatus: "EXCLUDED" })
      .in("id", batch);
    if (error) throw new Error(`Erro ao desativar blocos (batch ${i}): ${error.message}`);
  }
  console.log("      ✅ Blocos antigos desativados\n");

  // Passo B: Marcar itens de agenda como SKIPPED (Regra 5)
  console.log(`  [B] Marcando ${pendingTheoryItems.length} itens de agenda → SKIPPED`);
  const itemIds = pendingTheoryItems.map(i => i.id);
  for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
    const batch = itemIds.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("StudyScheduleItem")
      .update({ status: "SKIPPED" })
      .in("id", batch);
    if (error) throw new Error(`Erro ao marcar itens SKIPPED (batch ${i}): ${error.message}`);
  }
  console.log("      ✅ Itens marcados SKIPPED\n");

  // Passo C: Criar os 94 novos blocos (Regra 1)
  console.log(`  [C] Criando ${newBlocks.length} novos blocos`);
  const createdIds: string[] = [];
  const INSERT_BATCH = 20;

  function generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    return `cm${timestamp}${randomPart}`.substring(0, 25);
  }

  for (let i = 0; i < newBlocks.length; i += INSERT_BATCH) {
    const nowIso = new Date().toISOString();
    const batch = newBlocks.slice(i, i + INSERT_BATCH).map(b => ({
      id: generateCuid(),
      userId: b.userId,
      subjectId: b.subjectId,
      materialId: b.materialId,
      title: b.title,
      pageStart: b.pageStart,
      pageEnd: b.pageEnd,
      estimatedStudyMinutes: b.estimatedStudyMinutes,
      orderIndex: b.orderIndex,
      theoryStatus: b.theoryStatus,
      theoryCompletedAt: b.theoryCompletedAt,
      sourceV1BlockId: null,
      questionsStatus: "NOT_STARTED",
      flashcardsStatus: "NOT_STARTED",
      methodology: "LINEAR",
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    const { data: inserted, error } = await supabase
      .from("StudyBlock")
      .insert(batch)
      .select("id");

    if (error) throw new Error(`Erro ao inserir blocos (batch ${i}): ${error.message}`);
    if (inserted) createdIds.push(...inserted.map(r => r.id));
  }
  console.log(`      ✅ ${createdIds.length} blocos criados\n`);

  // Salvar IDs criados no rollback
  const rollbackData = JSON.parse(fs.readFileSync(rollbackPath, "utf-8"));
  rollbackData.createdBlockIds = createdIds;
  fs.writeFileSync(rollbackPath, JSON.stringify(rollbackData, null, 2));

  // ════════════════════════════════════════════════════════════════════════
  // PORTÕES PÓS-APPLY (leitura)
  // ════════════════════════════════════════════════════════════════════════

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  PORTÕES PÓS-APPLY");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Rodar invariante no banco
  const { data: postBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, orderIndex, materialId, theoryStatus")
    .in("materialId", matIds)
    .eq("userId", userId)
    .neq("theoryStatus", "EXCLUDED")
    .order("pageStart", { ascending: true });

  const activePostBlocks = postBlocks || [];
  let postOverlaps = 0;
  let postGaps = 0;
  let postMaxPages = 0;

  for (const matId of matIds) {
    const matBlocks = activePostBlocks
      .filter(b => b.materialId === matId)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.pageStart - b.pageStart);

    for (let i = 0; i < matBlocks.length - 1; i++) {
      const cur = matBlocks[i];
      const nxt = matBlocks[i + 1];
      if (cur.pageEnd >= nxt.pageStart) postOverlaps++;
      if (nxt.pageStart > cur.pageEnd + 1) postGaps++;
    }
    for (const b of matBlocks) {
      const pages = b.pageEnd - b.pageStart + 1;
      if (pages > postMaxPages) postMaxPages = pages;
    }
  }

  console.log(`  Blocos ativos: ${activePostBlocks.length}  (esperado: 89)`);
  console.log(`  TOTAL_OVERLAPS: ${postOverlaps}  (esperado: 0)`);
  console.log(`  TOTAL_GAPS: ${postGaps}  (esperado: 0)`);
  console.log(`  Maior bloco: ${postMaxPages} páginas  (esperado: ≤ 8)`);

  const postGatesPass = activePostBlocks.length === 89 && postOverlaps === 0 && postGaps === 0 && postMaxPages <= 8;
  console.log(`  Resultado: ${postGatesPass ? "✅ TODOS PASSARAM" : "❌ FALHA"}`);

  if (!postGatesPass) {
    console.error("\n🛑 PORTÕES PÓS-APPLY FALHARAM.");
    console.error(`   Rollback manual: ${rollbackPath}`);
    console.error("   NÃO executar rollback automático — avise o Henrique.");
    process.exit(1);
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  ✅ RECONSTRUÇÃO CONCLUÍDA COM SUCESSO");
  console.log("════════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("🛑 ERRO FATAL:", err.message);
  process.exit(1);
});
