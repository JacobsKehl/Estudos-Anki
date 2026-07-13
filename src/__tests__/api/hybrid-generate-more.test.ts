/**
 * src/__tests__/api/hybrid-generate-more.test.ts
 *
 * Testes unitários para o endpoint de geração incremental de flashcards híbridos.
 */

import { POST as generateMorePOST } from "@/app/api/blocks/[id]/flashcards/generate-more/route";
import { prisma } from "@/lib/prisma";
import { registerHybridFlashcardProvider, clearHybridFlashcardProvider } from "@/lib/ai/providers/hybrid-registry";
import { NextRequest } from "next/server";

// Mock do Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    studyBlock: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    flashcard: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    extractedContent: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
  },
}));

jest.mock("@/lib/auth-mock", () => ({
  getMockUserId: jest.fn().mockResolvedValue("user-123"),
}));

describe("API Generate More Flashcards — Hybrid Blocks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearHybridFlashcardProvider();
  });

  afterEach(() => {
    clearHybridFlashcardProvider();
  });

  it("deve retornar 503 quando o provider de flashcards híbridos não estiver registrado", async () => {
    (prisma.studyBlock.findFirst as jest.Mock).mockResolvedValue({
      id: "hb-1",
      userId: "user-123",
      methodology: "HYBRID_8020",
      subjectId: "sub-1",
      sources: []
    });

    const req = new NextRequest("http://localhost/api/blocks/hb-1/flashcards/generate-more", {
      method: "POST",
    });

    const res = await generateMorePOST(req, { params: Promise.resolve({ id: "hb-1" }) });
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.code).toBe("HYBRID_FLASHCARD_ENGINE_NOT_CONFIGURED");
    expect(data.error).toContain("motor de flashcards híbridos");
  });

  it("deve gerar cards como PENDING_APPROVAL salvando os metadados corretos com o provider ativo", async () => {
    (prisma.studyBlock.findFirst as jest.Mock).mockResolvedValue({
      id: "hb-1",
      userId: "user-123",
      methodology: "HYBRID_8020",
      subjectId: "sub-1",
      sources: [
        {
          materialId: "mat-cfc",
          sourceRole: "ANCHOR_8020",
          segments: [
            { pageStart: 5, pageEnd: 7, disposition: "READ" }
          ]
        }
      ]
    });

    (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
      { materialId: "mat-cfc", pageNumber: 5, text: "Conteúdo da pág 5" }
    ]);

    // Mock do provider injetável
    const mockProvider = {
      generate: jest.fn().mockResolvedValue([
        {
          question: "Qual o prazo?",
          answer: "5 dias.",
          type: "QUESTION_ANSWER",
          sourceMaterialId: "mat-cfc",
          sourcePageStart: 5,
          sourcePageEnd: 5,
          generationReason: "Foco no prazo legal"
        }
      ])
    };

    registerHybridFlashcardProvider(mockProvider);

    // Mock do create no Prisma
    const mockCreatedCard = {
      id: "fc-new-1",
      question: "Qual o prazo?",
      answer: "5 dias.",
      type: "QUESTION_ANSWER",
      status: "PENDING_APPROVAL",
      difficulty: "NORMAL_PLUS"
    };
    (prisma.flashcard.create as jest.Mock).mockResolvedValue(mockCreatedCard);

    const req = new NextRequest("http://localhost/api/blocks/hb-1/flashcards/generate-more", {
      method: "POST",
    });

    const res = await generateMorePOST(req, { params: Promise.resolve({ id: "hb-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(1);
    expect(data.flashcards[0].status).toBe("PENDING_APPROVAL");

    // Verificar se o provider foi chamado corretamente apenas com as páginas READ
    expect(mockProvider.generate).toHaveBeenCalledWith(expect.objectContaining({
      pages: [
        { materialId: "mat-cfc", pageNumber: 5, text: "Conteúdo da pág 5" }
      ],
      requestedAmount: 5 // 18 - 0 existing cards (máximo 5 por lote)
    }));

    // Verificar se salvou com PENDING_APPROVAL e com metadados corretos
    expect(prisma.flashcard.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "PENDING_APPROVAL",
        materialId: "mat-cfc",
        sourcePageStart: 5,
        sourcePageEnd: 5,
        generationReason: "Foco no prazo legal"
      })
    });
  });

  it("deve solicitar a quantidade exata restante quando houver 17 cards (requestedAmount 1)", async () => {
    (prisma.studyBlock.findFirst as jest.Mock).mockResolvedValue({
      id: "hb-1",
      userId: "user-123",
      methodology: "HYBRID_8020",
      subjectId: "sub-1",
      sources: [
        {
          materialId: "mat-cfc",
          sourceRole: "ANCHOR_8020",
          segments: [{ pageStart: 5, pageEnd: 5, disposition: "READ" }]
        }
      ]
    });

    // 17 cards existentes
    (prisma.flashcard.findMany as jest.Mock).mockResolvedValue(Array(17).fill({ id: "fc-x", question: "Q", answer: "A" }));

    (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
      { materialId: "mat-cfc", pageNumber: 5, text: "Conteúdo pág 5" }
    ]);

    const mockProvider = {
      generate: jest.fn().mockResolvedValue([
        {
          question: "Q?",
          answer: "A.",
          type: "QUESTION_ANSWER",
          sourceMaterialId: "mat-cfc",
          sourcePageStart: 5,
          sourcePageEnd: 5,
          generationReason: "R"
        }
      ])
    };
    registerHybridFlashcardProvider(mockProvider);

    const req = new NextRequest("http://localhost/api/blocks/hb-1/flashcards/generate-more", {
      method: "POST",
    });

    await generateMorePOST(req, { params: Promise.resolve({ id: "hb-1" }) });

    expect(mockProvider.generate).toHaveBeenCalledWith(expect.objectContaining({
      requestedAmount: 1
    }));
  });

  it("deve retornar count 0 e não chamar o provider quando houver exatamente 18 cards", async () => {
    (prisma.studyBlock.findFirst as jest.Mock).mockResolvedValue({
      id: "hb-1",
      userId: "user-123",
      methodology: "HYBRID_8020",
      subjectId: "sub-1",
      sources: []
    });

    // 18 cards existentes
    (prisma.flashcard.findMany as jest.Mock).mockResolvedValue(Array(18).fill({ id: "fc-x", question: "Q", answer: "A" }));

    const mockProvider = {
      generate: jest.fn()
    };
    registerHybridFlashcardProvider(mockProvider);

    const req = new NextRequest("http://localhost/api/blocks/hb-1/flashcards/generate-more", {
      method: "POST",
    });

    const res = await generateMorePOST(req, { params: Promise.resolve({ id: "hb-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(0);
    expect(data.message).toContain("limite de flashcards");
    expect(mockProvider.generate).not.toHaveBeenCalled();
    expect(prisma.flashcard.create).not.toHaveBeenCalled();
  });

  it("deve retornar count 0 e não chamar o provider quando houver mais de 18 cards (ex: 19)", async () => {
    (prisma.studyBlock.findFirst as jest.Mock).mockResolvedValue({
      id: "hb-1",
      userId: "user-123",
      methodology: "HYBRID_8020",
      subjectId: "sub-1",
      sources: []
    });

    // 19 cards existentes
    (prisma.flashcard.findMany as jest.Mock).mockResolvedValue(Array(19).fill({ id: "fc-x", question: "Q", answer: "A" }));

    const mockProvider = {
      generate: jest.fn()
    };
    registerHybridFlashcardProvider(mockProvider);

    const req = new NextRequest("http://localhost/api/blocks/hb-1/flashcards/generate-more", {
      method: "POST",
    });

    const res = await generateMorePOST(req, { params: Promise.resolve({ id: "hb-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(0);
    expect(data.message).toContain("limite de flashcards");
    expect(mockProvider.generate).not.toHaveBeenCalled();
  });
});
