/**
 * block-blueprint-integrity.test.ts
 *
 * Guardião de integridade: Blueprint CSV ↔ Banco de Dados.
 *
 * Modo 1 (Padrão / Unitário):
 *   Valida a coerência interna do CSV (94 blocos, 0 overlaps, 0 gaps, max 8 páginas).
 *
 * Modo 2 (RUN_CFC_BLUEPRINT_DB_TEST=true / Integração com Banco Real):
 *   Lê os blocos ativos dos 5 materiais do CFC no banco e valida que TODO bloco ativo
 *   tem (pageStart, pageEnd) rigorosamente idêntico a uma linha do BLUEPRINT-blocos-cfc.csv.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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
  const data = lines.slice(1);

  return data.map((line) => {
    const cols = parseCSVLine(line);
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
}

export function validateScheduleItemsIntegrity(
  scheduleItems: any[],
  blueprint: BlueprintRow[],
  cfcFiles: readonly string[]
): string[] {
  const invalidItems: string[] = [];

  for (const item of scheduleItems || []) {
    const b = item.StudyBlock as any;
    const matFileName = b?.StudyMaterial?.originalFileName;
    const subName = (item.StudySubject as any)?.name;

    if (!b) {
      invalidItems.push(`❌ Item ${item.id} (${item.scheduledDate}) sem StudyBlock vinculado (studyBlockId=${item.studyBlockId})`);
      continue;
    }

    // (a) Existe no blueprint com pageStart e pageEnd exatos
    const match = blueprint.find(
      (r) =>
        r.pdf_no_banco === matFileName &&
        r.pageStart === b.pageStart &&
        r.pageEnd === b.pageEnd
    );

    if (!match) {
      invalidItems.push(
        `❌ Item ${item.id} (${item.scheduledDate?.substring(0, 10) ?? ""}) [${subName}]: Bloco [${b.pageStart}–${b.pageEnd}] "${b.title}" NÃO existe no Blueprint (PDF=${matFileName})`
      );
    }

    // (b) Está NOT_STARTED
    if (b.theoryStatus !== "NOT_STARTED") {
      invalidItems.push(
        `❌ Item ${item.id} (${item.scheduledDate?.substring(0, 10) ?? ""}) [${subName}]: Bloco tem theoryStatus="${b.theoryStatus}" (esperado: "NOT_STARTED")`
      );
    }

    // (c) Pertence a um dos 5 PDFs do CFC
    if (!cfcFiles.includes(matFileName)) {
      invalidItems.push(
        `❌ Item ${item.id} (${item.scheduledDate?.substring(0, 10) ?? ""}) [${subName}]: Material "${matFileName}" NÃO pertence aos 5 PDFs do CFC`
      );
    }
  }

  return invalidItems;
}

/**
 * Nenhum StudyBlock pode ter dois StudyScheduleItem PENDING do tipo THEORY
 * apontando para ele no mesmo cronograma — sinal de duplicação (achado real
 * durante a auditoria da Frente C: uma segunda chamada de
 * reorganizeOverdueSchedule pode reagendar um bloco que já tem item PENDING,
 * já que scheduledBlockIds só é semeado a partir de itens COMPLETED/IN_PROGRESS).
 */
export function findDuplicateTheoryStudyBlockIds(scheduleItems: any[]): string[] {
  const seenBy = new Map<string, string>();
  const duplicates: string[] = [];

  for (const item of scheduleItems || []) {
    if (item.actionType !== "THEORY" || item.status !== "PENDING" || !item.studyBlockId) continue;

    const prevItemId = seenBy.get(item.studyBlockId);
    if (prevItemId) {
      duplicates.push(
        `❌ studyBlockId=${item.studyBlockId} duplicado: itens ${prevItemId} e ${item.id} ambos PENDING/THEORY`
      );
    } else {
      seenBy.set(item.studyBlockId, item.id);
    }
  }

  return duplicates;
}

