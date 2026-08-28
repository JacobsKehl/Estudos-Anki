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
          `❌ Item ${item.id} (${item.scheduledDate.substring(0, 10)}) [${subName}]: Bloco [${b.pageStart}–${b.pageEnd}] "${b.title}" NÃO existe no Blueprint (PDF=${matFileName})`
        );
      }

      // (b) Está NOT_STARTED
      if (b.theoryStatus !== "NOT_STARTED") {
        invalidItems.push(
          `❌ Item ${item.id} (${item.scheduledDate.substring(0, 10)}) [${subName}]: Bloco tem theoryStatus="${b.theoryStatus}" (esperado: "NOT_STARTED")`
        );
      }

      // (c) Pertence a um dos 5 PDFs do CFC
      if (!cfcFiles.includes(matFileName)) {
        invalidItems.push(
          `❌ Item ${item.id} (${item.scheduledDate.substring(0, 10)}) [${subName}]: Material "${matFileName}" NÃO pertence aos 5 PDFs do CFC`
        );
      }
    }

    if (invalidItems.length > 0) {
      console.error("\n=== ITENS DE AGENDAMENTO INVÁLIDOS NA GRADE DE 30 DIAS ===");
      invalidItems.forEach((msg) => console.error("  " + msg));
      console.error(`Total de itens avaliados: ${scheduleItems?.length} | Inválidos: ${invalidItems.length}\n`);
    }

    expect(invalidItems).toEqual([]);
  }, 30000);
});

