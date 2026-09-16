/**
 * src/__tests__/scheduler/theory-floor-and-ceiling.test.ts
 *
 * Auditoria do 0c26522d — três defeitos corrigidos aqui:
 *
 * C.1a — o ramo do 3º bloco nunca executava (currentTheoryCountOnDay < 2 já é
 *        falso depois das 2 matérias obrigatórias). O piso de 30 min não era
 *        garantido.
 * C.1b — SCHEDULER_LIMITS.dailyTheoryMinutesFloor não era lido em lugar nenhum
 *        do código de produção.
 * C.1c — o teste de teto do C.1 nunca exercitava as guardas de teto de verdade
 *        (a parada vinha do `>= target`, não da guarda de `> ceil`).
 *
 * Regra de produto (decidida): as matérias obrigatórias do ciclo (2, via
 * SCHEDULER_LIMITS.maxNewTheoryPerDay) entram SEMPRE, independentemente de
 * minutos. Piso/alvo/teto só governam o preenchimento ADICIONAL.
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

describe("C.1a/b/c — piso, alvo e teto da teoria diária", () => {
  const userId = "user-gabriela-test";
  const today = new Date("2026-08-11T10:00:00.000Z");

  // Direito do Trabalho e Língua Portuguesa são as 2 primeiras matérias do
  // ciclo canônico TRT4 (índices 0 e 1) — sempre entram como obrigatórias.
  // Direito Processual do Trabalho (índice 2) nunca recebe slot obrigatório
  // com maxNewTheoryPerDay=2 — só é alcançável pelo preenchimento de piso/alvo.
  const dt = { id: "sub-dt", name: "Direito do Trabalho", studyPriority: "PRIMARY" };
  const lp = { id: "sub-lp", name: "Língua Portuguesa", studyPriority: "PRIMARY" };
  const dpt = { id: "sub-dpt", name: "Direito Processual do Trabalho", studyPriority: "PRIMARY" };
  const eligibleSubjects = [dt, lp, dpt];

  function setup(blocks: { id: string; subjectId: string; estimatedStudyMinutes: number }[]) {
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
    (prisma.studyScheduleItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.studyScheduleItem.update as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studyScheduleItem.updateMany as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studyScheduleItem.create as jest.Mock).mockImplementation(async ({ data }: any) => data);
    (prisma.studySchedule.update as jest.Mock).mockResolvedValue({});

    // Um item PENDING atrasado é necessário para não cair no atalho de
    // idempotência — não conta minutos (0 min), só destrava o algoritmo.
    const seedItem = {
      id: "item-seed",
      userId,
      subjectId: "sub-dpt",
      studyBlockId: "block-seed-unused",
      actionType: "SUPPORT",
      status: "PENDING",
      scheduledDate: new Date("2026-08-01T10:00:00.000Z"),
      dayNumber: 1,
      estimatedMinutes: 0,
      subject: dpt,
      studyBlock: { id: "block-seed-unused", title: "Seed", theoryStatus: "NOT_STARTED", flashcards: [{ id: "fc" }] },
    };

    (prisma.studySchedule.findFirst as jest.Mock).mockResolvedValue({
      id: "sched-1",
      userId,
      status: "ACTIVE",
      dailyStudyMinutes: 120,
      items: [seedItem],
    });

    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue(
      blocks.map((b) => ({
        id: b.id,
        subjectId: b.subjectId,
        estimatedStudyMinutes: b.estimatedStudyMinutes,
        orderIndex: 1,
        material: { fileName: `${eligibleSubjects.find((s) => s.id === b.subjectId)?.name} 1.pdf` },
        subject: eligibleSubjects.find((s) => s.id === b.subjectId),
      }))
    );
  }

  async function getDay1AllocatedMinutes() {
    const result = await reorganizeOverdueSchedule(userId, false, false, today);
    expect(result.success).toBe(true);

    const isDay1 = (d: any) => d && new Date(d).toISOString().startsWith("2026-08-11");
    const createManyCalls = (prisma.studyScheduleItem.createMany as jest.Mock).mock.calls;
    const createdDay1: any[] = createManyCalls.flatMap(([arg]: any) =>
      (arg?.data || []).filter((it: any) => it.actionType === "THEORY" && isDay1(it.scheduledDate))
    );
    return { result, createdDay1, totalMinutes: createdDay1.reduce((sum, it) => sum + (it.estimatedMinutes || 0), 0) };
  }

  test("T1 — piso: dia com 2 obrigatórias pequenas (3+6=9) mais um bloco de 24 min disponível soma >= 30", async () => {
    setup([
      { id: "block-dt-1", subjectId: "sub-dt", estimatedStudyMinutes: 3 },
      { id: "block-lp-1", subjectId: "sub-lp", estimatedStudyMinutes: 6 },
      { id: "block-dpt-1", subjectId: "sub-dpt", estimatedStudyMinutes: 24 },
    ]);

    const { totalMinutes } = await getDay1AllocatedMinutes();
    expect(totalMinutes).toBeGreaterThanOrEqual(SCHEDULER_LIMITS.dailyTheoryMinutesFloor);
  });

  test("T2 — teto de verdade: 2 obrigatórias de 20 min (40) mais um bloco de 24 disponível — com guarda o dia fica em 40, não 64", async () => {
    setup([
      { id: "block-dt-1", subjectId: "sub-dt", estimatedStudyMinutes: 20 },
      { id: "block-lp-1", subjectId: "sub-lp", estimatedStudyMinutes: 20 },
      { id: "block-dpt-1", subjectId: "sub-dpt", estimatedStudyMinutes: 24 },
    ]);

    const { totalMinutes } = await getDay1AllocatedMinutes();
    expect(totalMinutes).toBeLessThanOrEqual(SCHEDULER_LIMITS.dailyTheoryMinutesCeil);
    expect(totalMinutes).toBe(40);
  });

  test("T3 — as 2 matérias obrigatórias do ciclo sempre entram, mesmo somando mais que o alvo (45) e o teto (60)", async () => {
    setup([
      { id: "block-dt-1", subjectId: "sub-dt", estimatedStudyMinutes: 40 },
      { id: "block-lp-1", subjectId: "sub-lp", estimatedStudyMinutes: 40 },
    ]);

    const { result } = await getDay1AllocatedMinutes();
    const day1Subjects = result.changes
      .filter((c) => c.newDate === "2026-08-11" && c.actionType === "THEORY")
      .map((c) => c.subjectName);
    expect(day1Subjects).toContain("Direito do Trabalho");
    expect(day1Subjects).toContain("Língua Portuguesa");
  });

  test("T4 — bloco com estimatedStudyMinutes = 0 não é contado como 45", async () => {
    setup([
      { id: "block-dt-1", subjectId: "sub-dt", estimatedStudyMinutes: 0 },
      { id: "block-lp-1", subjectId: "sub-lp", estimatedStudyMinutes: 6 },
    ]);

    const { createdDay1 } = await getDay1AllocatedMinutes();
    const dtItem = createdDay1.find((it) => it.subjectId === "sub-dt");
    expect(dtItem).toBeDefined();
    expect(dtItem.estimatedMinutes).toBe(0);
  });
});