/**
 * 9ª asserção (achado do T21/Replano, P2): dois StudyBlock ATIVOS (qualquer
 * theoryStatus != EXCLUDED) dos 5 PDFs do CFC nunca podem compartilhar o
 * mesmo (materialId, pageStart, pageEnd) — isso é o mesmo capítulo duplicado
 * duas vezes no acervo ativo.
 */
export function findDuplicateActiveBlocks(
  blocks: { id: string; materialId: string; pageStart: number; pageEnd: number; theoryStatus: string }[]
): string[] {
  const seenBy = new Map<string, string>();
  const duplicates: string[] = [];

  for (const b of blocks || []) {
    if (b.theoryStatus === "EXCLUDED") continue;
    const key = `${b.materialId}:${b.pageStart}:${b.pageEnd}`;
    const prevId = seenBy.get(key);
    if (prevId) {
      duplicates.push(
        `❌ (materialId=${b.materialId}, pageStart=${b.pageStart}, pageEnd=${b.pageEnd}) duplicado entre blocos ATIVOS: ${prevId} e ${b.id}`
      );
    } else {
      seenBy.set(key, b.id);
    }
  }

  return duplicates;
}

/**
 * 10ª asserção (achado do T21/Replano, P2): nenhum StudyBlock EXCLUDED pode
 * compartilhar (materialId, pageStart, pageEnd) com um StudyBlock ATIVO — é
 * o padrão real encontrado ("Cumprimento da Sentença" em CAIXA-ALTA ativo e
 * em Title Case EXCLUDED, mesmas páginas): um filtro `!= EXCLUDED` esconde a
 * duplicata da tela, mas ela continua existindo no banco como um segundo
 * StudyBlock para o mesmo conteúdo.
 */
export function findExcludedActiveOverlap(
  blocks: { id: string; title: string; materialId: string; pageStart: number; pageEnd: number; theoryStatus: string }[]
): string[] {
  const activeByKey = new Map<string, string>();
  for (const b of blocks || []) {
    if (b.theoryStatus === "EXCLUDED") continue;
    activeByKey.set(`${b.materialId}:${b.pageStart}:${b.pageEnd}`, b.id);
  }

  const overlaps: string[] = [];
  for (const b of blocks || []) {
    if (b.theoryStatus !== "EXCLUDED") continue;
    const key = `${b.materialId}:${b.pageStart}:${b.pageEnd}`;
    const activeId = activeByKey.get(key);
    if (activeId) {
      overlaps.push(
        `❌ (materialId=${b.materialId}, pageStart=${b.pageStart}, pageEnd=${b.pageEnd}) "${b.title}": EXCLUDED ${b.id} tem o mesmo conteúdo do ATIVO ${activeId}`
      );
    }
  }

  return overlaps;
}

