/**
 * src/__tests__/services/global-metrics-cfc-scope.test.ts
 *
 * T16.1/T18.1: getGlobalMetrics.globalProgress filtrava por
 * `subject.studyPriority in [PRIMARY,ACTIVE]` + `material.materialRole !=
 * SUPPORT_MATERIAL` — eixos mais largos que o conteúdo principal. Medido em
 * produção: 436 blocos não-CFC (Português, Direito Civil, "Estratégia")
 * entravam nesse escopo porque pertencem a matérias PRIMARY e não são
 * SUPPORT_MATERIAL. numerador/denominador viravam 182/525 (35%) em vez de
 * 48/89 (54%).
 *
 * Decisão do Henrique (17/09/2026): conteúdo principal = os 5 PDFs do CFC.
 * A lista branca já existe e já é usada pelo agendador e pelo guardião —
 * CFC_FILE_NAMES em src/lib/scheduler/config.ts. globalProgress passa a
 * filtrar por ela, não por studyPriority/materialRole.
 */
import { prisma } from "@/lib/prisma";
import { getGlobalMetrics } from "@/lib/services/subject-metrics";
import { CFC_FILE_NAMES } from "@/lib/scheduler/config";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    studySubject: { findMany: jest.fn(), findFirst: jest.fn() },
    flashcardReview: { findMany: jest.fn() },
    flashcard: { groupBy: jest.fn() },
    studySessionLog: { findMany: jest.fn() },
    studyScheduleItem: { findMany: jest.fn() },
    questionReviewTask: { findMany: jest.fn() },
    studyBlock: { findMany: jest.fn(), findFirst: jest.fn() },
  },
}));

const mockPrisma = prisma as jest.Mocked<any>;

describe("getGlobalMetrics — globalProgress escopado por CFC_FILE_NAMES", () => {
  const userId = "user-cfc-scope-fixture";

  beforeEach(() => {
    jest.clearAllMocks();
    // subjects vazio => getAllSubjectsMetrics devolve [] e não chama mais
    // prisma.studyBlock nenhuma outra vez — o único chamador de
    // studyBlock.findMany neste teste é a query de eligibleBlocks.
    mockPrisma.studySubject.findMany.mockResolvedValue([]);
    mockPrisma.flashcardReview.findMany.mockResolvedValue([]);
    mockPrisma.flashcard.groupBy.mockResolvedValue([]);
    mockPrisma.studySessionLog.findMany.mockResolvedValue([]);
    mockPrisma.studyScheduleItem.findMany.mockResolvedValue([]);
    mockPrisma.questionReviewTask.findMany.mockResolvedValue([]);
  });

  it("consulta studyBlock filtrando por material.originalFileName in CFC_FILE_NAMES, não por studyPriority/materialRole", async () => {
    mockPrisma.studyBlock.findMany.mockResolvedValue([]);

    await getGlobalMetrics(userId);

    expect(mockPrisma.studyBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          material: expect.objectContaining({
            originalFileName: { in: CFC_FILE_NAMES },
          }),
        }),
      })
    );

    const calledWhere = mockPrisma.studyBlock.findMany.mock.calls[0][0].where;
    expect(calledWhere.subject).toBeUndefined();
  });

  it("48/89 (54%) — não 182/525 (35%): só os blocos que a query devolveu entram na conta", async () => {
    // A query já filtra no Prisma (where acima); o mock simula o resultado
    // JÁ filtrado por CFC_FILE_NAMES: 89 blocos, 48 COMPLETED.
    const cfcBlocks = [
      ...Array.from({ length: 48 }, () => ({ theoryStatus: "COMPLETED" })),
      ...Array.from({ length: 41 }, () => ({ theoryStatus: "NOT_STARTED" })),
    ];
    mockPrisma.studyBlock.findMany.mockResolvedValue(cfcBlocks);

    const result = await getGlobalMetrics(userId);

    expect(result.summary.globalProgress).toBe(54); // Math.round(48/89*100)
  });

  it("summary.totalBlocks/completedBlocks são 89/48 (escopo CFC) — não a soma bruta de todas as matérias", async () => {
    // Uma matéria não-CFC com 500 blocos "some.subject.metrics.totalBlocks" —
    // se summary ainda somasse subjectsMetrics.reduce(...), veríamos 500 aqui.
    mockPrisma.studySubject.findMany.mockResolvedValue([{ id: "subj-nao-cfc", name: "Língua Portuguesa" }]);
    mockPrisma.studySubject.findFirst.mockResolvedValue({
      id: "subj-nao-cfc",
      materials: [],
      studyBlocks: Array.from({ length: 500 }, () => ({ theoryStatus: "NOT_STARTED" })),
      flashcards: [],
    });
    mockPrisma.flashcardReview.findMany.mockResolvedValue([]);
    mockPrisma.studyBlock.findFirst.mockResolvedValue(null);

    const cfcBlocks = [
      ...Array.from({ length: 48 }, () => ({ theoryStatus: "COMPLETED" })),
      ...Array.from({ length: 41 }, () => ({ theoryStatus: "NOT_STARTED" })),
    ];
    mockPrisma.studyBlock.findMany.mockResolvedValue(cfcBlocks);

    const result = await getGlobalMetrics(userId);

    expect(result.summary.totalBlocks).toBe(89);
    expect(result.summary.completedBlocks).toBe(48);
  });
});
