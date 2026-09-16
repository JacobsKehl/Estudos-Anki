/**
 * src/__tests__/reviews/get-due-flashcards.test.ts
 *
 * Teto diário da fila de revisão SRS: no máximo SRS_LIMITS.maxReviewsPerDay cartões,
 * os mais atrasados primeiro. Nenhum nextReviewAt é reescrito — é só a consulta que
 * monta o deck do dia.
 */
import { prisma } from "@/lib/prisma";
import { getDueFlashcards } from "@/lib/reviews/get-due-flashcards";
import { SRS_LIMITS } from "@/lib/scheduler/config";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    flashcard: { findMany: jest.fn() },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("getDueFlashcards — teto diário da fila de revisão", () => {
  const userId = "user-srs-fixture";

  // 250 cartões vencidos, cada um com nextReviewAt distinto (do mais antigo ao mais recente)
  const ALL_DUE_CARDS = Array.from({ length: 250 }, (_, i) => ({
    id: `card-${i}`,
    nextReviewAt: new Date(2026, 7, 1, 0, 0, i), // 2026-08-01T00:00:0i — ordem estável e distinta
    question: `q${i}`,
    answer: `a${i}`,
  }));

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fiel à semântica real do Postgres/Prisma: respeita orderBy e take recebidos.
    (mockPrisma.flashcard.findMany as jest.Mock).mockImplementation(async (args: any) => {
      let result = [...ALL_DUE_CARDS];
      if (args?.orderBy?.nextReviewAt === "asc") {
        result.sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime());
      }
      if (typeof args?.take === "number") {
        result = result.slice(0, args.take);
      }
      return result;
    });
  });

  it(`devolve no máximo ${SRS_LIMITS.maxReviewsPerDay} cartões, mesmo com 250 vencidos`, async () => {
    const result = await getDueFlashcards({ userId });

    expect(result.length).toBe(SRS_LIMITS.maxReviewsPerDay);
  });

  it("devolve os mais atrasados primeiro (os N com nextReviewAt mais antigo)", async () => {
    const result = await getDueFlashcards({ userId });

    const expectedIds = ALL_DUE_CARDS.slice(0, SRS_LIMITS.maxReviewsPerDay).map((c) => c.id);
    expect(result.map((c: any) => c.id)).toEqual(expectedIds);
  });

  it("passa take e orderBy nextReviewAt asc para o Prisma", async () => {
    await getDueFlashcards({ userId });

    expect(mockPrisma.flashcard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { nextReviewAt: "asc" },
        take: SRS_LIMITS.maxReviewsPerDay,
      })
    );
  });
});
