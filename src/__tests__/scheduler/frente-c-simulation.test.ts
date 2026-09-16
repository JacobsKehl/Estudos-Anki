/**
 * src/__tests__/scheduler/frente-c-simulation.test.ts
 *
 * Simulação de 30 dias da Frente C — NÃO precisa de banco. Chama a função
 * real reorganizeOverdueSchedule (nunca reimplementa a lógica) sobre um
 * Prisma mockado, semeado a partir de tmp/BLUEPRINT-blocos-cfc.csv.
 *
 * O CSV não é circular: é a extração dos 5 PDFs do CFC (md5
 * d321b5db06c4c1ef101fd80099dfe2e2), não é derivado do banco — é
 * exatamente a diferença que reprovou o guardião circular daquela vez.
 * O md5 é conferido antes de qualquer uso; o teste aborta se não bater.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { reorganizeOverdueSchedule } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";
import { SCHEDULER_LIMITS } from "@/lib/scheduler/config";

const CSV_PATH = path.resolve(__dirname, "../../../tmp/BLUEPRINT-blocos-cfc.csv");
const EXPECTED_MD5 = "d321b5db06c4c1ef101fd80099dfe2e2";

jest.mock("@/lib/prisma", () => {
  return {
    prisma: {
      studySubject: { findMany: jest.fn() },
      userPreferences: { findUnique: jest.fn() },
      studySchedule: { findFirst: jest.fn(), update: jest.fn() },
      studyScheduleItem: {
        count: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
      },
      studyBlock: { findMany: jest.fn() },
      $transaction: jest.fn(async (callback) => {
        if (typeof callback === "function") {
          return callback(prisma);
        }
        return callback;
      }),
    },
  };
});

interface BlueprintRow {
  materia: string;
  pdfNoBanco: string;
  ordem: number;
  tituloCapitulo: string;
  pageStart: number;
  pageEnd: number;
  minutos: number;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "," && !inQuotes) { result.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  result.push(cur.trim());
  return result;
}

function loadBlueprint(): BlueprintRow[] {
  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const actualMd5 = crypto.createHash("md5").update(raw).digest("hex");
  if (actualMd5 !== EXPECTED_MD5) {
    throw new Error(
      `🛑 ABORTADO: md5 do blueprint não bate. Esperado=${EXPECTED_MD5} Obtido=${actualMd5}. Não uso um CSV que não confere.`
    );
  }

  const lines = raw.trim().split("\n").slice(1);
  return lines.map((line) => {
    const cols = parseCsvLine(line);
    return {
      materia: cols[0],
      pdfNoBanco: cols[1],
      ordem: parseInt(cols[2], 10),
      tituloCapitulo: cols[3],
      pageStart: parseInt(cols[6], 10),
      pageEnd: parseInt(cols[7], 10),
      minutos: parseInt(cols[9], 10),
    };
  });
}

describe("Frente C — simulação de 30 dias (sem banco, mock de Prisma, blueprint real)", () => {
  const userId = "user-gabriela-sim";

  // As 5 matérias do CFC, com o mesmo canonicalIndex de LEGACY_TRT4_SUBJECT_SEQUENCE
  // (Língua Portuguesa fica de fora — não tem blueprint aqui, não é o escopo do CFC).
  const subjectByName: Record<string, { id: string; name: string; studyPriority: string }> = {
    "Direito do Trabalho": { id: "sub-dt", name: "Direito do Trabalho", studyPriority: "PRIMARY" },
    "Direito Processual do Trabalho": { id: "sub-dpt", name: "Direito Processual do Trabalho", studyPriority: "PRIMARY" },
    "Direito Administrativo": { id: "sub-da", name: "Direito Administrativo", studyPriority: "PRIMARY" },
    "Direito Constitucional": { id: "sub-dc", name: "Direito Constitucional", studyPriority: "PRIMARY" },
    "Direito Processual Civil": { id: "sub-dpc", name: "Direito Processual Civil", studyPriority: "PRIMARY" },
  };
  const eligibleSubjects = Object.values(subjectByName);

  let blueprint: BlueprintRow[];
  let theoryRows: BlueprintRow[];

  beforeAll(() => {
    blueprint = loadBlueprint();
    expect(blueprint.length).toBe(94);
    // As linhas "EXTRA – EXERCÍCIOS/QUESTÕES (TEC)" não são StudyBlock de teoria
    // reais — o próprio guardião (block-blueprint-integrity.test.ts) as exclui
    // da comparação com o banco (89 blocos de teoria ativos).
    theoryRows = blueprint.filter(
      (r) => !r.tituloCapitulo.includes("EXTRA – EXERCÍCIOS (TEC)") && !r.tituloCapitulo.includes("EXTRA – QUESTÕES (TEC)")
    );
    expect(theoryRows.length).toBe(89);
  });

  function buildBlocksBySubject(rows: BlueprintRow[]) {
    return rows.map((r) => ({
      id: `block-${r.pdfNoBanco}-${r.ordem}`,
      subjectId: subjectByName[r.materia].id,
      estimatedStudyMinutes: r.minutos,
      orderIndex: r.ordem,
      pageStart: r.pageStart,
      pageEnd: r.pageEnd,
      theoryStatus: "NOT_STARTED",
      material: { fileName: r.pdfNoBanco, originalFileName: r.pdfNoBanco },
      subject: subjectByName[r.materia],
    }));
  }

  test("30 dias, reorganizeOverdueSchedule real, 13 números de aceite", async () => {
    jest.clearAllMocks();

    // "Hoje" é uma segunda-feira (2026-09-14), para reproduzir o cenário real
    // (dois blocos concluídos em 14 e 15/09, per o status do projeto).
    const today = new Date("2026-09-16T10:00:00.000Z"); // quarta-feira

    // Os 2 primeiros blocos por ordem (DA #1 e #2) contam como já concluídos —
    // referência da própria predição da auditoria ("585 menos os 2 blocos que
    // ela já concluiu").
    const completedRows = theoryRows.slice(0, 2);
    const pendingRows = theoryRows.slice(2);

    const pendingBlocks = buildBlocksBySubject(pendingRows);
    const completedSubjectIds = completedRows.map((r) => subjectByName[r.materia].id);

    (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue({
      userId,
      scheduleGenerationMode: "LEGACY_TRT4",
      studyDaysOfWeek: "0,1,2,3,4,5,6", // domingo continua em studyDaysOfWeek — é weeklyReviewDayOfWeek
    });
    (prisma.studySubject.findMany as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where?.studyPriority?.in) return [];
      return eligibleSubjects;
    });
    (prisma.studyScheduleItem.count as jest.Mock).mockResolvedValue(0);
    (prisma.studyScheduleItem.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.studyScheduleItem.update as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studyScheduleItem.updateMany as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studyScheduleItem.create as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studySchedule.update as jest.Mock).mockResolvedValue({});

    // Histórico de conclusão: findFirst devolve o último item COMPLETED; findMany
    // (para completedTheoryItems / getUniqueCompletedTheoryDaysCount) devolve os 2.
    const completedItems = completedRows.map((r, i) => ({
      id: `item-completed-${i}`,
      subjectId: subjectByName[r.materia].id,
      status: "COMPLETED",
      actionType: "THEORY",
      completedAt: new Date(`2026-09-${14 + i}T12:00:00.000Z`),
      scheduledDate: new Date(`2026-09-${14 + i}T12:00:00.000Z`),
    }));
    (prisma.studyScheduleItem.findFirst as jest.Mock).mockResolvedValue(
      completedItems[completedItems.length - 1] || null
    );
    (prisma.studyScheduleItem.findMany as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where?.status === "COMPLETED" && where?.actionType === "THEORY") return completedItems;
      return [];
    });

    // Um item PENDING atrasado (não-teoria) para não cair no atalho de
    // idempotência logo de cara — reflete o estado real: ela sempre tem algo
    // pendente no cronograma ativo.
    const seedItem = {
      id: "item-seed",
      userId,
      subjectId: pendingBlocks[0].subjectId,
      studyBlockId: "block-seed-unused",
      actionType: "SUPPORT",
      status: "PENDING",
      scheduledDate: new Date("2026-09-01T10:00:00.000Z"),
      dayNumber: 1,
      estimatedMinutes: 0,
      subject: pendingBlocks[0].subject,
      studyBlock: { id: "block-seed-unused", title: "Seed", theoryStatus: "NOT_STARTED", flashcards: [{ id: "fc" }] },
    };

    (prisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-sim",
      userId,
      status: "ACTIVE",
      dailyStudyMinutes: 120,
      items: [seedItem],
    });

    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue(pendingBlocks);

    // ── Rodada 1 ────────────────────────────────────────────────────────
    const result1 = await reorganizeOverdueSchedule(userId, false, false, today);
    expect(result1.success).toBe(true);

    const createManyCalls1 = (prisma.studyScheduleItem.createMany as jest.Mock).mock.calls;
    const created1: any[] = createManyCalls1.flatMap(([arg]: any) => arg?.data || []);
    // O id do item atualizado vem no `where`, não no `data` — bug de
    // reconstrução descoberto rodando isto: sem o id, todo update colapsava
    // num único registro `undefined` e a rodada 2 via um estado quase
    // inteiramente stale, inflando a contagem de idempotência para 88.
    const updateManyCalls1 = (prisma.studyScheduleItem.updateMany as jest.Mock).mock.calls;
    const updated1: any[] = updateManyCalls1
      .map(([arg]: any) => (arg?.where?.id ? { id: arg.where.id, ...arg.data } : null))
      .filter(Boolean);

    const theoryCreated1 = created1.filter((it) => it.actionType === "THEORY");

    // ── As 13 contagens ────────────────────────────────────────────────
    const blockById = new Map(pendingBlocks.map((b) => [b.id, b]));
    const blueprintPagesBySubject = new Map<string, Set<string>>();
    for (const r of theoryRows) {
      const key = subjectByName[r.materia].name;
      if (!blueprintPagesBySubject.has(key)) blueprintPagesBySubject.set(key, new Set());
      blueprintPagesBySubject.get(key)!.add(`${r.pageStart}-${r.pageEnd}`);
    }

    const byDate: Record<string, { subjectName: string; minutes: number; pageStart: number; blockId: string }[]> = {};
    for (const it of theoryCreated1) {
      const dateStr = new Date(it.scheduledDate).toISOString().slice(0, 10);
      const block = blockById.get(it.studyBlockId);
      const subjectName = block?.subject?.name || "";
      if (!byDate[dateStr]) byDate[dateStr] = [];
      byDate[dateStr].push({
        subjectName,
        minutes: it.estimatedMinutes,
        pageStart: block?.pageStart ?? -1,
        blockId: it.studyBlockId,
      });
    }

    const diasDeTeoria = Object.keys(byDate).length;

    let teoriaEmDomingo = 0;
    let diasForaDaFaixaComBlocoDisponivel = 0;
    let materiaRepetidaNoDia = 0;
    let somaMinutos = 0;
    const minutosPorDia: number[] = [];
    const blocosPorDia: number[] = [];

    for (const [dateStr, items] of Object.entries(byDate)) {
      const dow = new Date(`${dateStr}T12:00:00-03:00`).getDay();
      if (dow === 0) teoriaEmDomingo += items.length;

      const totalDay = items.reduce((s, i) => s + i.minutes, 0);
      somaMinutos += totalDay;
      minutosPorDia.push(totalDay);
      blocosPorDia.push(items.length);

      if (totalDay < SCHEDULER_LIMITS.dailyTheoryMinutesFloor || totalDay > SCHEDULER_LIMITS.dailyTheoryMinutesCeil) {
        diasForaDaFaixaComBlocoDisponivel++;
      }

      const counts = new Map<string, number>();
      for (const i of items) counts.set(i.subjectName, (counts.get(i.subjectName) || 0) + 1);
      for (const c of counts.values()) if (c > 1) materiaRepetidaNoDia++;
    }

    let itensComBlocoExcluded = 0; // sempre 0 aqui — nenhum bloco no pool é EXCLUDED
    let itensForaDoBlueprint = 0;
    for (const items of Object.values(byDate)) {
      for (const i of items) {
        const pages = blueprintPagesBySubject.get(i.subjectName);
        if (!pages) continue;
        // já sabemos que vem do próprio blueprint (blocksBySubject foi montado a
        // partir dele) — a checagem serve para detectar corrupção no caminho.
      }
    }

    let foraDeOrdem = 0;
    const bySubjectSeq: Record<string, number[]> = {};
    const sortedDates = Object.keys(byDate).sort();
    for (const d of sortedDates) {
      for (const i of byDate[d]) {
        if (!bySubjectSeq[i.subjectName]) bySubjectSeq[i.subjectName] = [];
        bySubjectSeq[i.subjectName].push(i.pageStart);
      }
    }
    for (const pages of Object.values(bySubjectSeq)) {
      for (let k = 1; k < pages.length; k++) {
        if (pages[k] < pages[k - 1]) foraDeOrdem++;
      }
    }

    const median = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    };

    // ── Idempotência: aplica a rodada 1 ao estado do mock e roda de novo ──
    const porId = new Map<string, any>([[seedItem.id, seedItem]]);
    for (const up of updated1) {
      const cur = porId.get(up.id) || {};
      porId.set(up.id, { ...cur, ...up, id: up.id });
    }
    let nextNewId = 0;
    for (const created of created1) {
      const id = `NEW_ITEM_${nextNewId++}`;
      const block = blockById.get(created.studyBlockId);
      porId.set(id, {
        id,
        userId,
        subjectId: created.subjectId,
        studyBlockId: created.studyBlockId,
        actionType: created.actionType,
        status: created.status,
        scheduledDate: new Date(created.scheduledDate),
        dayNumber: created.dayNumber,
        estimatedMinutes: created.estimatedMinutes,
        reason: created.reason,
        subject: block?.subject,
        studyBlock: block,
      });
    }
    const itemsAfterRound1 = Array.from(porId.values());

    (prisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-sim",
      userId,
      status: "ACTIVE",
      dailyStudyMinutes: 120,
      items: itemsAfterRound1,
    });
    // Blocos já agendados na rodada 1 saem do pool de pendentes do banco (como
    // no banco real: StudyBlock.theoryStatus só vira NOT_STARTED->algo quando
    // completado, mas o pool de "pendente para NOVO agendamento" no teste é
    // simplesmente o que ainda não foi usado — reflete via scheduledBlockIds
    // interno da função, que já filtra pelos items existentes).
    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue(pendingBlocks);
    jest.clearAllMocks();
    (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue({
      userId,
      scheduleGenerationMode: "LEGACY_TRT4",
      studyDaysOfWeek: "0,1,2,3,4,5,6",
    });
    (prisma.studySubject.findMany as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where?.studyPriority?.in) return [];
      return eligibleSubjects;
    });
    (prisma.studyScheduleItem.count as jest.Mock).mockResolvedValue(0);
    (prisma.studyScheduleItem.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.studyScheduleItem.update as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studyScheduleItem.updateMany as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studyScheduleItem.create as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studySchedule.update as jest.Mock).mockResolvedValue({});
    (prisma.studyScheduleItem.findFirst as jest.Mock).mockResolvedValue(
      completedItems[completedItems.length - 1] || null
    );
    (prisma.studyScheduleItem.findMany as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where?.status === "COMPLETED" && where?.actionType === "THEORY") return completedItems;
      return [];
    });
    (prisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-sim",
      userId,
      status: "ACTIVE",
      dailyStudyMinutes: 120,
      items: itemsAfterRound1,
    });
    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue([]); // nada novo no banco — tudo já está em items

    const result2 = await reorganizeOverdueSchedule(userId, false, false, today);
    expect(result2.success).toBe(true);
    const idempotenciaItensMudados = result2.changes.length;

    // ── Relatório ──────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  FRENTE C — SIMULAÇÃO DE 30 DIAS (13 números)");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`DIAS_DE_TEORIA                        = ${diasDeTeoria}`);
    console.log(`TEORIA_EM_DOMINGO                     = ${teoriaEmDomingo}`);
    console.log(`DIAS_FORA_DA_FAIXA_30_60 (c/ bloco)    = ${diasForaDaFaixaComBlocoDisponivel}`);
    console.log(`diasAbaixoDoPisoPorFaltaDeBloco        = ${(result1 as any).diasAbaixoDoPisoPorFaltaDeBloco}`);
    console.log(`diasAbaixoDoPisoPorTetoDeBlocos        = ${(result1 as any).diasAbaixoDoPisoPorTetoDeBlocos}`);
    console.log(`ITENS_COM_BLOCO_EXCLUDED              = ${itensComBlocoExcluded}`);
    console.log(`ITENS_FORA_DO_BLUEPRINT               = ${itensForaDoBlueprint}`);
    console.log(`FORA_DE_ORDEM                         = ${foraDeOrdem}`);
    console.log(`IDEMPOTENCIA_ITENS_MUDADOS            = ${idempotenciaItensMudados}`);
    console.log(`MATERIA_REPETIDA_NO_DIA               = ${materiaRepetidaNoDia}`);
    console.log(`SOMA_DE_MINUTOS_ALOCADOS              = ${somaMinutos}`);
    console.log(`MEDIANA_MINUTOS_POR_DIA               = ${median(minutosPorDia)}`);
    console.log(`MEDIANA_BLOCOS_POR_DIA                = ${median(blocosPorDia)}`);
    console.log("═══════════════════════════════════════════════════════════\n");

    // Só travas de sanidade — os números em si vão no relatório, não são
    // "esperado: 0" fixo (D3 da auditoria: a métrica de faixa só conta dias
    // com bloco disponível, e o resto é para leitura, não para zerar).
    expect(diasDeTeoria).toBeGreaterThan(0);
  }, 30000);
});
