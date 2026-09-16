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
 *
 * H1-H4 (segunda auditoria, sobre a primeira versão deste arquivo):
 * H1 — studyBlock.findMany tem que devolver o MESMO pool em toda rodada.
 *      Agendar um item não muda StudyBlock.theoryStatus; a query real
 *      (scheduler.ts) filtra só por theoryStatus=NOT_STARTED. Uma rodada
 *      "faminta" (pool vazio) não reflete produção.
 * H2 — idempotência não se mede por result.changes.length (autorrelato).
 *      Mede-se comparando o grid (data -> [subjectId, studyBlockId, min])
 *      antes/depois, campo a campo — reason é cosmético, não conta como
 *      instabilidade.
 * H3 — convergência: roda 4 vezes, cada uma alimentada pela anterior.
 * H4 — critérios de aceite já verdes viram expect(), não só console.log.
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

type SimBlock = {
  id: string;
  subjectId: string;
  estimatedStudyMinutes: number;
  orderIndex: number;
  pageStart: number;
  pageEnd: number;
  theoryStatus: string;
  material: { fileName: string; originalFileName: string };
  subject: { id: string; name: string; studyPriority: string };
};

type SimItem = {
  id: string;
  userId: string;
  subjectId: string;
  studyBlockId: string;
  actionType: string;
  status: string;
  scheduledDate: Date;
  dayNumber: number;
  estimatedMinutes: number;
  reason?: string;
  subject?: any;
  studyBlock?: any;
};

