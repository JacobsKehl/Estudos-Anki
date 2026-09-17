/**
 * src/__tests__/reviews/get-new-cards-waiting-count.test.ts
 *
 * T13.1: getNewCardsWaitingCount é o ESTOQUE NOVO — o que ela ainda não viu.
 * Decisão de produto (T13.1): cartão novo NÃO é dívida. Contar novos como
 * vencidos é o que inflava /profile para 526 sem nada a cobrar dela.
 */
import { prisma } from "@/lib/prisma";
import { getNewCardsWaitingCount } from "@/lib/reviews/get-new-cards-waiting-count";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    flashcard: { count: jest.fn() },
  },
}));

const mockPrisma = prisma as jest.Mocked<any>;

describe("getNewCardsWaitingCount — estoque novo, não é dívida", () => {
  const userId = "user-new-fixture";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passa status APPROVED, reviewState NEW e lastReviewedAt null — sem usar nextReviewAt", async () => {
    mockPrisma.flashcard.count.mockResolvedValue(66);

    const result = await getNewCardsWaitingCount(userId);

    expect(result).toBe(66);
    expect(mockPrisma.flashcard.count).toHaveBeenCalledWith({
      where: {
        userId,
        status: "APPROVED",
        reviewState: "NEW",
        lastReviewedAt: null,
      },
    });
  });
});
