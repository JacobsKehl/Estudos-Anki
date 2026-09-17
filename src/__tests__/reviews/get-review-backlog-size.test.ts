/**
 * src/__tests__/reviews/get-review-backlog-size.test.ts
 *
 * T13.1: getReviewBacklogSize é a DÍVIDA de revisão — quanto ela já estudou e
 * deve, sem teto e sem prioridade. NÃO é "nextReviewAt <= now" sozinho: como
 * Flashcard.nextReviewAt tem @default(now()) no schema, um cartão NEW nasce
 * vencido, e esse predicado sozinho conta estoque como dívida (era o defeito
 * de /profile:81, que dava 526 em vez de 460).
 *
 * A dívida real exclui NEW (reviewState) e exige lastReviewedAt != null —
 * cinto e suspensório contra o default do schema.
 */
import { prisma } from "@/lib/prisma";
import { getReviewBacklogSize, getReviewBacklogCards } from "@/lib/reviews/get-review-backlog-size";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    flashcard: { count: jest.fn(), findMany: jest.fn() },
  },
}));

const mockPrisma = prisma as jest.Mocked<any>;

describe("getReviewBacklogSize — a dívida de revisão, sem NEW e sem teto", () => {
  const userId = "user-backlog-fixture";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passa status APPROVED, reviewState excluindo NEW, nextReviewAt<=now e lastReviewedAt not null", async () => {
    mockPrisma.flashcard.count.mockResolvedValue(460);

    const result = await getReviewBacklogSize(userId);

    expect(result).toBe(460);
    expect(mockPrisma.flashcard.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          status: "APPROVED",
          reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] },
          nextReviewAt: expect.objectContaining({ lte: expect.any(Date) }),
          lastReviewedAt: { not: null },
        }),
      })
    );
  });

  it("não tem take/slice — nenhum teto aplicado ao resultado", async () => {
    mockPrisma.flashcard.count.mockResolvedValue(526);

    const result = await getReviewBacklogSize(userId);

    expect(result).toBe(526);
    const callArgs = mockPrisma.flashcard.count.mock.calls[0][0];
    expect(callArgs.take).toBeUndefined();
  });
});

describe("getReviewBacklogCards — a mesma dívida, com as linhas completas", () => {
  const userId = "user-backlog-fixture";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("usa o MESMO where de getReviewBacklogSize (exclui NEW, exige lastReviewedAt)", async () => {
    mockPrisma.flashcard.findMany.mockResolvedValue([{ id: "c1", subject: { name: "Direito do Trabalho" } }]);

    const result = await getReviewBacklogCards(userId);

    expect(result).toHaveLength(1);
    expect(mockPrisma.flashcard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          status: "APPROVED",
          reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] },
          lastReviewedAt: { not: null },
        }),
      })
    );
  });
});