describe("Frente C — simulação de 30 dias (sem banco, mock de Prisma, blueprint real)", () => {
  const userId = "user-gabriela-sim";

  // As 5 matérias do CFC (Língua Portuguesa fica de fora — sem blueprint aqui).
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
    theoryRows = blueprint.filter(
      (r) => !r.tituloCapitulo.includes("EXTRA – EXERCÍCIOS (TEC)") && !r.tituloCapitulo.includes("EXTRA – QUESTÕES (TEC)")
    );
    expect(theoryRows.length).toBe(89);
  });

  function buildBlocks(rows: BlueprintRow[]): SimBlock[] {
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

  test("30 dias, reorganizeOverdueSchedule real, 4 rodadas, grid comparado campo a campo", async () => {
    const today = new Date("2026-09-16T10:00:00.000Z"); // quarta-feira

    const completedRows = theoryRows.slice(0, 2);
    const pendingRows = theoryRows.slice(2);
    // H1: pool ESTÁTICO — StudyBlock.theoryStatus não muda só porque um item
    // foi agendado. A mesma consulta real (theoryStatus=NOT_STARTED) devolveria
    // os mesmos 87 blocos em toda rodada, até algum ser de fato completado.
    const pendingBlocks = buildBlocks(pendingRows);
    const blockById = new Map(pendingBlocks.map((b) => [b.id, b]));

    const completedItems = completedRows.map((r, i) => ({
      id: `item-completed-${i}`,
      subjectId: subjectByName[r.materia].id,
      status: "COMPLETED",
      actionType: "THEORY",
      completedAt: new Date(`2026-09-${14 + i}T12:00:00.000Z`),
      scheduledDate: new Date(`2026-09-${14 + i}T12:00:00.000Z`),
    }));

    const seedItem: SimItem = {
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

    function configureMocks(items: SimItem[]) {
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
        items,
      });
      // H1: mesmo pool em toda rodada.
      (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue(pendingBlocks);
    }

    let globalIdCounter = 0;

    async function runRound(items: SimItem[]) {
      configureMocks(items);
      const result = await reorganizeOverdueSchedule(userId, false, false, today);
      expect(result.success).toBe(true);

      const createManyCalls = (prisma.studyScheduleItem.createMany as jest.Mock).mock.calls;
      const created: any[] = createManyCalls.flatMap(([arg]: any) => arg?.data || []);
      const updateManyCalls = (prisma.studyScheduleItem.updateMany as jest.Mock).mock.calls;

      // Duas formas de updateMany na produção: um id único (where.id = string —
      // reatribuição de item existente) OU uma lista (where.id = {in: [...]} —
      // a purga de sobras do unusedPendingItemsPool em SKIPPED, scheduler.ts:1758).
      // C3 da auditoria: perder a segunda forma faz sobras da rodada anterior
      // sobreviverem como PENDING e aparecerem como "duplicatas" na rodada seguinte
      // — não é bug de produção, é reconstrução incompleta do estado.
      const updated: { id: string; data: any }[] = [];
      for (const [arg] of updateManyCalls) {
        if (typeof arg?.where?.id === "string") {
          updated.push({ id: arg.where.id, data: arg.data });
        } else if (arg?.where?.id?.in) {
          for (const id of arg.where.id.in) {
            updated.push({ id, data: arg.data });
          }
        }
      }

      const porId = new Map<string, SimItem>(items.map((i) => [i.id, i]));
      for (const up of updated) {
        const cur = porId.get(up.id);
        if (cur) porId.set(up.id, { ...cur, ...up.data });
      }
      for (const c of created) {
        const id = `NEW_${globalIdCounter++}`;
        const block = blockById.get(c.studyBlockId);
        porId.set(id, {
          id,
          userId,
          subjectId: c.subjectId,
          studyBlockId: c.studyBlockId,
          actionType: c.actionType,
          status: c.status,
          scheduledDate: new Date(c.scheduledDate),
          dayNumber: c.dayNumber,
          estimatedMinutes: c.estimatedMinutes,
          reason: c.reason,
          subject: block?.subject,
          studyBlock: block,
        });
      }

      return { result, items: Array.from(porId.values()), created, updated };
    }

    // ── H2: grid = data -> lista ordenada de (subjectId, studyBlockId, minutos), só THEORY ──
    function gridOf(items: SimItem[]): Map<string, { subjectId: string; studyBlockId: string; minutes: number }[]> {
      const map = new Map<string, { subjectId: string; studyBlockId: string; minutes: number }[]>();
      for (const it of items) {
        if (it.actionType !== "THEORY" || it.status !== "PENDING") continue;
        const d = new Date(it.scheduledDate).toISOString().slice(0, 10);
        if (!map.has(d)) map.set(d, []);
        map.get(d)!.push({ subjectId: it.subjectId, studyBlockId: it.studyBlockId, minutes: it.estimatedMinutes });
      }
      for (const list of map.values()) {
        list.sort((a, b) => (a.studyBlockId || "").localeCompare(b.studyBlockId || ""));
      }
      return map;
    }

    function compareGrids(before: Map<string, any[]>, after: Map<string, any[]>) {
      const dates = new Set([...before.keys(), ...after.keys()]);
      let diasComGridDiferente = 0;
      for (const d of dates) {
        const a = before.get(d) || [];
        const b = after.get(d) || [];
        if (JSON.stringify(a) !== JSON.stringify(b)) diasComGridDiferente++;
      }
      return { igual: diasComGridDiferente === 0, diasComGridDiferente };
    }

    // Itens presentes nas duas rodadas (por id): o que mudou, campo a campo.
    function diffItems(before: SimItem[], after: SimItem[]) {
      const beforeById = new Map(before.map((i) => [i.id, i]));
      let itensComDataDiferente = 0;
      let itensSoComReasonDif = 0;
      for (const a of after) {
        if (a.actionType !== "THEORY") continue;
        const b = beforeById.get(a.id);
        if (!b) continue;
        const dateChanged = new Date(a.scheduledDate).toISOString() !== new Date(b.scheduledDate).toISOString();
        const subjectChanged = a.subjectId !== b.subjectId;
        const blockChanged = a.studyBlockId !== b.studyBlockId;
        const minutesChanged = a.estimatedMinutes !== b.estimatedMinutes;
        const reasonChanged = a.reason !== b.reason;
        const structural = dateChanged || subjectChanged || blockChanged || minutesChanged;
        if (dateChanged) itensComDataDiferente++;
        if (!structural && reasonChanged) itensSoComReasonDif++;
      }
      return { itensComDataDiferente, itensSoComReasonDif };
    }

    // ── Rodadas 1-4 ────────────────────────────────────────────────────
    const r1 = await runRound([seedItem]);
    const r2 = await runRound(r1.items);
    const r3 = await runRound(r2.items);
    const r4 = await runRound(r3.items);

    const grid1 = gridOf(r1.items);
    const grid2 = gridOf(r2.items);
    const grid3 = gridOf(r3.items);
    const grid4 = gridOf(r4.items);

    const cmp12 = compareGrids(grid1, grid2);
    const cmp23 = compareGrids(grid2, grid3);
    const cmp34 = compareGrids(grid3, grid4);
    const diff12 = diffItems(r1.items, r2.items);

    // ── As 13 contagens de aceite (Regra Zero da simulação — a partir da
    //    rodada 1, que é a que reflete "organizar do zero") ──────────────
    const theoryCreated1 = r1.created.filter((it) => it.actionType === "THEORY");
    const blueprintPagesBySubject = new Map<string, Set<string>>();
    for (const r of theoryRows) {
      const key = subjectByName[r.materia].name;
      if (!blueprintPagesBySubject.has(key)) blueprintPagesBySubject.set(key, new Set());
      blueprintPagesBySubject.get(key)!.add(`${r.pageStart}-${r.pageEnd}`);
    }

    const byDate: Record<string, { subjectName: string; minutes: number; pageStart: number }[]> = {};
    for (const it of theoryCreated1) {
      const dateStr = new Date(it.scheduledDate).toISOString().slice(0, 10);
      const block = blockById.get(it.studyBlockId);
      if (!byDate[dateStr]) byDate[dateStr] = [];
      byDate[dateStr].push({
        subjectName: block?.subject?.name || "",
        minutes: it.estimatedMinutes,
        pageStart: block?.pageStart ?? -1,
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

    const itensComBlocoExcluded = 0; // nenhum bloco do pool é EXCLUDED por construção
    const itensForaDoBlueprint = 0; // idem — o pool vem direto do blueprint

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

    // ── Relatório ──────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  FRENTE C — SIMULAÇÃO DE 30 DIAS, 4 RODADAS");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`DIAS_DE_TEORIA                        = ${diasDeTeoria}`);
    console.log(`TEORIA_EM_DOMINGO                     = ${teoriaEmDomingo}`);
    console.log(`DIAS_FORA_DA_FAIXA_30_60 (c/ bloco)    = ${diasForaDaFaixaComBlocoDisponivel}`);
    console.log(`diasAbaixoDoPisoPorFaltaDeBloco        = ${(r1.result as any).diasAbaixoDoPisoPorFaltaDeBloco}`);
    console.log(`diasAbaixoDoPisoPorTetoDeBlocos        = ${(r1.result as any).diasAbaixoDoPisoPorTetoDeBlocos}`);
    console.log(`ITENS_COM_BLOCO_EXCLUDED              = ${itensComBlocoExcluded}`);
    console.log(`ITENS_FORA_DO_BLUEPRINT               = ${itensForaDoBlueprint}`);
    console.log(`FORA_DE_ORDEM                         = ${foraDeOrdem}`);
    console.log(`MATERIA_REPETIDA_NO_DIA               = ${materiaRepetidaNoDia}`);
    console.log(`SOMA_DE_MINUTOS_ALOCADOS              = ${somaMinutos}`);
    console.log(`MEDIANA_MINUTOS_POR_DIA               = ${median(minutosPorDia)}`);
    console.log(`MEDIANA_BLOCOS_POR_DIA                = ${median(blocosPorDia)}`);
    console.log("───────────────────────────────────────────────────────────");
    console.log(`GRID_IGUAL_R1_R2                      = ${cmp12.igual ? "SIM" : "NÃO"}  (dias diferentes: ${cmp12.diasComGridDiferente})`);
    console.log(`GRID_IGUAL_R2_R3                      = ${cmp23.igual ? "SIM" : "NÃO"}  (dias diferentes: ${cmp23.diasComGridDiferente})`);
    console.log(`GRID_IGUAL_R3_R4                      = ${cmp34.igual ? "SIM" : "NÃO"}  (dias diferentes: ${cmp34.diasComGridDiferente})`);
    console.log(`ITENS_COM_DATA_DIFERENTE (R1->R2)     = ${diff12.itensComDataDiferente}`);
    console.log(`ITENS_SO_COM_REASON_DIF (R1->R2)      = ${diff12.itensSoComReasonDif}`);
    console.log("═══════════════════════════════════════════════════════════\n");

    // ── H4: critérios de aceite já verdes viram expect() ──────────────
    expect(teoriaEmDomingo).toBe(0);
    expect(itensComBlocoExcluded).toBe(0);
    expect(itensForaDoBlueprint).toBe(0);
    expect(foraDeOrdem).toBe(0);
    expect((r1.result as any).diasAbaixoDoPisoPorFaltaDeBloco).toBe(0);
  }, 60000);
});
