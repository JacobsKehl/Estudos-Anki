/**
 * cfc-non-cfc-isolation.test.ts
 *
 * Teste de Aceite Frente 1.1:
 * Garante que blocos NOT_STARTED de materiais fora do CFC (ex: Estratégia)
 * NUNCA entram no pool de candidatos do reorganizeOverdueSchedule.
 */
import { prisma } from "@/lib/prisma";
import { reorganizeOverdueSchedule } from "@/lib/scheduler";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    userPreferences: { findUnique: jest.fn() },
    studySubject: { findMany: jest.fn() },
    studyBlock: { findMany: jest.fn() },
    studySchedule: { findFirst: jest.fn() },
    studyScheduleItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => (typeof cb === "function" ? cb(prisma) : Promise.all(cb))),
  },
}));

jest.mock("@/lib/date-utils", () => ({
  getTodayRangeSP: (date: Date, offsetDays = 0) => {
    const d = new Date(date);
    if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
    const str = d.toISOString().split("T")[0];
    const start = new Date(`${str}T00:00:00.000Z`);
    const end = new Date(`${str}T23:59:59.999Z`);
    return { start, end, dateString: str, label: str };
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("Frente 1.1: Isolamento Rigoroso de Materiais CFC no Reorganize", () => {
  const userId = "user-gabriela-test";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Item pendente apontando para bloco NOT_STARTED do Estratégia (não-CFC) NÃO deve entrar na fila de teoria", async () => {
    (mockPrisma.userPreferences.findUnique as jest.Mock).mockResolvedValue({
      userId,
      scheduleGenerationMode: "LEGACY_TRT4",
      studyDaysOfWeek: "1,2,3,4,5,6,0",
    });

    const subTrab = { id: "sub-trab", userId, name: "Direito do Trabalho", studyPriority: "PRIMARY" };

    (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue([subTrab]);

    // Banco dbPendingBlocks: retorna vazio para simular que o único bloco na agenda veio do item
    (mockPrisma.studyBlock.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // dbCompletedBlocks
      .mockResolvedValueOnce([]); // dbPendingBlocks (CFC vazio)

    const pastDate = new Date("2026-08-20T00:00:00.000Z");

    // Item de agenda legado que apontava para um bloco do Estratégia (PDF diferente do CFC)
    const nonCfcItem = {
      id: "item-estrategia-1",
      userId,
      scheduleId: "sched-1",
      subjectId: "sub-trab",
      studyBlockId: "block-estrategia-1",
      actionType: "THEORY",
      status: "PENDING",
      scheduledDate: pastDate,
      dayNumber: 1,
      estimatedMinutes: 45,
      subject: subTrab,
      studyBlock: {
        id: "block-estrategia-1",
        subjectId: "sub-trab",
        materialId: "mat-estrategia-1",
        title: "Estratégia Aula 01",
        pageStart: 3,
        pageEnd: 23, // 21 páginas!
        theoryStatus: "NOT_STARTED", // NOT_STARTED fora do CFC
        material: {
          id: "mat-estrategia-1",
          originalFileName: "Estrategia_Direito_do_Trabalho_Aula01.pdf", // NÃO-CFC!
          materialRole: "MAIN_THEORY",
        },
      },
    };

    (mockPrisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-1",
      userId,
      dailyStudyMinutes: 120,
      status: "ACTIVE",
      items: [nonCfcItem],
    });

    (mockPrisma.studyScheduleItem.findMany as jest.Mock).mockResolvedValue([]);

    const result = await reorganizeOverdueSchedule(
      userId,
      false,
      true,
      new Date("2026-08-28T10:00:00.000Z")
    );

    expect(result.success).toBe(true);

    // O bloco do Estratégia NÃO deve ter sido reagendado como teoria
    const scheduledTitles = result.changes.map((c) => (c as any).blockTitle);
    const nonCfcScheduled = result.changes.filter(
      (c) => (c as any).studyBlockId === "block-estrategia-1"
    );

    expect(nonCfcScheduled.length).toBe(0);
    expect(result.changes.length).toBe(0);
  });
});
