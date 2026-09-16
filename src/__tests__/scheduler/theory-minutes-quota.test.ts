/**
 * src/__tests__/scheduler/theory-minutes-quota.test.ts
 *
 * C.1 — cota de teoria em minutos: SCHEDULER_LIMITS.dailyTheoryMinutesTarget (45),
 * piso 30, teto 60. dailyGoalMinutes (120) é o TOTAL do dia e NÃO deve ser usado
 * como base do cálculo de teoria.
 *
 * Antes do conserto, reorganizeOverdueSchedule computava a cota como
 * `dailyStudyMinutes - 30` (90 min com dailyStudyMinutes=120), quase o dobro do
 * alvo real.
 */
import { reorganizeOverdueSchedule } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";
import { SCHEDULER_LIMITS } from "@/lib/scheduler/config";

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

describe("C.1 — cota diária de teoria em minutos", () => {
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

  test("um dia com blocos de 24 min disponíveis para todas as matérias do ciclo não aloca mais que 60 min de teoria", async () => {
    const today = new Date("2026-08-11T10:00:00.000Z");

    // Um item PENDING atrasado é necessário para o algoritmo não tomar o atalho de
    // idempotência ("nenhum item pendente, nada a fazer") — reflete o estado real
    // da Gabriela, que sempre tem algo pendente no cronograma ativo.
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
      dailyStudyMinutes: 120, // TOTAL do dia — não é a cota de teoria
      items: [seedOverdueItem],
    });

    (prisma.studyScheduleItem.findMany as jest.Mock).mockResolvedValue([]);

    // Blocos de 24 min (o maior tamanho do blueprint, 8 páginas) disponíveis para todas
    // as matérias do ciclo — cenário mais generoso possível para estourar a cota.
    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue(
      eligibleSubjects.flatMap((s, subIdx) =>
        Array.from({ length: 3 }, (_, i) => ({
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

    // Minutos reais alocados para o dia 1, lidos das chamadas de escrita (não do
    // relatório de mudanças, que não carrega estimatedMinutes).
    const isDay1 = (d: any) => d && new Date(d).toISOString().startsWith("2026-08-11");

    const createManyCalls = (prisma.studyScheduleItem.createMany as jest.Mock).mock.calls;
    const createdDay1: any[] = createManyCalls.flatMap(([arg]: any) =>
      (arg?.data || []).filter((it: any) => it.actionType === "THEORY" && isDay1(it.scheduledDate))
    );

    const updateManyCalls = (prisma.studyScheduleItem.updateMany as jest.Mock).mock.calls;
    const updatedDay1: any[] = updateManyCalls
      .map(([arg]: any) => arg?.data)
      .filter((d: any) => d && isDay1(d.scheduledDate))
      // o update do item seed não reescreve estimatedMinutes; usa o valor original do item
      .map((d: any) => ({ estimatedMinutes: d.estimatedMinutes ?? seedOverdueItem.estimatedMinutes }));

    const allocatedDay1 = [...createdDay1, ...updatedDay1];
    const totalMinutesDay1 = allocatedDay1.reduce((sum, it) => sum + (it.estimatedMinutes || 0), 0);

    expect(allocatedDay1.length).toBeGreaterThan(0);
    expect(totalMinutesDay1).toBeLessThanOrEqual(SCHEDULER_LIMITS.dailyTheoryMinutesCeil);
    expect(totalMinutesDay1).toBeGreaterThanOrEqual(SCHEDULER_LIMITS.dailyTheoryMinutesFloor);
  });
});
