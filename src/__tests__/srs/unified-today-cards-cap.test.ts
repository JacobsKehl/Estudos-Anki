/**
 * src/__tests__/srs/unified-today-cards-cap.test.ts
 *
 * H1 (auditoria 16-17/09): getUnifiedTodayCards é a função que alimenta a
 * tela ("Cards do Dia" na home) e a rota /practice?source=today (o botão que
 * a Gabriela realmente clica) — e ela nunca importou SRS_LIMITS. O teto de
 * 100 (Frente B, commit 1671a946) foi implementado em getDueFlashcards, que
 * só é usada por /reviews/session — uma rota que ela não usa. Teste de
 * função não prova rota.
 *
 * A tela mostrava 461, decomposto de duas formas independentes que fecham
 * entre si (os 2 cartões de hoje já estão DENTRO dos 461, não somados a eles):
 *   por estado:  42 novos + 12 aprendendo + 407 revisões        = 461
 *   por origem:   2 de conteúdo de hoje + 459 espaçadas         = 461
 * Este fixture modela "hoje" como uma 5ª categoria disjunta (2 cartões NEW
 * só de blocos de hoje, separados dos outros 42/12/407) para deixar a
 * prioridade 1 fácil de testar isoladamente — por isso o total do fixture é
 * 463, não 461. Isso não invalida o vermelho: qualquer total acima do teto
 * de 100 prova o mesmo defeito.
 *
 * Prioridade dentro do teto (decisão da auditoria, ordem de prioridade):
 *   1) cartões dos blocos estudados HOJE (sem isso o estudo do dia fica sem revisão)
 *   2) LEARNING / RELEARNING (já no meio do caminho, interromper é o pior custo)
 *   3) REVIEW vencidos, mais antigo primeiro
 *   4) NEW, com o que sobrar
 * Nunca reescreve nextReviewAt — o que não coube continua vencido e reaparece amanhã.
 */
import { prisma } from "@/lib/prisma";
import { getUnifiedTodayCards } from "@/lib/srs/srs-utils";
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
  // 2 cartões dos blocos estudados HOJE — recém-gerados, ainda NEW.
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

  // 12 LEARNING/RELEARNING vencidos — no meio do caminho.
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

  // 407 REVIEW vencidos, nextReviewAt distinto e crescente (index 0 = mais antigo).
  const reviewCards = Array.from({ length: 407 }, (_, i) => ({
    id: `review-${i}`,
    studyBlockId: "block-revisao",
    reviewState: "REVIEW",
    nextReviewAt: past(5000 - i), // i=0 é o mais atrasado (subtrai mais)
    lastReviewedAt: past(6000 - i),
    repetitionCount: 3,
    subject: { name: "Direito Processual Civil" },
    studyBlock: { id: "block-revisao", title: "Bloco de Revisão" },
  }));

  // 42 NEW nunca revisados, de blocos que não são os de hoje.
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

describe("getUnifiedTodayCards — teto diário na rota que a Gabriela realmente usa", () => {
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

  it(`nunca devolve mais que SRS_LIMITS.maxReviewsPerDay (${SRS_LIMITS.maxReviewsPerDay}) cartões, mesmo com ${allCards.length} elegíveis`, async () => {
    const result = await getUnifiedTodayCards(userId);

    expect(result.stats.total).toBeLessThanOrEqual(SRS_LIMITS.maxReviewsPerDay);
    expect(result.cards.length).toBeLessThanOrEqual(SRS_LIMITS.maxReviewsPerDay);
  });

  it("prioridade 1: TODOS os cartões dos blocos estudados hoje entram, sempre", async () => {
    const result = await getUnifiedTodayCards(userId);
    const ids = result.cards.map((c: any) => c.id);

    for (const c of todayBlockCards) {
      expect(ids).toContain(c.id);
    }
  });

  it("prioridade 2: TODOS os LEARNING/RELEARNING entram (12), antes de qualquer REVIEW/NEW", async () => {
    const result = await getUnifiedTodayCards(userId);
    const ids = result.cards.map((c: any) => c.id);

    for (const c of learningCards) {
      expect(ids).toContain(c.id);
    }
  });

  it("prioridade 3: o restante do teto (86 vagas) é preenchido pelos REVIEW mais antigos primeiro", async () => {
    const result = await getUnifiedTodayCards(userId);
    const ids = result.cards.map((c: any) => c.id);

    // 100 - 2 (hoje) - 12 (learning) = 86 vagas para REVIEW
    const expectedReviewIds = reviewCards.slice(0, 86).map((c) => c.id);
    for (const id of expectedReviewIds) {
      expect(ids).toContain(id);
    }
    // o resto dos REVIEW (321 mais recentes) NÃO deve entrar
    const excludedReviewIds = reviewCards.slice(86).map((c) => c.id);
    for (const id of excludedReviewIds) {
      expect(ids).not.toContain(id);
    }
  });

  it("prioridade 4: nenhum NEW entra quando o teto já foi consumido por prioridades mais altas", async () => {
    const result = await getUnifiedTodayCards(userId);
    const ids = result.cards.map((c: any) => c.id);

    for (const c of newCards) {
      expect(ids).not.toContain(c.id);
    }
  });

  it(`devolve exatamente ${SRS_LIMITS.maxReviewsPerDay} cartões (2 hoje + 12 learning + 86 review)`, async () => {
    const result = await getUnifiedTodayCards(userId);
    expect(result.cards.length).toBe(SRS_LIMITS.maxReviewsPerDay);
    expect(result.stats.total).toBe(SRS_LIMITS.maxReviewsPerDay);
  });

  it("NUNCA escreve no banco — não reescreve nextReviewAt, só corta a fila de saída", async () => {
    await getUnifiedTodayCards(userId);

    expect(mockPrisma.flashcard.update).not.toHaveBeenCalled();
    expect(mockPrisma.flashcard.updateMany).not.toHaveBeenCalled();
  });
});
