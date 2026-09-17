/**
 * src/__tests__/srs/today-review-queue.test.ts
 *
 * T13.1: getTodayReviewQueue é a FILA DE HOJE — fonte única para home
 * (contador e fila), /practice e o botão de /reviews. Mesma regra de teto e
 * prioridade que getUnifiedTodayCards já tinha (T2): 1) blocos estudados
 * hoje, 2) LEARNING/RELEARNING, 3) REVIEW mais antigo primeiro, 4) NEW —
 * nunca reescreve nextReviewAt.
 *
 * Este teste é o mesmo cenário de unified-today-cards-cap.test.ts, agora
 * contra a função com o nome canônico em src/lib/srs/. Depois que home e
 * /practice migrarem (T13.4 passo 5), getUnifiedTodayCards sai e este teste
 * passa a ser a única cobertura da regra — não há perda de cobertura.
 */
import { prisma } from "@/lib/prisma";
import { getTodayReviewQueue } from "@/lib/srs/today-review-queue";
import { SRS_LIMITS } from "@/lib/scheduler/config";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    studyScheduleItem: { findMany: jest.fn() },
    studyBlock: { findMany: jest.fn() },
    flashcard: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  },
}));

const mockPrisma = prisma as jest.Mocked<any>;

const TODAY_BLOCK_ID = "block-today";
const now = new Date("2026-09-17T14:00:00Z");
const past = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60000);

function buildCards() {
  const todayBlockCards = Array.from({ length: 2 }, (_, i) => ({
    id: `today-${i}`,
    studyBlockId: TODAY_BLOCK_ID,
    reviewState: "NEW",
    nextReviewAt: null,
    lastReviewedAt: null,
    repetitionCount: 0,
    subject: { name: "Direito do Trabalho" },
    studyBlock: { id: TODAY_BLOCK_ID, title: "Bloco de Hoje" },
  }));

  const learningCards = Array.from({ length: 12 }, (_, i) => ({
    id: `learning-${i}`,
    studyBlockId: "block-outro",
    reviewState: i % 2 === 0 ? "LEARNING" : "RELEARNING",
    nextReviewAt: past(1000 + i),
    lastReviewedAt: past(2000 + i),
    repetitionCount: 1,
    subject: { name: "Direito Constitucional" },
    studyBlock: { id: "block-outro", title: "Outro Bloco" },
  }));

  const reviewCards = Array.from({ length: 407 }, (_, i) => ({
    id: `review-${i}`,
    studyBlockId: "block-revisao",
    reviewState: "REVIEW",
    nextReviewAt: past(5000 - i),
    lastReviewedAt: past(6000 - i),
    repetitionCount: 3,
    subject: { name: "Direito Processual Civil" },
    studyBlock: { id: "block-revisao", title: "Bloco de Revisão" },
  }));

  const newCards = Array.from({ length: 42 }, (_, i) => ({
    id: `new-${i}`,
    studyBlockId: "block-novo",
    reviewState: "NEW",
    nextReviewAt: null,
    lastReviewedAt: null,
    repetitionCount: 0,
    subject: { name: "Direito Administrativo" },
    studyBlock: { id: "block-novo", title: "Bloco Novo" },
  }));

  return { todayBlockCards, learningCards, reviewCards, newCards };
}

describe("getTodayReviewQueue — fila de hoje, fonte única", () => {
  const userId = "user-gabriela-fixture";
  const { todayBlockCards, learningCards, reviewCards, newCards } = buildCards();
  const allCards = [...todayBlockCards, ...learningCards, ...reviewCards, ...newCards];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);

    (mockPrisma.studyScheduleItem.findMany as jest.Mock).mockResolvedValue([
      { studyBlockId: TODAY_BLOCK_ID },
    ]);
    (mockPrisma.flashcard.findMany as jest.Mock).mockResolvedValue(allCards);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it(`nunca devolve mais que o teto (${SRS_LIMITS.maxReviewsPerDay})`, async () => {
    const result = await getTodayReviewQueue(userId);
    expect(result.stats.total).toBeLessThanOrEqual(SRS_LIMITS.maxReviewsPerDay);
    expect(result.cards.length).toBeLessThanOrEqual(SRS_LIMITS.maxReviewsPerDay);
  });

  it("prioridade 1: todos os cartões de hoje entram", async () => {
    const result = await getTodayReviewQueue(userId);
    const ids = result.cards.map((c: any) => c.id);
    for (const c of todayBlockCards) expect(ids).toContain(c.id);
  });

  it("prioridade 2: todos os learning/relearning entram", async () => {
    const result = await getTodayReviewQueue(userId);
    const ids = result.cards.map((c: any) => c.id);
    for (const c of learningCards) expect(ids).toContain(c.id);
  });

  it("prioridade 3: preenche o resto (86 vagas) com os review mais antigos", async () => {
    const result = await getTodayReviewQueue(userId);
    const ids = result.cards.map((c: any) => c.id);
    const expectedIds = reviewCards.slice(0, 86).map((c) => c.id);
    for (const id of expectedIds) expect(ids).toContain(id);
    for (const id of reviewCards.slice(86).map((c) => c.id)) expect(ids).not.toContain(id);
  });

  it("prioridade 4: nenhum NEW entra quando o teto já foi consumido", async () => {
    const result = await getTodayReviewQueue(userId);
    const ids = result.cards.map((c: any) => c.id);
    for (const c of newCards) expect(ids).not.toContain(c.id);
  });

  it("stats.total e cards vêm da MESMA lista já cortada", async () => {
    const result = await getTodayReviewQueue(userId);
    expect(result.stats.total).toBe(result.cards.length);
  });

  it("nunca escreve no banco", async () => {
    await getTodayReviewQueue(userId);
    expect(mockPrisma.flashcard.update).not.toHaveBeenCalled();
    expect(mockPrisma.flashcard.updateMany).not.toHaveBeenCalled();
  });
});