describe("CFC Blueprint Integrity Guard", () => {
  const blueprint = loadBlueprint();

  it("Modo Unitário: Blueprint CSV tem 94 linhas, 366 páginas, 1098 minutos", () => {
    expect(blueprint.length).toBe(94);

    const totalPages = blueprint.reduce((acc, r) => acc + r.paginas, 0);
    const totalMinutes = blueprint.reduce((acc, r) => acc + r.minutos_3ppm, 0);

    expect(totalPages).toBe(366);
    expect(totalMinutes).toBe(1098);
  });

  it("Modo Unitário: Blueprint CSV tem 0 sobreposições, 0 lacunas e maior bloco ≤ 8 páginas", () => {
    const pdfs = Array.from(new Set(blueprint.map((r) => r.pdf_no_banco)));

    let totalOverlaps = 0;
    let totalGaps = 0;
    let maxPages = 0;

    for (const pdf of pdfs) {
      const pdfRows = blueprint
        .filter((r) => r.pdf_no_banco === pdf)
        .sort((a, b) => a.ordem - b.ordem || a.pageStart - b.pageStart);

      for (let i = 0; i < pdfRows.length - 1; i++) {
        const cur = pdfRows[i];
        const nxt = pdfRows[i + 1];

        if (cur.pageEnd >= nxt.pageStart) {
          totalOverlaps++;
        }
        if (nxt.pageStart > cur.pageEnd + 1) {
          totalGaps++;
        }
      }

      for (const r of pdfRows) {
        const pages = r.pageEnd - r.pageStart + 1;
        if (pages > maxPages) maxPages = pages;
      }
    }

    expect(totalOverlaps).toBe(0);
    expect(totalGaps).toBe(0);
    expect(maxPages).toBeLessThanOrEqual(8);
  });

  it("Modo Unitário: Guardião detecta, identifica e REPROVA itens forjados fora do Blueprint ([3-23], [3-13], PDF não-CFC e status inválido)", () => {
    const cfcFiles = [
      "1 - Direito Administrativo_compressed.pdf",
      "2 - Direito do Trabalho.pdf",
      "3 - Direito Constitucional.pdf",
      "4 - Direito Processual do Trabalho.pdf",
      "Direito Processual Civil_compressed.pdf",
    ];

    const forgedItems = [
      // 1. Bloco clássico do Estratégia [3-23] (fora do CFC e fora do Blueprint)
      {
        id: "forged-item-1",
        scheduledDate: "2026-08-28T00:00:00-03:00",
        actionType: "THEORY",
        status: "PENDING",
        studyBlockId: "block-estrategia-da-1",
        StudySubject: { name: "Direito Administrativo" },
        StudyBlock: {
          id: "block-estrategia-da-1",
          title: "Agentes Públicos — Conceito e Classificações",
          pageStart: 3,
          pageEnd: 23,
          theoryStatus: "NOT_STARTED",
          StudyMaterial: { originalFileName: "direito administrativo 11.pdf" },
        },
      },
      // 2. Bloco clássico do Estratégia [3-13] (fora do CFC e fora do Blueprint)
      {
        id: "forged-item-2",
        scheduledDate: "2026-08-28T00:00:00-03:00",
        actionType: "THEORY",
        status: "PENDING",
        studyBlockId: "block-estrategia-dc-1",
        StudySubject: { name: "Direito Constitucional" },
        StudyBlock: {
          id: "block-estrategia-dc-1",
          title: "Poder Legislativo — Funções e Estrutura",
          pageStart: 3,
          pageEnd: 13,
          theoryStatus: "NOT_STARTED",
          StudyMaterial: { originalFileName: "direito constitucional 9.pdf" },
        },
      },
      // 3. Bloco do CFC com theoryStatus = COMPLETED agendado indevidamente
      {
        id: "forged-item-3",
        scheduledDate: "2026-08-29T00:00:00-03:00",
        actionType: "THEORY",
        status: "PENDING",
        studyBlockId: "block-cfc-completed",
        StudySubject: { name: "Direito do Trabalho" },
        StudyBlock: {
          id: "block-cfc-completed",
          title: "Contratos de Trabalho",
          pageStart: 8,
          pageEnd: 10,
          theoryStatus: "COMPLETED",
          StudyMaterial: { originalFileName: "2 - Direito do Trabalho.pdf" },
        },
      },
      // 4. Bloco com páginas inexistentes no Blueprint [90-99]
      {
        id: "forged-item-4",
        scheduledDate: "2026-08-30T00:00:00-03:00",
        actionType: "THEORY",
        status: "PENDING",
        studyBlockId: "block-cfc-invalid-pages",
        StudySubject: { name: "Direito Processual Civil" },
        StudyBlock: {
          id: "block-cfc-invalid-pages",
          title: "Capítulo Inexistente",
          pageStart: 90,
          pageEnd: 99,
          theoryStatus: "NOT_STARTED",
          StudyMaterial: { originalFileName: "Direito Processual Civil_compressed.pdf" },
        },
      },
    ];

    const violations = validateScheduleItemsIntegrity(forgedItems, blueprint, cfcFiles);

    // O guardião DEVE reprovar todas as 4 anomalias
    expect(violations.length).toBeGreaterThanOrEqual(4);

    // Reprovação específica de [3-23]
    expect(violations.some((v) => v.includes("[3–23]") && v.includes("direito administrativo 11.pdf"))).toBe(true);

    // Reprovação específica de [3-13]
    expect(violations.some((v) => v.includes("[3–13]") && v.includes("direito constitucional 9.pdf"))).toBe(true);

    // Reprovação de status COMPLETED
    expect(violations.some((v) => v.includes('theoryStatus="COMPLETED"'))).toBe(true);

    // Reprovação de páginas fora do Blueprint [90-99]
    expect(violations.some((v) => v.includes("[90–99]") && v.includes("NÃO existe no Blueprint"))).toBe(true);
  });

  it("Modo Unitário: Guardião detecta dois StudyScheduleItem PENDING/THEORY apontando para o mesmo studyBlockId", () => {
    const cleanItems = [
      { id: "item-1", actionType: "THEORY", status: "PENDING", studyBlockId: "block-a" },
      { id: "item-2", actionType: "THEORY", status: "PENDING", studyBlockId: "block-b" },
    ];
    expect(findDuplicateTheoryStudyBlockIds(cleanItems)).toEqual([]);

    const duplicatedItems = [
      ...cleanItems,
      { id: "item-3", actionType: "THEORY", status: "PENDING", studyBlockId: "block-a" },
    ];
    const duplicates = findDuplicateTheoryStudyBlockIds(duplicatedItems);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0]).toContain("block-a");
    expect(duplicates[0]).toContain("item-1");
    expect(duplicates[0]).toContain("item-3");

    // COMPLETED/IN_PROGRESS e REVIEW_BLOCK compartilhando bloco não contam —
    // a asserção é estritamente sobre THEORY PENDING.
    const notDuplicates = [
      { id: "item-4", actionType: "THEORY", status: "COMPLETED", studyBlockId: "block-c" },
      { id: "item-5", actionType: "THEORY", status: "PENDING", studyBlockId: "block-c" },
      { id: "item-6", actionType: "REVIEW_BLOCK", status: "PENDING", studyBlockId: "block-c" },
    ];
    expect(findDuplicateTheoryStudyBlockIds(notDuplicates)).toEqual([]);
  });

  it("Modo Unitário: Guardião detecta dois blocos ATIVOS com o mesmo (materialId, pageStart, pageEnd)", () => {
    const cleanBlocks = [
      { id: "block-a", materialId: "mat-1", pageStart: 10, pageEnd: 15, theoryStatus: "NOT_STARTED" },
      { id: "block-b", materialId: "mat-1", pageStart: 16, pageEnd: 20, theoryStatus: "COMPLETED" },
    ];
    expect(findDuplicateActiveBlocks(cleanBlocks)).toEqual([]);

    const duplicatedBlocks = [
      ...cleanBlocks,
      { id: "block-c", materialId: "mat-1", pageStart: 10, pageEnd: 15, theoryStatus: "NOT_STARTED" },
    ];
    const duplicates = findDuplicateActiveBlocks(duplicatedBlocks);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0]).toContain("block-a");
    expect(duplicates[0]).toContain("block-c");

    // Um EXCLUDED com as mesmas páginas de um ATIVO não conta aqui — é a
    // 10ª asserção, não esta.
    const withExcluded = [
      ...cleanBlocks,
      { id: "block-d", materialId: "mat-1", pageStart: 10, pageEnd: 15, theoryStatus: "EXCLUDED" },
    ];
    expect(findDuplicateActiveBlocks(withExcluded)).toEqual([]);
  });

  it("Modo Unitário: Guardião detecta bloco EXCLUDED com o mesmo conteúdo de um bloco ATIVO", () => {
    const cleanBlocks = [
      { id: "block-a", title: "Capítulo A", materialId: "mat-1", pageStart: 10, pageEnd: 15, theoryStatus: "NOT_STARTED" },
      { id: "block-b", title: "Capítulo B", materialId: "mat-1", pageStart: 16, pageEnd: 20, theoryStatus: "EXCLUDED" },
    ];
    expect(findExcludedActiveOverlap(cleanBlocks)).toEqual([]);

    const overlapping = [
      ...cleanBlocks,
      { id: "block-c", title: "Capítulo A (Title Case)", materialId: "mat-1", pageStart: 10, pageEnd: 15, theoryStatus: "EXCLUDED" },
    ];
    const overlaps = findExcludedActiveOverlap(overlapping);
    expect(overlaps.length).toBe(1);
    expect(overlaps[0]).toContain("block-a");
    expect(overlaps[0]).toContain("block-c");

    // Dois EXCLUDED com as mesmas páginas entre si, sem nenhum ATIVO
    // correspondente, não contam aqui.
    const onlyExcludedDuplicated = [
      { id: "block-x", title: "X", materialId: "mat-2", pageStart: 1, pageEnd: 5, theoryStatus: "EXCLUDED" },
      { id: "block-y", title: "Y", materialId: "mat-2", pageStart: 1, pageEnd: 5, theoryStatus: "EXCLUDED" },
    ];
    expect(findExcludedActiveOverlap(onlyExcludedDuplicated)).toEqual([]);
  });

  const shouldRunDbTest = process.env.RUN_CFC_BLUEPRINT_DB_TEST === "true";
  const conditionalTest = shouldRunDbTest ? it : it.skip;

  conditionalTest("Modo Integração DB: Todo StudyBlock ativo dos 5 PDFs do CFC deve ter (pageStart, pageEnd) exato do Blueprint", async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://msmdekjetxajcwuxmxps.supabase.co";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userId = "cmp8od0wz0000iybklaotfqbs";
    const cfcFiles = [
      "1 - Direito Administrativo_compressed.pdf",
      "2 - Direito do Trabalho.pdf",
      "3 - Direito Constitucional.pdf",
      "4 - Direito Processual do Trabalho.pdf",
      "Direito Processual Civil_compressed.pdf",
    ];

    const { data: materials, error: matErr } = await supabase
      .from("StudyMaterial")
      .select("id, originalFileName")
      .eq("userId", userId)
      .in("originalFileName", cfcFiles);

    if (matErr) throw matErr;
    expect(materials).toBeDefined();
    expect(materials!.length).toBe(5);

    const matMap = new Map<string, string>();
    for (const m of materials!) {
      if (m.originalFileName) matMap.set(m.id, m.originalFileName);
    }
    const matIds = Array.from(matMap.keys());

    const { data: dbBlocks, error: bErr } = await supabase
      .from("StudyBlock")
      .select("id, title, pageStart, pageEnd, materialId, theoryStatus")
      .eq("userId", userId)
      .in("materialId", matIds)
      .neq("theoryStatus", "EXCLUDED");

    if (bErr) throw bErr;
    expect(dbBlocks).toBeDefined();

    const unexpectedInDb: string[] = [];
    const missingFromDb: string[] = [];
    const seenPairs = new Map<string, string>();
    const duplicatePairs: string[] = [];

    // Asserção Lado 1: Todo bloco no banco deve pertencer ao Blueprint
    for (const block of dbBlocks!) {
      const fileName = matMap.get(block.materialId);
      const match = blueprint.find(
        (r) =>
          r.pdf_no_banco === fileName &&
          r.pageStart === block.pageStart &&
          r.pageEnd === block.pageEnd
      );

      if (!match) {
        unexpectedInDb.push(
          `❌ Bloco no DB não existe no Blueprint: ID=${block.id} "${block.title}" [${block.pageStart}–${block.pageEnd}] PDF=${fileName}`
        );
      }

      // Asserção 3: Nenhum par (materialId, pageStart) repetido
      const pairKey = `${block.materialId}:${block.pageStart}`;
      if (seenPairs.has(pairKey)) {
        duplicatePairs.push(
          `❌ Duplicata de (materialId, pageStart): ID=${block.id} e ID=${seenPairs.get(pairKey)} no PDF=${fileName} pageStart=${block.pageStart}`
        );
      } else {
        seenPairs.set(pairKey, block.id);
      }
    }

    // Asserção Lado 2: Toda linha do Blueprint (de teoria, excluindo os 5 TEC) deve ter exatamente 1 bloco ativo no banco
    const theoryBlueprint = blueprint.filter(
      (r) => !r.titulo_capitulo.includes("EXTRA – EXERCÍCIOS (TEC)") && !r.titulo_capitulo.includes("EXTRA – QUESTÕES (TEC)")
    );

    for (const row of theoryBlueprint) {
      const matId = Array.from(matMap.entries()).find(([, f]) => f === row.pdf_no_banco)?.[0];
      const matchedBlocks = (dbBlocks || []).filter(
        (b) => b.materialId === matId && b.pageStart === row.pageStart && b.pageEnd === row.pageEnd
      );

      if (matchedBlocks.length === 0) {
        missingFromDb.push(
          `❌ Linha do Blueprint FALTANDO no banco: "${row.titulo_capitulo}" [${row.pageStart}–${row.pageEnd}] PDF=${row.pdf_no_banco}`
        );
      } else if (matchedBlocks.length > 1) {
        duplicatePairs.push(
          `❌ Múltiplos blocos no banco para a mesma linha do Blueprint: "${row.titulo_capitulo}" [${row.pageStart}–${row.pageEnd}] IDs=${matchedBlocks.map(b => b.id).join(", ")}`
        );
      }
    }

    if (unexpectedInDb.length > 0 || missingFromDb.length > 0 || duplicatePairs.length > 0) {
      console.error("\n=== DIVERGÊNCIAS BIDIRECIONAIS DB ↔ BLUEPRINT ===");
      if (unexpectedInDb.length > 0) {
        console.error(`\n[LADO 1 - BLOCOS NO DB QUE NÃO EXISTEM NO BLUEPRINT (${unexpectedInDb.length})]:`);
        unexpectedInDb.forEach((d) => console.error("  " + d));
      }
      if (missingFromDb.length > 0) {
        console.error(`\n[LADO 2 - LINHAS DO BLUEPRINT FALTANDO NO BANCO (${missingFromDb.length})]:`);
        missingFromDb.forEach((d) => console.error("  " + d));
      }
      if (duplicatePairs.length > 0) {
        console.error(`\n[DUPLICATAS ENCONTRADAS (${duplicatePairs.length})]:`);
        duplicatePairs.forEach((d) => console.error("  " + d));
      }
      console.error(`\nTotal DB: ${dbBlocks!.length} blocos | Total Teoria Blueprint: ${theoryBlueprint.length} linhas\n`);
    }

    expect(unexpectedInDb).toEqual([]);
    expect(missingFromDb).toEqual([]);
    expect(duplicatePairs).toEqual([]);
    expect(dbBlocks!.length).toBe(89); // 89 blocos de teoria ativos
  }, 30000);

  conditionalTest("Modo Integração DB: Todo StudyScheduleItem PENDING de THEORY nos próximos 30 dias deve apontar para bloco CFC NOT_STARTED do Blueprint", async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://msmdekjetxajcwuxmxps.supabase.co";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userId = "cmp8od0wz0000iybklaotfqbs";
    const cfcFiles = [
      "1 - Direito Administrativo_compressed.pdf",
      "2 - Direito do Trabalho.pdf",
      "3 - Direito Constitucional.pdf",
      "4 - Direito Processual do Trabalho.pdf",
      "Direito Processual Civil_compressed.pdf",
    ];

    // Buscar cronograma ativo
    const { data: schedule, error: sErr } = await supabase
      .from("StudySchedule")
      .select("id")
      .eq("userId", userId)
      .eq("status", "ACTIVE")
      .single();

    if (sErr) throw sErr;
    expect(schedule).toBeDefined();

    const todayStr = "2026-08-28T00:00:00-03:00";
    const in30DaysStr = "2026-09-27T23:59:59-03:00";

    const { data: scheduleItems, error: itemsErr } = await supabase
      .from("StudyScheduleItem")
      .select(`
        id,
        scheduledDate,
        dayNumber,
        actionType,
        status,
        studyBlockId,
        StudyBlock:studyBlockId (
          id,
          title,
          pageStart,
          pageEnd,
          theoryStatus,
          materialId,
          StudyMaterial:materialId (
            id,
            originalFileName
          )
        ),
        StudySubject:subjectId (
          name
        )
      `)
      .eq("userId", userId)
      .eq("scheduleId", schedule.id)
      .eq("actionType", "THEORY")
      .eq("status", "PENDING")
      .gte("scheduledDate", todayStr)
      .lte("scheduledDate", in30DaysStr);

    if (itemsErr) throw itemsErr;
    expect(scheduleItems).toBeDefined();

    const invalidItems = validateScheduleItemsIntegrity(scheduleItems || [], blueprint, cfcFiles);

    if (invalidItems.length > 0) {
      console.error("\n=== ITENS DE AGENDAMENTO INVÁLIDOS NA GRADE DE 30 DIAS ===");
      invalidItems.forEach((msg) => console.error("  " + msg));
      console.error(`Total de itens avaliados: ${scheduleItems?.length} | Inválidos: ${invalidItems.length}\n`);
    }

    expect(invalidItems).toEqual([]);
    expect(scheduleItems!.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  conditionalTest("Modo Integração DB: Todo StudyScheduleItem REVIEW_BLOCK PENDING (qualquer data, passado incluído) deve apontar para StudyBlock não-EXCLUDED", async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://msmdekjetxajcwuxmxps.supabase.co";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userId = "cmp8od0wz0000iybklaotfqbs";

    const { data: schedule, error: sErr } = await supabase
      .from("StudySchedule")
      .select("id")
      .eq("userId", userId)
      .eq("status", "ACTIVE")
      .single();

    if (sErr) throw sErr;
    expect(schedule).toBeDefined();

    const { data: reviewItems, error: itemsErr } = await supabase
      .from("StudyScheduleItem")
      .select(`
        id,
        scheduledDate,
        actionType,
        status,
        studyBlockId,
        StudyBlock:studyBlockId (
          id,
          title,
          pageStart,
          pageEnd,
          theoryStatus
        )
      `)
      .eq("userId", userId)
      .eq("scheduleId", schedule.id)
      .eq("actionType", "REVIEW_BLOCK")
      .eq("status", "PENDING");

    if (itemsErr) throw itemsErr;
    expect(reviewItems).toBeDefined();

    const orphaned: string[] = [];
    for (const item of reviewItems || []) {
      const b = item.StudyBlock as any;
      if (b?.theoryStatus === "EXCLUDED") {
        orphaned.push(
          `❌ Item ${item.id} (${item.scheduledDate?.substring(0, 10) ?? ""}): REVIEW_BLOCK aponta para StudyBlock EXCLUDED — ID=${b.id} "${b.title}" [${b.pageStart}–${b.pageEnd}]`
        );
      }
    }

    if (orphaned.length > 0) {
      console.error("\n=== REVIEW_BLOCK PENDING ÓRFÃS (apontam para bloco EXCLUDED) ===");
      orphaned.forEach((msg) => console.error("  " + msg));
      console.error(`Total REVIEW_BLOCK PENDING avaliados: ${reviewItems?.length} | Órfãs: ${orphaned.length}\n`);
    }

    expect(orphaned).toEqual([]);
  }, 30000);

  conditionalTest("Modo Integração DB: Nenhum StudyBlock tem dois StudyScheduleItem PENDING/THEORY apontando para ele (7ª asserção — achado da Frente C)", async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://msmdekjetxajcwuxmxps.supabase.co";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userId = "cmp8od0wz0000iybklaotfqbs";

    const { data: schedule, error: sErr } = await supabase
      .from("StudySchedule")
      .select("id")
      .eq("userId", userId)
      .eq("status", "ACTIVE")
      .single();

    if (sErr) throw sErr;
    expect(schedule).toBeDefined();

    const { data: theoryItems, error: itemsErr } = await supabase
      .from("StudyScheduleItem")
      .select("id, actionType, status, studyBlockId")
      .eq("userId", userId)
      .eq("scheduleId", schedule.id)
      .eq("actionType", "THEORY")
      .eq("status", "PENDING");

    if (itemsErr) throw itemsErr;
    expect(theoryItems).toBeDefined();

    const duplicates = findDuplicateTheoryStudyBlockIds(theoryItems || []);

    if (duplicates.length > 0) {
      console.error("\n=== BLOCOS DUPLICADOS EM StudyScheduleItem PENDING/THEORY ===");
      duplicates.forEach((msg) => console.error("  " + msg));
      console.error(`Total THEORY PENDING avaliados: ${theoryItems?.length} | Duplicatas: ${duplicates.length}\n`);
    }

    expect(duplicates).toEqual([]);
  }, 30000);

  conditionalTest("Modo Integração DB: Nenhum bloco ATIVO dos 5 PDFs do CFC compartilha (materialId, pageStart, pageEnd) com outro ATIVO (9ª asserção — P2)", async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://msmdekjetxajcwuxmxps.supabase.co";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userId = "cmp8od0wz0000iybklaotfqbs";
    const cfcFiles = [
      "1 - Direito Administrativo_compressed.pdf",
      "2 - Direito do Trabalho.pdf",
      "3 - Direito Constitucional.pdf",
      "4 - Direito Processual do Trabalho.pdf",
      "Direito Processual Civil_compressed.pdf",
    ];

    const { data: materials, error: matErr } = await supabase
      .from("StudyMaterial")
      .select("id")
      .eq("userId", userId)
      .in("originalFileName", cfcFiles);
    if (matErr) throw matErr;
    const matIds = (materials || []).map((m) => m.id);

    const { data: allCfcBlocks, error: bErr } = await supabase
      .from("StudyBlock")
      .select("id, title, materialId, pageStart, pageEnd, theoryStatus")
      .eq("userId", userId)
      .in("materialId", matIds);
    if (bErr) throw bErr;

    const duplicates = findDuplicateActiveBlocks(allCfcBlocks || []);

    if (duplicates.length > 0) {
      console.error("\n=== BLOCOS ATIVOS DUPLICADOS (mesmo materialId+pageStart+pageEnd) ===");
      duplicates.forEach((msg) => console.error("  " + msg));
      console.error(`Total de blocos CFC avaliados: ${allCfcBlocks?.length} | Duplicatas entre ativos: ${duplicates.length}\n`);
    }

    expect(duplicates).toEqual([]);
  }, 30000);

  conditionalTest("Modo Integração DB: Nenhum bloco EXCLUDED dos 5 PDFs do CFC compartilha conteúdo com um bloco ATIVO (10ª asserção — P2)", async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://msmdekjetxajcwuxmxps.supabase.co";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userId = "cmp8od0wz0000iybklaotfqbs";
    const cfcFiles = [
      "1 - Direito Administrativo_compressed.pdf",
      "2 - Direito do Trabalho.pdf",
      "3 - Direito Constitucional.pdf",
      "4 - Direito Processual do Trabalho.pdf",
      "Direito Processual Civil_compressed.pdf",
    ];

    const { data: materials, error: matErr } = await supabase
      .from("StudyMaterial")
      .select("id")
      .eq("userId", userId)
      .in("originalFileName", cfcFiles);
    if (matErr) throw matErr;
    const matIds = (materials || []).map((m) => m.id);

    const { data: allCfcBlocks, error: bErr } = await supabase
      .from("StudyBlock")
      .select("id, title, materialId, pageStart, pageEnd, theoryStatus")
      .eq("userId", userId)
      .in("materialId", matIds);
    if (bErr) throw bErr;

    const overlaps = findExcludedActiveOverlap(allCfcBlocks || []);

    if (overlaps.length > 0) {
      console.error("\n=== BLOCOS EXCLUDED COM O MESMO CONTEÚDO DE UM BLOCO ATIVO ===");
      overlaps.forEach((msg) => console.error("  " + msg));
      console.error(`Total de blocos CFC avaliados: ${allCfcBlocks?.length} | Overlaps EXCLUDED↔ATIVO: ${overlaps.length}\n`);
    }

    expect(overlaps).toEqual([]);
  }, 30000);
});
