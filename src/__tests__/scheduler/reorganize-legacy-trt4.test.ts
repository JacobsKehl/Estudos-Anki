import { reorganizeOverdueSchedule } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";
import { sortPendingBlocksForSubject } from "@/lib/scheduler/legacy-trt4-queue";

// Mock do prisma para testar reorganizeOverdueSchedule sem banco de dados
jest.mock("@/lib/prisma", () => {
  return {
    prisma: {
      studySubject: {
        findMany: jest.fn(),
      },
      userPreferences: {
        findUnique: jest.fn(),
      },
      studySchedule: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
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
      studyBlock: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => {
        if (typeof callback === "function") {
          return callback(prisma);
        }
        return callback;
      }),
    },
  };
});

describe("Regressão — reorganizeOverdueSchedule com fila circular LEGACY_TRT4 e Reconstrução Canônica", () => {
  const userId = "user-gabriela-test";

  const eligibleSubjects = [
    { id: "sub-dt", name: "Direito do Trabalho", studyPriority: "PRIMARY" },
    { id: "sub-lp", name: "Língua Portuguesa", studyPriority: "PRIMARY" },
    { id: "sub-dpt", name: "Direito Processual do Trabalho", studyPriority: "PRIMARY" },
    { id: "sub-da", name: "Direito Administrativo", studyPriority: "PRIMARY" },
    { id: "sub-dc", name: "Direito Constitucional", studyPriority: "PRIMARY" },
    { id: "sub-dpc", name: "Direito Processual Civil", studyPriority: "PRIMARY" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.userPreferences.findUnique as jest.Mock).mockResolvedValue({
      userId,
      scheduleGenerationMode: "LEGACY_TRT4",
      studyDaysOfWeek: "1,2,3,4,5,6,0",
    });
    (prisma.studySubject.findMany as jest.Mock).mockImplementation(async ({ where }) => {
      if (where?.studyPriority?.in) {
        return []; // Sem matérias EXCLUDED/SECONDARY
      }
      return eligibleSubjects;
    });
    (prisma.studyScheduleItem.count as jest.Mock).mockResolvedValue(0);
    (prisma.studyScheduleItem.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.studyScheduleItem.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.studyScheduleItem.update as jest.Mock).mockImplementation(async ({ data }) => data);
    (prisma.studyScheduleItem.updateMany as jest.Mock).mockImplementation(async ({ data }) => data);
    (prisma.studyScheduleItem.create as jest.Mock).mockImplementation(async ({ data }) => data);
  });

  test("Cenário 1 — Reprodução da Gabriela (BUG 1): DC ✅ e DPC ✅ concluídos + PENDING antigos de hoje DC e DPC -> Reorganizar substitui HOJE por DT e LP", async () => {
    const today = new Date("2026-08-11T10:00:00.000Z");

    const completedItems = [
      { id: "item-dc-comp", subjectId: "sub-dc", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-09") },
      { id: "item-dpc-comp", subjectId: "sub-dpc", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-10") },
    ];

    // O cronograma de HOJE possuía itens antigos de DC e DPC com status PENDING
    const todayPendingOldItems = [
      {
        id: "item-old-dc",
        userId,
        subjectId: "sub-dc",
        studyBlockId: "block-dc-old",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: today,
        dayNumber: 10,
        estimatedMinutes: 45,
        subject: { id: "sub-dc", name: "Direito Constitucional" },
        studyBlock: { id: "block-dc-old", title: "Bloco DC Antigo", flashcards: [] },
      },
      {
        id: "item-old-dpc",
        userId,
        subjectId: "sub-dpc",
        studyBlockId: "block-dpc-old",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: today,
        dayNumber: 10,
        estimatedMinutes: 45,
        subject: { id: "sub-dpc", name: "Direito Processual Civil" },
        studyBlock: { id: "block-dpc-old", title: "Bloco DPC Antigo", flashcards: [] },
      },
    ];

    (prisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-1",
      userId,
      status: "ACTIVE",
      dailyStudyMinutes: 120,
      items: [...completedItems, ...todayPendingOldItems],
    });

    (prisma.studyScheduleItem.findMany as jest.Mock).mockImplementation(async ({ where }) => {
      if (where?.status === "COMPLETED" && where?.actionType === "THEORY") {
        return completedItems;
      }
      return [];
    });

    // Blocos pendentes disponíveis no banco para DT e LP
    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue([
      { id: "block-dt-1", subjectId: "sub-dt", status: "PENDING", orderIndex: 1, material: { fileName: "Direito do Trabalho 1.pdf" }, subject: eligibleSubjects[0] },
      { id: "block-lp-1", subjectId: "sub-lp", status: "PENDING", orderIndex: 1, material: { fileName: "Língua Portuguesa 1.pdf" }, subject: eligibleSubjects[1] },
    ]);

    const result = await reorganizeOverdueSchedule(userId, false, false, today);

    expect(result.success).toBe(true);

    // Validação: Os itens alocados para hoje DEVEM ser Direito do Trabalho e Língua Portuguesa
    const day1Changes = result.changes.filter(c => c.newDate === "2026-08-11");
    const day1SubjectNames = day1Changes.map(c => c.subjectName);
    expect(day1SubjectNames).toContain("Direito do Trabalho");
    expect(day1SubjectNames).toContain("Língua Portuguesa");
    expect(day1SubjectNames).not.toContain("Direito Constitucional");
    expect(day1SubjectNames).not.toContain("Direito Processual Civil");

    // Validação de atualização de banco: os IDs antigos (item-old-dc e item-old-dpc) foram reutilizados mas com matérias/blocos novos
    const updateCalls = (prisma.studyScheduleItem.updateMany as jest.Mock).mock.calls;
    expect(updateCalls.length).toBeGreaterThanOrEqual(2);
    const dtCall = updateCalls.find(([arg]) => arg.data?.subjectId === "sub-dt");
    const lpCall = updateCalls.find(([arg]) => arg.data?.subjectId === "sub-lp");
    expect(dtCall).toBeDefined();
    expect(lpCall).toBeDefined();
  });

  test("Cenário 2 — Proteção de IN_PROGRESS (BUG 2): Item IN_PROGRESS não entra no pool de reaproveitamento e não é excluído", async () => {
    const today = new Date("2026-08-11T10:00:00.000Z");

    const inProgressItem = {
      id: "item-dc-in-prog",
      userId,
      subjectId: "sub-dc",
      studyBlockId: "block-dc-in-progress",
      actionType: "THEORY",
      status: "IN_PROGRESS",
      scheduledDate: today,
      dayNumber: 10,
      estimatedMinutes: 45,
      subject: { id: "sub-dc", name: "Direito Constitucional" },
      studyBlock: { id: "block-dc-in-progress", title: "Bloco DC em Progresso", status: "IN_PROGRESS" },
    };

    (prisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-1",
      userId,
      status: "ACTIVE",
      dailyStudyMinutes: 120,
      items: [inProgressItem],
    });

    (prisma.studyScheduleItem.findMany as jest.Mock).mockImplementation(async () => {
      return [];
    });

    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue([
      { id: "block-dt-1", subjectId: "sub-dt", status: "PENDING", orderIndex: 1, material: { fileName: "Direito do Trabalho 1.pdf" }, subject: eligibleSubjects[0] },
    ]);

    const result = await reorganizeOverdueSchedule(userId, false, false, today);

    expect(result.success).toBe(true);

    // O item IN_PROGRESS NÃO pode aparecer na lista de exclusão do deleteMany
    const deleteCalls = (prisma.studyScheduleItem.deleteMany as jest.Mock).mock.calls;
    for (const [arg] of deleteCalls) {
      if (arg.where?.id?.in) {
        expect(arg.where.id.in).not.toContain("item-dc-in-prog");
      }
    }

    // O item IN_PROGRESS NÃO pode ser sobrescrito com outro bloco no update/updateMany
    const updateCalls = (prisma.studyScheduleItem.updateMany as jest.Mock).mock.calls;
    const overwrittenCall = updateCalls.find(([arg]) => arg.where?.id === "item-dc-in-prog" && arg.data?.studyBlockId !== "block-dc-in-progress");
    expect(overwrittenCall).toBeUndefined();
  });

  test("Cenário 3 — Estudo parcial (Restaurado): Trabalho ✅ e Português ❌ -> Reorganizar aloca Português e Processo do Trabalho", async () => {
    const today = new Date("2026-08-11T10:00:00.000Z");
    const completedItems = [
      { id: "item-dt", subjectId: "sub-dt", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-10") },
    ];

    const pendingOverdueItems = [
      {
        id: "item-lp-old",
        userId,
        subjectId: "sub-lp",
        studyBlockId: "block-lp-1",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: new Date("2026-08-10T10:00:00.000Z"),
        dayNumber: 1,
        estimatedMinutes: 45,
        subject: { id: "sub-lp", name: "Língua Portuguesa" },
        studyBlock: { id: "block-lp-1", title: "Bloco LP 1", flashcards: [] },
      },
      {
        id: "item-dpt-old",
        userId,
        subjectId: "sub-dpt",
        studyBlockId: "block-dpt-1",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: new Date("2026-08-10T10:00:00.000Z"),
        dayNumber: 1,
        estimatedMinutes: 45,
        subject: { id: "sub-dpt", name: "Direito Processual do Trabalho" },
        studyBlock: { id: "block-dpt-1", title: "Bloco DPT 1", flashcards: [] },
      },
    ];

    (prisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-1",
      userId,
      status: "ACTIVE",
      dailyStudyMinutes: 120,
      items: [...completedItems, ...pendingOverdueItems],
    });

    (prisma.studyScheduleItem.findMany as jest.Mock).mockImplementation(async ({ where }) => {
      if (where?.status === "COMPLETED" && where?.actionType === "THEORY") {
        return completedItems;
      }
      return [];
    });

    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue([
      { id: "block-lp-1", subjectId: "sub-lp", status: "PENDING", orderIndex: 1, material: { fileName: "Língua Portuguesa 1.pdf" }, subject: eligibleSubjects[1] },
      { id: "block-dpt-1", subjectId: "sub-dpt", status: "PENDING", orderIndex: 1, material: { fileName: "Direito Processual do Trabalho 1.pdf" }, subject: eligibleSubjects[2] },
    ]);

    const result = await reorganizeOverdueSchedule(userId, false, false, today);

    expect(result.success).toBe(true);
    const day1Changes = result.changes.filter(c => c.newDate === "2026-08-11");
    const day1SubjectNames = day1Changes.map(c => c.subjectName);
    expect(day1SubjectNames).toContain("Língua Portuguesa");
    expect(day1SubjectNames).toContain("Direito Processual do Trabalho");
  });

  test("Cenário 4 — Zero concluído no par DPT e DA (Restaurado): Trabalho ✅ e Português ✅ -> Reorganizar aloca Processo do Trabalho e Administrativo", async () => {
    const today = new Date("2026-08-11T10:00:00.000Z");
    const completedItems = [
      { id: "item-dt", subjectId: "sub-dt", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-08") },
      { id: "item-lp", subjectId: "sub-lp", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-09") },
    ];

    const pendingOverdueItems = [
      {
        id: "item-dpt-old",
        userId,
        subjectId: "sub-dpt",
        studyBlockId: "block-dpt-1",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: new Date("2026-08-10T10:00:00.000Z"),
        dayNumber: 1,
        estimatedMinutes: 45,
        subject: { id: "sub-dpt", name: "Direito Processual do Trabalho" },
        studyBlock: { id: "block-dpt-1", title: "Bloco DPT 1", flashcards: [] },
      },
      {
        id: "item-da-old",
        userId,
        subjectId: "sub-da",
        studyBlockId: "block-da-1",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: new Date("2026-08-10T10:00:00.000Z"),
        dayNumber: 1,
        estimatedMinutes: 45,
        subject: { id: "sub-da", name: "Direito Administrativo" },
        studyBlock: { id: "block-da-1", title: "Bloco DA 1", flashcards: [] },
      },
    ];

    (prisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-1",
      userId,
      status: "ACTIVE",
      dailyStudyMinutes: 120,
      items: [...completedItems, ...pendingOverdueItems],
    });

    (prisma.studyScheduleItem.findMany as jest.Mock).mockImplementation(async ({ where }) => {
      if (where?.status === "COMPLETED" && where?.actionType === "THEORY") {
        return completedItems;
      }
      return [];
    });

    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue([
      { id: "block-dpt-1", subjectId: "sub-dpt", status: "PENDING", orderIndex: 1, material: { fileName: "Direito Processual do Trabalho 1.pdf" }, subject: eligibleSubjects[2] },
      { id: "block-da-1", subjectId: "sub-da", status: "PENDING", orderIndex: 1, material: { fileName: "Direito Administrativo 1.pdf" }, subject: eligibleSubjects[3] },
    ]);

    const result = await reorganizeOverdueSchedule(userId, false, false, today);

    expect(result.success).toBe(true);
    const day1Changes = result.changes.filter(c => c.newDate === "2026-08-11");
    const day1SubjectNames = day1Changes.map(c => c.subjectName);
    expect(day1SubjectNames).toContain("Direito Processual do Trabalho");
    expect(day1SubjectNames).toContain("Direito Administrativo");
  });

  test("Cenário 5 — PDF 9 já agendado como PENDING antigo vs PDF 4 pendente no banco -> Reorganizar escolhe PDF 4 (Bloco 2)", async () => {
    const today = new Date("2026-08-11T10:00:00.000Z");
    const completedItems = [
      { id: "item-dpt", subjectId: "sub-dpt", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-10") },
    ];

    const pendingOverdueItems = [
      {
        id: "item-da-old-pdf9",
        userId,
        subjectId: "sub-da",
        studyBlockId: "block-da-9-bl1",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: new Date("2026-08-10T10:00:00.000Z"),
        dayNumber: 1,
        estimatedMinutes: 45,
        subject: { id: "sub-da", name: "Direito Administrativo" },
        studyBlock: { id: "block-da-9-bl1", title: "Bloco DA 9.1", flashcards: [], material: { fileName: "Direito Administrativo 9.pdf" } },
      },
    ];

    (prisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-1",
      userId,
      status: "ACTIVE",
      dailyStudyMinutes: 120,
      items: [...completedItems, ...pendingOverdueItems],
    });

    (prisma.studyScheduleItem.findMany as jest.Mock).mockImplementation(async ({ where }) => {
      if (where?.status === "COMPLETED" && where?.actionType === "THEORY") {
        return completedItems;
      }
      return [];
    });

    const daBlocks = [
      { id: "block-da-9-bl1", subjectId: "sub-da", status: "PENDING", orderIndex: 1, material: { id: "m9", orderIndex: 1, fileName: "Direito Administrativo 9.pdf" }, subject: eligibleSubjects[3] },
      { id: "block-da-5-bl1", subjectId: "sub-da", status: "PENDING", orderIndex: 1, material: { id: "m5", orderIndex: 2, fileName: "Direito Administrativo 5.pdf" }, subject: eligibleSubjects[3] },
      { id: "block-da-4-bl2", subjectId: "sub-da", status: "PENDING", orderIndex: 2, material: { id: "m4", orderIndex: 3, fileName: "Direito Administrativo 4.pdf" }, subject: eligibleSubjects[3] },
    ];

    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue(daBlocks);

    const result = await reorganizeOverdueSchedule(userId, false, false, today);

    expect(result.success).toBe(true);

    const updateCalls = (prisma.studyScheduleItem.updateMany as jest.Mock).mock.calls;
    const daUpdateCall = updateCalls.find(([arg]) => arg.data?.studyBlockId === "block-da-4-bl2" || arg.where?.id === "item-da-old-pdf9");
    expect(daUpdateCall).toBeDefined();
    expect(daUpdateCall[0].data.studyBlockId).toBe("block-da-4-bl2");
  });

  test("Cenário 6 — Ordenador numérico: filename com número didático vence material.orderIndex", () => {
    const blocks = [
      { id: "b-11", orderIndex: 1, material: { id: "m-11", orderIndex: 1, fileName: "Matéria 11.pdf" } },
      { id: "b-10", orderIndex: 1, material: { id: "m-10", orderIndex: 2, fileName: "Matéria 10.pdf" } },
      { id: "b-9", orderIndex: 1, material: { id: "m-9", orderIndex: 3, fileName: "Matéria 9.pdf" } },
      { id: "b-3", orderIndex: 1, material: { id: "m-3", orderIndex: 4, fileName: "Matéria 3.pdf" } },
      { id: "b-2", orderIndex: 1, material: { id: "m-2", orderIndex: 5, fileName: "Matéria 2.pdf" } },
      { id: "b-1", orderIndex: 1, material: { id: "m-1", orderIndex: 6, fileName: "Matéria 1.pdf" } },
    ];

    const sorted = sortPendingBlocksForSubject(blocks);
    const sortedIds = sorted.map(b => b.id);
    expect(sortedIds).toEqual(["b-1", "b-2", "b-3", "b-9", "b-10", "b-11"]);
  });
});
