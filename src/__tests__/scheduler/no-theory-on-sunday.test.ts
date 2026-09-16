/**
 * src/__tests__/scheduler/no-theory-on-sunday.test.ts
 *
 * C.4 / R5 — Domingo é dia sem teoria (revisões e SRS continuam, mas
 * reorganizeOverdueSchedule não deve alocar nenhum item THEORY num domingo).
 *
 * Domingo continua em studyDaysOfWeek (é o weeklyReviewDayOfWeek) — a regra
 * mora no agendador, não na preferência.
 */
import { reorganizeOverdueSchedule } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";

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

describe("C.4 — domingo sem teoria", () => {
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
      // Domingo (0) continua em studyDaysOfWeek — é o weeklyReviewDayOfWeek,
      // a regra de "sem teoria" mora no agendador, não aqui.
      studyDaysOfWeek: "0,1,2,3,4,5,6",
    });
    (prisma.studySubject.findMany as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where?.studyPriority?.in) return [];
      return eligibleSubjects;
    });
    (prisma.studyScheduleItem.count as jest.Mock).mockResolvedValue(0);
    (prisma.studyScheduleItem.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.studyScheduleItem.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.studyScheduleItem.update as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studyScheduleItem.updateMany as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studyScheduleItem.create as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studySchedule.update as jest.Mock).mockResolvedValue({});
  });

  test("um cronograma com muitos blocos pendentes nunca aloca THEORY num domingo", async () => {
    // 2026-08-13 é uma quinta-feira; a janela cobre um domingo (2026-08-16).
    const today = new Date("2026-08-13T10:00:00.000Z");

    const seedOverdueItem = {
      id: "item-seed-dt",
      userId,
      subjectId: "sub-dt",
      studyBlockId: "block-seed-dt",
      actionType: "THEORY",
      status: "PENDING",
      scheduledDate: new Date("2026-08-01T10:00:00.000Z"),
      dayNumber: 1,
      estimatedMinutes: 24,
      subject: eligibleSubjects[0],
      studyBlock: { id: "block-seed-dt", title: "Bloco Seed", theoryStatus: "NOT_STARTED", flashcards: [] },
    };

    (prisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-1",
      userId,
      status: "ACTIVE",
      dailyStudyMinutes: 120,
      items: [seedOverdueItem],
    });

    (prisma.studyScheduleItem.findMany as jest.Mock).mockResolvedValue([]);

    // Fartura de blocos de 24 min para todas as matérias, para garantir que o
    // agendador teria o que colocar em todos os dias, inclusive domingo, se a
    // regra R5 não estivesse implementada.
    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue(
      eligibleSubjects.flatMap((s, subIdx) =>
        Array.from({ length: 10 }, (_, i) => ({
          id: `block-${s.id}-${i}`,
          subjectId: s.id,
          estimatedStudyMinutes: 24,
          orderIndex: i,
          material: { fileName: `${s.name} ${subIdx + 1}.pdf` },
          subject: s,
        }))
      )
    );

    const result = await reorganizeOverdueSchedule(userId, false, false, today);
    expect(result.success).toBe(true);

    // 2026-08-16 é domingo dentro da janela coberta pela reorganização.
    const sundayChanges = result.changes.filter((c) => c.newDate === "2026-08-16");
    expect(sundayChanges.length).toBe(0);

    // Confirma que a suite de dados do teste é válida: teoria foi alocada em
    // outros dias (não é que nada foi agendado em lugar nenhum).
    const anyTheoryScheduled = result.changes.some((c) => c.actionType === "THEORY");
    expect(anyTheoryScheduled).toBe(true);
  });
});
