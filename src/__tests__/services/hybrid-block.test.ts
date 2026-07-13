/**
 * Testes unitários para o serviço transacional createHybridBlock
 *
 * Executar com: npx jest src/__tests__/services/hybrid-block.test.ts
 */

import { createHybridBlock, PrismaLike } from "@/lib/services/hybrid-block";
import { HybridBlockOutput } from "@/lib/ai/hybrid-engine";

describe("createHybridBlock - Serviço Transacional", () => {
  const mockOutput: HybridBlockOutput = {
    generationRunId: "run-999",
    subject: "Direito Administrativo",
    title: "Atos Administrativos",
    methodology: "HYBRID_8020",
    confidence: 0.9,
    warnings: [],
    blockingWarnings: [],
    sources: [
      {
        materialId: "cfc-1",
        fileName: "CFC.pdf",
        sourceRole: "ANCHOR_8020",
        isCanonical: false,
        selectionReason: "Âncora",
        confidence: 0.95,
        orderIndex: 0,
        segments: [{ disposition: "READ", pageStart: 1, pageEnd: 3, reason: "READ cfc" }],
      },
      {
        materialId: "strat-1",
        fileName: "Estrategia.pdf",
        sourceRole: "DEEPENING",
        isCanonical: true,
        selectionReason: "Aprofundamento",
        confidence: 0.88,
        orderIndex: 1,
        segments: [
          { disposition: "READ", pageStart: 5, pageEnd: 10, reason: "READ strat" },
          { disposition: "SKIP", pageStart: 11, pageEnd: 15, reason: "SKIP strat" },
        ],
      },
    ],
    fccFocusPoints: ["Foco 1"],
    flashcardSeeds: [
      {
        question: "Pergunta 1",
        answer: "Resposta 1",
        type: "QUESTION_ANSWER",
        sourceMaterialId: "strat-1",
        sourcePageStart: 5,
        sourcePageEnd: 6,
        generationReason: "Reason 1",
      },
    ],
    aiAuditMetadata: {
      provider: "gemini",
      modelUsed: "gemini-pro",
      promptVersion: "1.0",
      generatedAt: "2026-07-12T00:00:00Z",
      generationRunId: "run-999",
      confidence: 0.9,
      warnings: [],
      blockingWarnings: [],
      batchConfig: { maxInputTokensPerBatch: 12000, maxCharactersPerBatch: 50000, maxPagesPerBatch: 12 },
      analyzedScope: {
        cfcMaterialId: "cfc-1",
        cfcPageRanges: [{ pageStart: 1, pageEnd: 3 }],
        deepeningMaterials: [{ materialId: "strat-1", pageRanges: [{ pageStart: 1, pageEnd: 20 }] }],
      },
      sourceFingerprintCfc: "hash-cfc",
      sourceFingerprintsDeepening: [{ materialId: "strat-1", fingerprint: "hash-strat" }],
      justification: { anchorChoice: "A", deepeningChoice: "B" },
    },
  };

  const defaultInput = {
    userId: "user-123",
    subjectId: "sub-456",
    output: mockOutput,
    availableMinutes: 90,
  };

  function makeMockPrisma(existingBlock: { id: string; userId: string } | null = null): jest.Mocked<PrismaLike> {
    const studyBlockFindUnique = jest.fn().mockResolvedValue(existingBlock);
    const studyBlockCreate = jest.fn().mockResolvedValue({ id: "new-block-id" });
    const studyBlockSourceCreate = jest.fn().mockResolvedValue({ id: "source-id" });
    const studyBlockSourceSegmentCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    const flashcardCreateMany = jest.fn().mockResolvedValue({ count: 1 });

    const txMock: any = {
      studyBlock: {
        findUnique: studyBlockFindUnique,
        create: studyBlockCreate,
      },
      studyBlockSource: {
        create: studyBlockSourceCreate,
      },
      studyBlockSourceSegment: {
        createMany: studyBlockSourceSegmentCreateMany,
      },
      flashcard: {
        createMany: flashcardCreateMany,
      },
    };

    const $transaction = jest.fn().mockImplementation((fn: any) => fn(txMock));

    return {
      studyBlock: {
        findUnique: studyBlockFindUnique,
        create: studyBlockCreate,
      },
      studyBlockSource: {
        create: studyBlockSourceCreate,
      },
      studyBlockSourceSegment: {
        createMany: studyBlockSourceSegmentCreateMany,
      },
      flashcard: {
        createMany: flashcardCreateMany,
      },
      $transaction,
    } as any;
  }

  test("cria bloco híbrido transacionalmente com sucesso", async () => {
    const prisma = makeMockPrisma();
    const result = await createHybridBlock(prisma, defaultInput);

    expect(result.studyBlockId).toBe("new-block-id");
    expect(result.estimatedStudyMinutes).toBeGreaterThan(0);

    // Deve chamar a transação
    expect(prisma.$transaction).toHaveBeenCalled();

    // Deve buscar por idempotência
    expect(prisma.studyBlock.findUnique).toHaveBeenCalledWith({
      where: { generationRunId: "run-999" },
    });

    // Deve gravar StudyBlock com os envelopes legados
    expect(prisma.studyBlock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-123",
          subjectId: "sub-456",
          materialId: "strat-1", // deepening canônico
          pageStart: 5, // menor READ
          pageEnd: 10,  // maior READ
          methodology: "HYBRID_8020",
          generationRunId: "run-999",
        }),
      })
    );

    // Deve criar duas fontes (CFC + Estratégia)
    expect(prisma.studyBlockSource.create).toHaveBeenCalledTimes(2);

    // Deve criar flashcards como PENDING_APPROVAL
    expect(prisma.flashcard.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "user-123",
          subjectId: "sub-456",
          question: "Pergunta 1",
          status: "PENDING_APPROVAL",
        }),
      ],
    });
  });

  test("retorna bloco existente em caso de idempotência legítima (mesmo usuário)", async () => {
    const existing = { id: "existing-block-id", userId: "user-123" };
    const prisma = makeMockPrisma(existing);

    const result = await createHybridBlock(prisma, defaultInput);

    expect(result.studyBlockId).toBe("existing-block-id");
    // Não deve chamar a transação (detectado fora)
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.studyBlock.create).not.toHaveBeenCalled();
  });

  test("rejeita confirmação se generationRunId colidir com usuário diferente (segurança)", async () => {
    const existing = { id: "existing-block-id", userId: "user-different" };
    const prisma = makeMockPrisma(existing);

    await expect(createHybridBlock(prisma, defaultInput)).rejects.toThrow(/[Cc]onflito/);
  });

  test("rejeita criação se houver blockingWarnings", async () => {
    const prisma = makeMockPrisma();
    const inputWithBlocking = {
      ...defaultInput,
      output: {
        ...mockOutput,
        blockingWarnings: ["Erro grave de formatação"],
      },
    };

    await expect(createHybridBlock(prisma, inputWithBlocking)).rejects.toThrow("blockingWarnings");
  });
});
