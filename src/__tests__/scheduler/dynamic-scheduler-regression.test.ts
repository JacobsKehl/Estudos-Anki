/**
 * src/__tests__/scheduler/dynamic-scheduler-regression.test.ts
 *
 * Teste de regressão para comprovar que o modo DYNAMIC permanece 100% inalterado,
 * permitindo o agendamento de múltiplos blocos da mesma matéria no mesmo dia
 * para preencher a meta calculada de minutos daquela disciplina.
 */

import { generateDynamicSchedule } from "@/lib/scheduler";
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

describe("Regressão do Modo DYNAMIC — Preservação de Comportamento Multi-Blocos", () => {
  const userId = "user-dynamic-fixture-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Modo DYNAMIC aloca múltiplos blocos da mesma matéria no mesmo dia para cumprir a meta de minutos da matéria", async () => {
    const dtSubject = { id: "sub-dt", userId, name: "Direito do Trabalho", studyPriority: "PRIMARY" };
    const daSubject = { id: "sub-da", userId, name: "Direito Administrativo", studyPriority: "ACTIVE" };

    (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue([dtSubject, daSubject]);

    // Blocos curtos de 30 minutos para Direito do Trabalho
    const dtBlocks = [
      {
        id: "b-dt-1",
        userId,
        subjectId: "sub-dt",
        status: "PENDING",
        estimatedStudyMinutes: 30,
        orderIndex: 1,
        subject: dtSubject,
        material: { fileName: "DT-01.pdf" }
      },
      {
        id: "b-dt-2",
        userId,
        subjectId: "sub-dt",
        status: "PENDING",
        estimatedStudyMinutes: 30,
        orderIndex: 2,
        subject: dtSubject,
        material: { fileName: "DT-02.pdf" }
      },
      {
        id: "b-dt-3",
        userId,
        subjectId: "sub-dt",
        status: "PENDING",
        estimatedStudyMinutes: 30,
        orderIndex: 3,
        subject: dtSubject,
        material: { fileName: "DT-03.pdf" }
      }
    ];

    (mockPrisma.studyBlock.findMany as jest.Mock).mockResolvedValue(dtBlocks);

    (mockPrisma.studySchedule.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.studySchedule.create as jest.Mock).mockResolvedValue({
      id: "sched-dynamic-1",
      userId,
      title: "Cronograma Dinâmico",
      dailyStudyMinutes: 120,
      startDate: new Date("2026-07-23T00:00:00.000Z"),
      status: "ACTIVE"
    });

    let createdItems: any[] = [];
    (mockPrisma.studyScheduleItem.createMany as jest.Mock).mockImplementation(({ data }) => {
      createdItems = data;
      return Promise.resolve({ count: data.length });
    });

    const result = await generateDynamicSchedule(
      userId,
      {
        dailyMinutes: 120,
        startDate: new Date("2026-07-23T00:00:00.000Z")
      },
      {
        userId,
        scheduleGenerationMode: "DYNAMIC",
        studyDaysOfWeek: "1,2,3,4,5,6,0"
      }
    );

    expect(result.schedule.id).toBe("sched-dynamic-1");

    const day1TheoryItems = createdItems.filter(
      item => item.dayNumber === 1 && item.actionType === "THEORY"
    );

    // COMPROVAÇÃO DE PRESERVAÇÃO:
    // No modo DYNAMIC, 3 blocos de 30 min de Direito do Trabalho são agendados no mesmo dia
    // para preencher os 90 minutos de teoria do dia 1. A trava sameDaySubjectIds NÃO é aplicada no DYNAMIC.
    expect(day1TheoryItems.length).toBe(3);
    expect(day1TheoryItems[0].subjectId).toBe("sub-dt");
    expect(day1TheoryItems[1].subjectId).toBe("sub-dt");
    expect(day1TheoryItems[2].subjectId).toBe("sub-dt");
  });
});
