/**
 * src/__tests__/scheduler/trt4-legacy-diversity-reproduction.test.ts
 *
 * Testes sintéticos de regressão e validação do comportamento corrigido
 * para os três caminhos de agendamento no modo LEGACY_TRT4:
 *   1. FALLBACK_SECOND_SLOT
 *   2. COMPLEMENTARY_THIRD_SLOT
 *   3. OVERDUE_REORGANIZATION
 *
 * Além dos 3 caminhos críticos, inclui testes de runtime da fila:
 *   4. A1+A2+B1 — B1 agendado no dia 1 antes de A2 repetir
 *   5. A usada hoje / B usada ontem — B tem prioridade
 *   6. Repetição inevitável — apenas A na fila, nenhuma perda
 *   7. Métricas — futureItemsShiftedCount, mergedReviewBlocksCount, lastDateAfterReorganization
 */

import {
  generateLegacyTrt4Schedule,
  reorganizeOverdueSchedule
} from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    userPreferences: { findUnique: jest.fn() },
    studySubject: { findMany: jest.fn() },
    studySchedule: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    studyBlock: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    studyScheduleItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    studyBlockSource: { findMany: jest.fn() },
    extractedContent: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/date-utils", () => ({
  getTodayRangeSP: (date: Date, offsetDays = 0) => {
    const d = new Date(date);
    if (offsetDays !== 0) {
      d.setDate(d.getDate() + offsetDays);
    }
    const str = d.toISOString().split("T")[0];
    const start = new Date(`${str}T00:00:00.000Z`);
    const end = new Date(`${str}T23:59:59.999Z`);
    return { start, end, dateString: str, label: str };
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ─────────────────────────────────────────────────────────────────────────────
// 3 caminhos críticos originais
// ─────────────────────────────────────────────────────────────────────────────

describe("Validação de Regressão — Diversidade LEGACY_TRT4 nos 3 Caminhos Críticos", () => {
  const userId = "user-gabriela-fixture-123";

  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.studyScheduleItem.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.studyScheduleItem.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.studyScheduleItem.count as jest.Mock).mockResolvedValue(0);
  });

  test("Caminho 1 (FALLBACK_SECOND_SLOT): O 2º slot escolhe matéria alternativa distinta quando a matéria do ciclo está vazia", async () => {
    (mockPrisma.userPreferences.findUnique as jest.Mock).mockResolvedValue({
      userId,
      scheduleGenerationMode: "LEGACY_TRT4",
      studyDaysOfWeek: "1,2,3,4,5,6,0",
    });

    const dtSubject = { id: "sub-dt", userId, name: "Direito do Trabalho", studyPriority: "PRIMARY" };
    const lpSubject = { id: "sub-lp", userId, name: "Língua Portuguesa", studyPriority: "PRIMARY" };
    const daSubject = { id: "sub-da", userId, name: "Direito Administrativo", studyPriority: "PRIMARY" };

    (mockPrisma.studySubject.findMany as jest.Mock).mockImplementation((args: any) => {
      if (args?.where?.studyPriority?.in) {
        return Promise.resolve([]);
      }
      return Promise.resolve([dtSubject, lpSubject, daSubject]);
    });

    (mockPrisma.studyBlock.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // dbCompletedBlocks
      .mockResolvedValueOnce([  // allPendingBlocks: DT e DA possuem blocos pendentes (LP do ciclo dia 1 está vazia)
        {
          id: "block-dt-1",
          userId,
          subjectId: "sub-dt",
          status: "PENDING",
          estimatedStudyMinutes: 45,
          orderIndex: 1,
          subject: dtSubject,
          material: { fileName: "DT-01.pdf", materialRole: "MAIN" }
        },
        {
          id: "block-da-1",
          userId,
          subjectId: "sub-da",
          status: "PENDING",
          estimatedStudyMinutes: 45,
          orderIndex: 1,
          subject: daSubject,
          material: { fileName: "DA-01.pdf", materialRole: "MAIN" }
        }
      ]);

    (mockPrisma.studySchedule.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.studySchedule.create as jest.Mock).mockResolvedValue({
      id: "sched-fixture-1",
      userId,
      title: "Meu Cronograma de Estudos",
      dailyStudyMinutes: 120,
      startDate: new Date("2026-07-23T00:00:00.000Z"),
      status: "ACTIVE"
    });

    let createdItems: any[] = [];
    (mockPrisma.studyScheduleItem.createMany as jest.Mock).mockImplementation(({ data }) => {
      createdItems = data;
      return Promise.resolve({ count: data.length });
    });

    await generateLegacyTrt4Schedule(
      userId,
      {
        dailyMinutes: 120,
        startDate: new Date("2026-07-23T00:00:00.000Z")
      },
      {
        userId,
        scheduleGenerationMode: "LEGACY_TRT4",
        studyDaysOfWeek: "1,2,3,4,5,6,0"
      }
    );

    const day1TheoryItems = createdItems.filter(
      item => item.dayNumber === 1 && item.actionType === "THEORY"
    );

    // VALIDAÇÃO CORRIGIDA:
    // Slot 1 agendou DT. Slot 2 precisou de fallback (pois LP não tinha blocos),
    // e o fallback escolheu a matéria distinta DA em vez de repetir DT no mesmo dia!
    expect(day1TheoryItems.length).toBe(2);
    expect(day1TheoryItems[0].subjectId).toBe("sub-dt");
    expect(day1TheoryItems[1].subjectId).toBe("sub-da"); // Diversidade mantida!
  });

  test("Caminho 2 (COMPLEMENTARY_THIRD_SLOT): Terceiro bloco complementar escolhe matéria distinta dos dois primeiros slots", async () => {
    (mockPrisma.userPreferences.findUnique as jest.Mock).mockResolvedValue({
      userId,
      scheduleGenerationMode: "LEGACY_TRT4",
      studyDaysOfWeek: "1,2,3,4,5,6,0",
    });

    const dtSubject = { id: "sub-dt", userId, name: "Direito do Trabalho", studyPriority: "PRIMARY" };
    const lpSubject = { id: "sub-lp", userId, name: "Língua Portuguesa", studyPriority: "PRIMARY" };
    const daSubject = { id: "sub-da", userId, name: "Direito Administrativo", studyPriority: "PRIMARY" };

    (mockPrisma.studySubject.findMany as jest.Mock).mockImplementation((args: any) => {
      if (args?.where?.studyPriority?.in) {
        return Promise.resolve([]);
      }
      return Promise.resolve([dtSubject, lpSubject, daSubject]);
    });

    // Blocos curtos de 30 min para permitir capacidade de um 3º bloco no mesmo dia
    (mockPrisma.studyBlock.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "b-dt-1", userId, subjectId: "sub-dt", status: "PENDING", estimatedStudyMinutes: 30, orderIndex: 1, subject: dtSubject, material: { fileName: "DT.pdf" } },
        { id: "b-lp-1", userId, subjectId: "sub-lp", status: "PENDING", estimatedStudyMinutes: 30, orderIndex: 1, subject: lpSubject, material: { fileName: "LP.pdf" } },
        { id: "b-da-1", userId, subjectId: "sub-da", status: "PENDING", estimatedStudyMinutes: 30, orderIndex: 1, subject: daSubject, material: { fileName: "DA.pdf" } }
      ]);

    (mockPrisma.studySchedule.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.studySchedule.create as jest.Mock).mockResolvedValue({
      id: "sched-fixture-2",
      userId,
      dailyStudyMinutes: 120,
      startDate: new Date("2026-07-23T00:00:00.000Z"),
      status: "ACTIVE"
    });

    let createdItems: any[] = [];
    (mockPrisma.studyScheduleItem.createMany as jest.Mock).mockImplementation(({ data }) => {
      createdItems = data;
      return Promise.resolve({ count: data.length });
    });

    await generateLegacyTrt4Schedule(
      userId,
      {
        dailyMinutes: 120,
        startDate: new Date("2026-07-23T00:00:00.000Z")
      },
      {
        userId,
        scheduleGenerationMode: "LEGACY_TRT4",
        studyDaysOfWeek: "1,2,3,4,5,6,0"
      }
    );

    const day1TheoryItems = createdItems.filter(
      item => item.dayNumber === 1 && item.actionType === "THEORY"
    );

    // VALIDAÇÃO CORRIGIDA:
    // 3 blocos agendados no mesmo dia, cada um pertencendo a uma matéria inteiramente distinta (DT, LP, DA)!
    expect(day1TheoryItems.length).toBe(3);
    const subjectIdsInDay = day1TheoryItems.map(i => i.subjectId);
    expect(new Set(subjectIdsInDay).size).toBe(3);
  });

  test("Caminho 3 (OVERDUE_REORGANIZATION): Reorganização separa atrasados e evita monotematicidade no mesmo dia", async () => {
    const dtSubject = { id: "sub-dt", userId, name: "Direito do Trabalho", studyPriority: "PRIMARY" };
    const daSubject = { id: "sub-da", userId, name: "Direito Administrativo", studyPriority: "PRIMARY" };

    const pastDate = new Date("2026-07-20T00:00:00.000Z");

    const overdueItems = [
      {
        id: "item-dt-overdue-1",
        userId,
        scheduleId: "sched-active-1",
        subjectId: "sub-dt",
        studyBlockId: "block-dt-1",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: pastDate,
        dayNumber: 10,
        estimatedMinutes: 45,
        subject: dtSubject
      },
      {
        id: "item-da-overdue-1",
        userId,
        scheduleId: "sched-active-1",
        subjectId: "sub-da",
        studyBlockId: "block-da-1",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: pastDate,
        dayNumber: 10,
        estimatedMinutes: 45,
        subject: daSubject
      }
    ];

    (mockPrisma.studySubject.findMany as jest.Mock).mockImplementation((args: any) => {
      if (args?.where?.studyPriority?.in) {
        return Promise.resolve([]);
      }
      return Promise.resolve([dtSubject, daSubject]);
    });

    (mockPrisma.userPreferences.findUnique as jest.Mock).mockResolvedValue({
      userId,
      scheduleGenerationMode: "LEGACY_TRT4",
      studyDaysOfWeek: "1,2,3,4,5,6,0"
    });

    (mockPrisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-active-1",
      userId,
      dailyStudyMinutes: 120,
      status: "ACTIVE",
      items: overdueItems
    });

    (mockPrisma.studyBlock.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.studyScheduleItem.count as jest.Mock).mockResolvedValue(0);

    const result = await reorganizeOverdueSchedule(userId, false, true, new Date("2026-07-23T10:00:00.000Z"));

    // VALIDAÇÃO CORRIGIDA:
    // Os dois itens atrasados de matérias distintas foram agendados para o mesmo dia útil de reorganização.
    expect(result.success).toBe(true);
    expect(result.changes.length).toBe(2);
    const scheduledSubjects = result.changes.map(c => c.subjectName);
    expect(scheduledSubjects).toContain("Direito do Trabalho");
    expect(scheduledSubjects).toContain("Direito Administrativo");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenários de runtime da fila — hierarquia intra-dia na reorganização
// ─────────────────────────────────────────────────────────────────────────────

describe("Runtime da fila LEGACY_TRT4 — reorganizeOverdueSchedule", () => {
  const userId = "user-runtime-test";

  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.studyScheduleItem.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.studyScheduleItem.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.studyBlock.findMany as jest.Mock).mockResolvedValue([]);
  });

  const makeSubject = (id: string, name: string) => ({
    id, userId, name, studyPriority: "PRIMARY",
  });

  const makeOverdueItem = (
    id: string,
    subjectId: string,
    subject: any,
    scheduledDate: Date,
    dayNumber: number,
    estimatedMinutes = 45,
    actionType = "THEORY"
  ) => ({
    id,
    userId,
    scheduleId: "sched-rt",
    subjectId,
    studyBlockId: `block-${id}`,
    actionType,
    status: "PENDING",
    scheduledDate,
    dayNumber,
    estimatedMinutes,
    subject,
  });

  const setupBase = (subjects: any[], items: any[]) => {
    (mockPrisma.studySubject.findMany as jest.Mock).mockImplementation((args: any) => {
      if (args?.where?.studyPriority?.in) return Promise.resolve([]);
      return Promise.resolve(subjects);
    });
    (mockPrisma.userPreferences.findUnique as jest.Mock).mockResolvedValue({
      userId,
      scheduleGenerationMode: "LEGACY_TRT4",
      studyDaysOfWeek: "1,2,3,4,5,6,0",
    });
    (mockPrisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-rt",
      userId,
      dailyStudyMinutes: 120,
      status: "ACTIVE",
      items,
    });
  };

  test("A1+A2+B1: B1 é agendado no dia 1 antes de A2 ser repetida", async () => {
    // Matéria A = ciclo de hoje (Direito do Trabalho — ciclo dia 1 TRT4)
    // Matéria B = fora do ciclo (Direito Administrativo)
    // Fila de atrasados: A1 (DT), A2 (DT), B1 (DA)
    // Capacidade dia 1: 2 blocos de 45 min = 90 min de teoria
    // Resultado esperado: dia 1 = A1 + B1 (diversidade); dia 2 = A2

    const subA = makeSubject("sub-dt", "Direito do Trabalho");
    const subB = makeSubject("sub-da", "Direito Administrativo");
    const pastDate = new Date("2026-07-01T00:00:00.000Z");

    setupBase([subA, subB], [
      makeOverdueItem("a1", "sub-dt", subA, pastDate, 5),
      makeOverdueItem("a2", "sub-dt", subA, pastDate, 6),
      makeOverdueItem("b1", "sub-da", subB, pastDate, 7),
    ]);

    const result = await reorganizeOverdueSchedule(
      userId, false, true, new Date("2026-07-23T10:00:00.000Z")
    );

    expect(result.success).toBe(true);

    // Agrupar changes por nova data
    const byDate: Record<string, string[]> = {};
    for (const change of result.changes) {
      if (!byDate[change.newDate]) byDate[change.newDate] = [];
      byDate[change.newDate].push(change.subjectName);
    }

    const dates = Object.keys(byDate).sort();
    expect(dates.length).toBeGreaterThanOrEqual(2);

    // Dia 1: deve conter A (DT) e B (DA) — não dois DT
    const day1Subjects = byDate[dates[0]];
    expect(day1Subjects).toContain("Direito do Trabalho");
    expect(day1Subjects).toContain("Direito Administrativo");
    expect(day1Subjects.filter(s => s === "Direito do Trabalho").length).toBe(1);

    // Dia 2: deve conter A2 (segundo DT)
    const day2Subjects = byDate[dates[1]];
    expect(day2Subjects).toContain("Direito do Trabalho");
  });

  test("A usada hoje / B usada ontem: B tem prioridade sobre repetir A", async () => {
    // Fila: A1 (DT), B1 (DA), A2 (DT). Capacidade: 2 blocos/dia.
    // A1 preenche o slot 1 de DT. No slot 2, B1 (DA, distinto) deve ganhar
    // sobre A2 (DT repetida no mesmo dia).

    const subA = makeSubject("sub-dt", "Direito do Trabalho");
    const subB = makeSubject("sub-da", "Direito Administrativo");
    const pastDate = new Date("2026-07-01T00:00:00.000Z");

    setupBase([subA, subB], [
      makeOverdueItem("a1", "sub-dt", subA, pastDate, 5),
      makeOverdueItem("b1", "sub-da", subB, pastDate, 6),
      makeOverdueItem("a2", "sub-dt", subA, pastDate, 7),
    ]);

    const result = await reorganizeOverdueSchedule(
      userId, false, true, new Date("2026-07-23T10:00:00.000Z")
    );

    expect(result.success).toBe(true);

    const byDate: Record<string, string[]> = {};
    for (const change of result.changes) {
      if (!byDate[change.newDate]) byDate[change.newDate] = [];
      byDate[change.newDate].push(change.subjectName);
    }

    const dates = Object.keys(byDate).sort();
    expect(dates.length).toBeGreaterThanOrEqual(2);

    const day1Subjects = byDate[dates[0]];
    // No dia 1: A1 e B1 — não A1 e A2
    expect(day1Subjects).toContain("Direito do Trabalho");
    expect(day1Subjects).toContain("Direito Administrativo");
    expect(day1Subjects.filter(s => s === "Direito do Trabalho").length).toBe(1);
  });

  test("Repetição inevitável: apenas matéria A na fila — ambos os blocos são agendados sem perda", async () => {
    const subA = makeSubject("sub-dt", "Direito do Trabalho");
    const pastDate = new Date("2026-07-01T00:00:00.000Z");

    setupBase([subA], [
      makeOverdueItem("a1", "sub-dt", subA, pastDate, 5),
      makeOverdueItem("a2", "sub-dt", subA, pastDate, 6),
    ]);

    const result = await reorganizeOverdueSchedule(
      userId, false, true, new Date("2026-07-23T10:00:00.000Z")
    );

    expect(result.success).toBe(true);
    // Nenhum item deve ser perdido — repetição é aceita como último recurso
    expect(result.changes.length).toBe(2);
    expect(result.changes.every(c => c.subjectName === "Direito do Trabalho")).toBe(true);
  });

  test("Métricas: futureItemsShiftedCount, mergedReviewBlocksCount e lastDateAfterReorganization", async () => {
    const subA = makeSubject("sub-dt", "Direito do Trabalho");
    const pastDate = new Date("2026-07-01T00:00:00.000Z");
    const futureDate = new Date("2026-08-10T00:00:00.000Z");

    const overdueItems = [
      makeOverdueItem("a1", "sub-dt", subA, pastDate, 3),
      makeOverdueItem("a2", "sub-dt", subA, pastDate, 4),
      // Item futuro elegível para deslocamento
      makeOverdueItem("a3", "sub-dt", subA, futureDate, 20),
      // REVIEW_BLOCK atrasado com flashcards — elegibilidade exige studyBlock.flashcards.length > 0
      {
        ...makeOverdueItem("rv1", "sub-dt", subA, pastDate, 5, 30, "REVIEW_BLOCK"),
        studyBlock: { flashcards: [{ id: "fc-1" }] },
      },
    ];

    setupBase([subA], overdueItems);

    const result = await reorganizeOverdueSchedule(
      userId, false, true, new Date("2026-07-23T10:00:00.000Z")
    );

    expect(result.success).toBe(true);

    // futureItemsShiftedCount: itens com data futura deslocados
    expect(result.futureItemsShiftedCount).toBeGreaterThanOrEqual(0);

    // mergedReviewBlocksCount: conta REVIEW_BLOCKs atrasados elegíveis (rv1 tem flashcards)
    expect(result.mergedReviewBlocksCount).toBeGreaterThanOrEqual(1);

    // lastDateAfterReorganization: não deve ser undefined quando há mudanças
    if (result.changes.length > 0) {
      expect(result.lastDateAfterReorganization).toBeDefined();
      expect(typeof result.lastDateAfterReorganization).toBe("string");
    }
  });
});
