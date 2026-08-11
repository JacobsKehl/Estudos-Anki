import { reorganizeOverdueSchedule } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";

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
      },
      studyScheduleItem: {
        count: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
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

describe("Regressão — reorganizeOverdueSchedule com fila circular LEGACY_TRT4", () => {
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
    (prisma.studyScheduleItem.create as jest.Mock).mockImplementation(async ({ data }) => data);
  });

  test("Cenário 1 — Histórico Constitucional ✅ e Processo Civil ✅ -> Reorganizar aloca Trabalho e Português no Dia 1", async () => {
    const completedItems = [
      { id: "item-dc", subjectId: "sub-dc", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-09") },
      { id: "item-dpc", subjectId: "sub-dpc", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-10") },
    ];

    const pendingOverdueItems = [
      {
        id: "item-old-1",
        userId,
        subjectId: "sub-dc",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: new Date("2026-08-10T10:00:00.000Z"),
        dayNumber: 1,
        estimatedMinutes: 45,
        subject: { id: "sub-dc", name: "Direito Constitucional" },
        studyBlock: { id: "block-dc-1", title: "Bloco DC 1", flashcards: [] },
      },
      {
        id: "item-old-2",
        userId,
        subjectId: "sub-dpc",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: new Date("2026-08-10T10:00:00.000Z"),
        dayNumber: 1,
        estimatedMinutes: 45,
        subject: { id: "sub-dpc", name: "Direito Processual Civil" },
        studyBlock: { id: "block-dpc-1", title: "Bloco DPC 1", flashcards: [] },
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
      { id: "block-dt-1", subjectId: "sub-dt", status: "PENDING", orderIndex: 1, material: { fileName: "Direito do Trabalho 1.pdf" }, subject: eligibleSubjects[0] },
      { id: "block-lp-1", subjectId: "sub-lp", status: "PENDING", orderIndex: 1, material: { fileName: "Língua Portuguesa 1.pdf" }, subject: eligibleSubjects[1] },
    ]);

    const result = await reorganizeOverdueSchedule(userId, false, true, new Date("2026-08-11T10:00:00.000Z"));

    expect(result.success).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);

    const day1Changes = result.changes.filter(c => c.newDate === "2026-08-11");
    const day1SubjectNames = day1Changes.map(c => c.subjectName);
    expect(day1SubjectNames).toContain("Direito do Trabalho");
    expect(day1SubjectNames).toContain("Língua Portuguesa");
    expect(day1SubjectNames).not.toContain("Direito Constitucional");
  });

  test("Cenário 2 (Parcial) — Trabalho ✅ e Português ❌ -> Reorganizar aloca Português e Processo do Trabalho no Dia 1", async () => {
    const completedItems = [
      { id: "item-dt", subjectId: "sub-dt", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-10") },
    ];

    const pendingOverdueItems = [
      {
        id: "item-lp-old",
        userId,
        subjectId: "sub-lp",
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

    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue([]);

    const result = await reorganizeOverdueSchedule(userId, false, true, new Date("2026-08-11T10:00:00.000Z"));

    expect(result.success).toBe(true);
    const day1Changes = result.changes.filter(c => c.newDate === "2026-08-11");
    const day1SubjectNames = day1Changes.map(c => c.subjectName);
    expect(day1SubjectNames).toContain("Língua Portuguesa");
    expect(day1SubjectNames).toContain("Direito Processual do Trabalho");
  });

  test("Cenário 3 (Nenhuma Concluída no par atual) — Processo do Trabalho ❌ e Administrativo ❌ -> Reorganizar mantém Processo do Trabalho e Administrativo", async () => {
    const completedItems = [
      { id: "item-dt", subjectId: "sub-dt", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-08") },
      { id: "item-lp", subjectId: "sub-lp", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-09") },
    ];

    const pendingOverdueItems = [
      {
        id: "item-dpt-old",
        userId,
        subjectId: "sub-dpt",
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

    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue([]);

    const result = await reorganizeOverdueSchedule(userId, false, true, new Date("2026-08-11T10:00:00.000Z"));

    expect(result.success).toBe(true);
    const day1Changes = result.changes.filter(c => c.newDate === "2026-08-11");
    const day1SubjectNames = day1Changes.map(c => c.subjectName);
    expect(day1SubjectNames).toContain("Direito Processual do Trabalho");
    expect(day1SubjectNames).toContain("Direito Administrativo");
  });

  test("Cenário 4 — Ordem do PDF no reorganize: Administrativo 4.pdf, 5.pdf e 8.pdf -> Escolhe PDF 4 (Bloco 2)", async () => {
    const completedItems = [
      { id: "item-dpt", subjectId: "sub-dpt", status: "COMPLETED", actionType: "THEORY", completedAt: new Date("2026-08-10") },
    ];

    const pendingOverdueItems = [
      {
        id: "item-da-old",
        userId,
        subjectId: "sub-da",
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: new Date("2026-08-10T10:00:00.000Z"),
        dayNumber: 1,
        estimatedMinutes: 45,
        subject: { id: "sub-da", name: "Direito Administrativo" },
        studyBlock: { id: "block-da-4-bl2", title: "Bloco DA 4.2", flashcards: [], material: { fileName: "Direito Administrativo 4.pdf" } },
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
      { id: "block-da-8", subjectId: "sub-da", status: "PENDING", orderIndex: 1, material: { id: "m8", fileName: "Direito Administrativo 8.pdf" }, subject: eligibleSubjects[3] },
      { id: "block-da-5", subjectId: "sub-da", status: "PENDING", orderIndex: 1, material: { id: "m5", fileName: "Direito Administrativo 5.pdf" }, subject: eligibleSubjects[3] },
      { id: "block-da-4-bl2", subjectId: "sub-da", status: "PENDING", orderIndex: 2, material: { id: "m4", fileName: "Direito Administrativo 4.pdf" }, subject: eligibleSubjects[3] },
    ];

    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue(daBlocks);

    const result = await reorganizeOverdueSchedule(userId, false, true, new Date("2026-08-11T10:00:00.000Z"));

    expect(result.success).toBe(true);
    const daChanges = result.changes.filter(c => c.subjectName === "Direito Administrativo");
    expect(daChanges.length).toBeGreaterThan(0);
  });
});
