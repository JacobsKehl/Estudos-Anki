/**
 * Testes unitários para as rotas de API preview e confirm (/api/hybrid-blocks/...)
 *
 * Executar com: npx jest src/__tests__/api/hybrid-endpoints.test.ts
 */

import { POST as previewPOST } from "@/app/api/hybrid-blocks/preview/route";
import { POST as confirmPOST } from "@/app/api/hybrid-blocks/confirm/route";
import { prisma } from "@/lib/prisma";
import { registerHybridProvider, clearHybridProvider } from "@/lib/ai/providers/hybrid-registry";
import { generatePreviewToken } from "@/lib/security/hybrid-preview-token";
import { NextRequest } from "next/server";
import { canonicalHash } from "@/lib/security/canonical-json";

// Mock do Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    studySubject: {
      findFirst: jest.fn(),
    },
    studyMaterial: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    extractedContent: {
      findMany: jest.fn(),
    },
    studyBlock: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    studyBlockSource: {
      create: jest.fn(),
      count: jest.fn(),
    },
    studyBlockSourceSegment: {
      createMany: jest.fn(),
    },
    flashcard: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((fn) => {
      const txMock = {
        studyBlock: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "new-block-id" }) },
        studyBlockSource: { create: jest.fn().mockResolvedValue({ id: "source-id" }) },
        studyBlockSourceSegment: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
        flashcard: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      return fn(txMock);
    }),
  },
}));

jest.mock("@/lib/auth-mock", () => ({
  getMockUserId: jest.fn().mockResolvedValue("user-123"),
}));

const MOCK_SECRET = "signing-secret-key-at-least-32-chars-long";

describe("API Hybrid Endpoints — Preview & Confirm", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      ENABLE_HYBRID_8020: "true",
      HYBRID_PREVIEW_SIGNING_SECRET: MOCK_SECRET,
    };
    jest.clearAllMocks();
    clearHybridProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearHybridProvider();
  });

  // ── Rota PREVIEW ───────────────────────────────────────────────────────────

  describe("POST /api/hybrid-blocks/preview", () => {
    test("retorna 503 (HYBRID_FEATURE_DISABLED) se a flag estiver inativa", async () => {
      process.env.ENABLE_HYBRID_8020 = "false";
      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", { method: "POST" });
      const res = await previewPOST(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.code).toBe("HYBRID_FEATURE_DISABLED");
    });

    test("retorna 503 (HYBRID_ENGINE_NOT_CONFIGURED) se não houver provider registrado", async () => {
      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          generationRunId: "run-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1"],
          targetTheme: "Tema",
        }),
      });

      const res = await previewPOST(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.code).toBe("HYBRID_ENGINE_NOT_CONFIGURED");
    });

    test("executa com sucesso quando a flag está ativa e provider está registrado", async () => {
      // Mock do provider híbrido
      const mockProvider = {
        getMetadata: jest.fn().mockReturnValue({
          provider: "gemini-mock",
          model: "custom-model-2.5",
          promptVersion: "v1.0.0-mock",
        }),
        mapPages: jest.fn().mockResolvedValue([{ pageNumber: 1, topics: ["Tópico 1"], summary: "S" }]),
        retrieveCandidates: jest.fn().mockResolvedValue([{ materialId: "strat-1", pageNumber: 10 }]),
        deepAnalysis: jest.fn().mockResolvedValue({
          sources: [
            {
              materialId: "cfc-1",
              sourceRole: "ANCHOR_8020",
              isCanonical: false,
              segments: [{ disposition: "READ", pageStart: 1, pageEnd: 2 }],
            },
            {
              materialId: "strat-1",
              sourceRole: "DEEPENING",
              isCanonical: true,
              segments: [{ disposition: "READ", pageStart: 10, pageEnd: 15 }],
            },
          ],
          fccFocusPoints: ["FCC 1"],
          flashcardSeeds: [],
          confidence: 0.9,
          justification: { anchorChoice: "A", deepeningChoice: "B" },
        }),
      };
      registerHybridProvider(mockProvider as any);

      // Mocks Prisma
      (prisma.studySubject.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1", name: "Trabalho" });
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue({ id: "cfc-1", provider: "CFC", totalPages: 5, fileName: "cfc.pdf" });
      (prisma.studyMaterial.findMany as jest.Mock).mockResolvedValue([{ id: "strat-1", provider: "ESTRATEGIA", totalPages: 50, fileName: "strat.pdf" }]);
      (prisma.extractedContent.findMany as jest.Mock)
        .mockResolvedValueOnce([{ pageNumber: 1, text: "Conteúdo CFC" }]) // Primeira chamada para CFC
        .mockResolvedValueOnce([{ materialId: "strat-1", pageNumber: 10, text: "Conteúdo Strat" }]); // Segunda chamada para Estratégia

      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          generationRunId: "run-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1"],
          targetTheme: "Rescisão",
          availableMinutes: 90,
        }),
      });

      const res = await previewPOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.previewToken).toBeTruthy();
      expect(data.preview.title).toBe("Rescisão (80/20)");
    });

    test("retorna 422 para material com provider incorreto", async () => {
      // Registrar provider para passar da primeira checagem
      registerHybridProvider({
        getMetadata: () => ({
          provider: "gemini-mock",
          model: "custom-model-2.5",
          promptVersion: "v1.0.0-mock",
        })
      } as any);

      (prisma.studySubject.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1" });
      // CFC cadastrado como ESTRATEGIA (incorreto)
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue({ id: "cfc-1", provider: "ESTRATEGIA" });

      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          generationRunId: "run-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1"],
          targetTheme: "Rescisão",
        }),
      });

      const res = await previewPOST(req);
      const data = await res.json();

      expect(res.status).toBe(422);
      expect(data.code).toBe("INVALID_CFC_PROVIDER");
    });
  });

  // ── Rota CONFIRM ───────────────────────────────────────────────────────────

  describe("POST /api/hybrid-blocks/confirm", () => {
    test("retorna 401 se o previewToken estiver modificado ou for inválido", async () => {
      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({
          preview: { title: "Modificado" },
          previewToken: "invalid-token",
          subjectId: "sub-1",
        }),
      });

      const res = await confirmPOST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.code).toBe("INVALID_PREVIEW_TOKEN");
    });

    test("retorna 422 se o hash do preview enviado não bater com o previewToken (prevenção de fraude)", async () => {
      const preview = {
        generationRunId: "run-1",
        subject: "Direito",
        title: "Atos",
        methodology: "HYBRID_8020",
        confidence: 0.9,
        warnings: [],
        blockingWarnings: [],
        sources: [
          { materialId: "cfc-1", sourceRole: "ANCHOR_8020", isCanonical: false, segments: [{ disposition: "READ", pageStart: 1, pageEnd: 2 }] },
          { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [{ disposition: "READ", pageStart: 5, pageEnd: 10 }] },
        ],
        fccFocusPoints: [],
        flashcardSeeds: [],
        aiAuditMetadata: {
          analyzedScope: { cfcPageRanges: [], deepeningMaterials: [] },
          sourceFingerprintsDeepening: [],
        },
      };

      // Gera o token para o preview legítimo
      const previewToken = generatePreviewToken({
        userId: "user-123",
        subjectId: "sub-1",
        generationRunId: "run-1",
        preview,
      });

      // Modifica o preview antes de enviar (fraude no cliente)
      const tamperedPreview = { ...preview, title: "Atos Modificados por Hacker" };

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({
          preview: tamperedPreview,
          previewToken,
          subjectId: "sub-1",
        }),
      });

      (prisma.studySubject.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1" });

      const res = await confirmPOST(req);
      const data = await res.json();

      expect(res.status).toBe(422);
      expect(data.code).toBe("PREVIEW_HASH_MISMATCH");
    });

    test("confirma com sucesso se os fingerprints baterem", async () => {
      const preview = {
        generationRunId: "run-1",
        subject: "Direito",
        title: "Atos",
        methodology: "HYBRID_8020",
        confidence: 0.9,
        warnings: [],
        blockingWarnings: [],
        sources: [
          { materialId: "cfc-1", sourceRole: "ANCHOR_8020", isCanonical: false, segments: [{ disposition: "READ", pageStart: 1, pageEnd: 1 }] },
          { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [{ disposition: "READ", pageStart: 10, pageEnd: 10 }] },
        ],
        fccFocusPoints: [],
        flashcardSeeds: [],
        aiAuditMetadata: {
          provider: "gemini-mock",
          modelUsed: "custom-model-2.5",
          promptVersion: "v1.0.0-mock",
          generatedAt: new Date().toISOString(),
          generationRunId: "run-1",
          confidence: 0.9,
          warnings: [],
          blockingWarnings: [],
          analyzedScope: {
            cfcMaterialId: "cfc-1",
            cfcPageNumbers: [1],
            deepeningMaterials: [
              { materialId: "strat-1", pageNumbers: [10] }
            ],
          },
          sourceFingerprintCfc: canonicalHash([{ materialId: "cfc-1", pageNumber: 1, text: "Conteúdo CFC" }]),
          sourceFingerprintsDeepening: [
            { materialId: "strat-1", fingerprint: canonicalHash([{ materialId: "strat-1", pageNumber: 10, text: "Conteúdo Strat" }]) }
          ],
        },
      };

      const previewToken = generatePreviewToken({
        userId: "user-123",
        subjectId: "sub-1",
        generationRunId: "run-1",
        preview,
      });

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({
          preview,
          previewToken,
          subjectId: "sub-1",
        }),
      });

      (prisma.studySubject.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1" });
      (prisma.studyMaterial.findMany as jest.Mock).mockResolvedValue([
        { id: "cfc-1", provider: "CFC", totalPages: 5 },
        { id: "strat-1", provider: "ESTRATEGIA", totalPages: 50 }
      ]);
      (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
        { materialId: "cfc-1", pageNumber: 1, text: "Conteúdo CFC" },
        { materialId: "strat-1", pageNumber: 10, text: "Conteúdo Strat" }
      ]);

      const res = await confirmPOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.studyBlockId).toBeTruthy();
    });

    test("rejeita confirmação se o conteúdo de uma página for modificado (SOURCE_FINGERPRINT_MISMATCH)", async () => {
      const preview = {
        generationRunId: "run-1",
        subject: "Direito",
        title: "Atos",
        methodology: "HYBRID_8020",
        confidence: 0.9,
        warnings: [],
        blockingWarnings: [],
        sources: [
          { materialId: "cfc-1", sourceRole: "ANCHOR_8020", isCanonical: false, segments: [{ disposition: "READ", pageStart: 1, pageEnd: 1 }] },
          { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [{ disposition: "READ", pageStart: 10, pageEnd: 10 }] },
        ],
        fccFocusPoints: [],
        flashcardSeeds: [],
        aiAuditMetadata: {
          provider: "gemini-mock",
          modelUsed: "custom-model-2.5",
          promptVersion: "v1.0.0-mock",
          generatedAt: new Date().toISOString(),
          generationRunId: "run-1",
          confidence: 0.9,
          warnings: [],
          blockingWarnings: [],
          analyzedScope: {
            cfcMaterialId: "cfc-1",
            cfcPageNumbers: [1],
            deepeningMaterials: [
              { materialId: "strat-1", pageNumbers: [10] }
            ],
          },
          sourceFingerprintCfc: canonicalHash([{ materialId: "cfc-1", pageNumber: 1, text: "Conteúdo CFC" }]),
          sourceFingerprintsDeepening: [
            { materialId: "strat-1", fingerprint: canonicalHash([{ materialId: "strat-1", pageNumber: 10, text: "Conteúdo Strat" }]) }
          ],
        },
      };

      const previewToken = generatePreviewToken({
        userId: "user-123",
        subjectId: "sub-1",
        generationRunId: "run-1",
        preview,
      });

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({
          preview,
          previewToken,
          subjectId: "sub-1",
        }),
      });

      (prisma.studySubject.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1" });
      (prisma.studyMaterial.findMany as jest.Mock).mockResolvedValue([
        { id: "cfc-1", provider: "CFC", totalPages: 5 },
        { id: "strat-1", provider: "ESTRATEGIA", totalPages: 50 }
      ]);
      // Conteúdo Strat modificado de "Conteúdo Strat" para "Outro Conteúdo"
      (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
        { materialId: "cfc-1", pageNumber: 1, text: "Conteúdo CFC" },
        { materialId: "strat-1", pageNumber: 10, text: "Outro Conteúdo" }
      ]);

      const res = await confirmPOST(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.code).toBe("SOURCE_FINGERPRINT_MISMATCH");
    });

    test("rejeita confirmação se uma das páginas analisadas for removida", async () => {
      const preview = {
        generationRunId: "run-1",
        subject: "Direito",
        title: "Atos",
        methodology: "HYBRID_8020",
        confidence: 0.9,
        warnings: [],
        blockingWarnings: [],
        sources: [
          { materialId: "cfc-1", sourceRole: "ANCHOR_8020", isCanonical: false, segments: [{ disposition: "READ", pageStart: 1, pageEnd: 1 }] },
          { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [{ disposition: "READ", pageStart: 10, pageEnd: 10 }] },
        ],
        fccFocusPoints: [],
        flashcardSeeds: [],
        aiAuditMetadata: {
          provider: "gemini-mock",
          modelUsed: "custom-model-2.5",
          promptVersion: "v1.0.0-mock",
          generatedAt: new Date().toISOString(),
          generationRunId: "run-1",
          confidence: 0.9,
          warnings: [],
          blockingWarnings: [],
          analyzedScope: {
            cfcMaterialId: "cfc-1",
            cfcPageNumbers: [1],
            deepeningMaterials: [
              { materialId: "strat-1", pageNumbers: [10] }
            ],
          },
          sourceFingerprintCfc: canonicalHash([{ materialId: "cfc-1", pageNumber: 1, text: "Conteúdo CFC" }]),
          sourceFingerprintsDeepening: [
            { materialId: "strat-1", fingerprint: canonicalHash([{ materialId: "strat-1", pageNumber: 10, text: "Conteúdo Strat" }]) }
          ],
        },
      };

      const previewToken = generatePreviewToken({
        userId: "user-123",
        subjectId: "sub-1",
        generationRunId: "run-1",
        preview,
      });

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({
          preview,
          previewToken,
          subjectId: "sub-1",
        }),
      });

      (prisma.studySubject.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1" });
      (prisma.studyMaterial.findMany as jest.Mock).mockResolvedValue([
        { id: "cfc-1", provider: "CFC", totalPages: 5 },
        { id: "strat-1", provider: "ESTRATEGIA", totalPages: 50 }
      ]);
      // Retorna apenas a página do CFC (página do Estratégia removida do banco)
      (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
        { materialId: "cfc-1", pageNumber: 1, text: "Conteúdo CFC" }
      ]);

      const res = await confirmPOST(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.code).toBe("SOURCE_FINGERPRINT_MISMATCH");
    });
  });

  describe("Filtro composto e Validação de Candidatas", () => {
    let mockProvider: any;

    beforeEach(() => {
      (prisma.studySubject.findFirst as jest.Mock).mockReset();
      (prisma.studyMaterial.findFirst as jest.Mock).mockReset();
      (prisma.studyMaterial.findMany as jest.Mock).mockReset();
      (prisma.extractedContent.findMany as jest.Mock).mockReset();

      mockProvider = {
        getMetadata: jest.fn().mockReturnValue({
          provider: "gemini-mock",
          model: "custom-model-2.5",
          promptVersion: "v1.0.0-mock",
        }),
        mapPages: jest.fn().mockResolvedValue([{ pageNumber: 1, topics: ["Tema"], summary: "S" }]),
        retrieveCandidates: jest.fn(),
        deepAnalysis: jest.fn().mockResolvedValue({
          sources: [
            { materialId: "cfc-1", sourceRole: "ANCHOR_8020", isCanonical: false, segments: [{ disposition: "READ", pageStart: 1, pageEnd: 1 }] },
            { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [{ disposition: "READ", pageStart: 10, pageEnd: 10 }] }
          ],
          fccFocusPoints: [],
          flashcardSeeds: [],
          confidence: 0.95,
          justification: { anchorChoice: "A", deepeningChoice: "B" }
        })
      };
      registerHybridProvider(mockProvider);

      (prisma.studySubject.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1", name: "Direito" });
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue({ id: "cfc-1", provider: "CFC", totalPages: 5 });

      (prisma.studyMaterial.findMany as jest.Mock).mockImplementation((args: any) => {
        const ids = args?.where?.id?.in ?? [];
        const allMats = [
          { id: "cfc-1", provider: "CFC", totalPages: 5, fileName: "cfc.pdf" },
          { id: "strat-1", provider: "ESTRATEGIA", totalPages: 20, fileName: "strat1.pdf" },
          { id: "strat-2", provider: "ESTRATEGIA", totalPages: 20, fileName: "strat2.pdf" }
        ];
        return Promise.resolve(allMats.filter((m) => ids.includes(m.id)));
      });

      (prisma.extractedContent.findMany as jest.Mock).mockImplementation((args: any) => {
        const matId = args?.where?.materialId;
        if (matId === "cfc-1") {
          return Promise.resolve([{ pageNumber: 1, text: "CFC P1" }]);
        }
        return Promise.resolve([
          { materialId: "strat-1", pageNumber: 10, text: "Texto Strat-1 P10" },
          { materialId: "strat-2", pageNumber: 5, text: "Strat2 P5" },
          { materialId: "strat-2", pageNumber: 10, text: "Texto Strat-2 P10" },
          { materialId: "strat-2", pageNumber: 12, text: "Texto Strat-2 P12" },
          { materialId: "strat-2", pageNumber: 15, text: "Strat2 P15" }
        ]);
      });
    });

    test("1. dois materiais contendo a página 10 e apenas um selecionado", async () => {
      mockProvider.retrieveCandidates.mockResolvedValue([{ materialId: "strat-1", pageNumber: 10 }]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          generationRunId: "run-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1", "strat-2"],
          targetTheme: "Contratos",
        }),
      });

      const res = await previewPOST(req);
      expect(res.status).toBe(200);

      expect(mockProvider.deepAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        estrategiaPages: [{ materialId: "strat-1", pageNumber: 10, text: "Texto Strat-1 P10" }]
      }));
    });

    test("2. candidatos válidos de dois materiais diferentes", async () => {
      mockProvider.retrieveCandidates.mockResolvedValue([
        { materialId: "strat-1", pageNumber: 10 },
        { materialId: "strat-2", pageNumber: 12 }
      ]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          generationRunId: "run-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1", "strat-2"],
          targetTheme: "Contratos",
        }),
      });

      const res = await previewPOST(req);
      expect(res.status).toBe(200);
      expect(mockProvider.deepAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        estrategiaPages: [
          { materialId: "strat-1", pageNumber: 10, text: "Texto Strat-1 P10" },
          { materialId: "strat-2", pageNumber: 12, text: "Texto Strat-2 P12" }
        ]
      }));
    });

    test("3. materialId desconhecido", async () => {
      mockProvider.retrieveCandidates.mockResolvedValue([{ materialId: "unknown-mat", pageNumber: 10 }]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          generationRunId: "run-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1"],
          targetTheme: "Contratos",
        }),
      });

      const res = await previewPOST(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.code).toBe("INVALID_CANDIDATE_REFERENCES");
      expect(mockProvider.deepAnalysis).not.toHaveBeenCalled();
    });

    test("4. página inexistente no banco", async () => {
      mockProvider.retrieveCandidates.mockResolvedValue([{ materialId: "strat-1", pageNumber: 99 }]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          generationRunId: "run-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1"],
          targetTheme: "Contratos",
        }),
      });

      const res = await previewPOST(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.code).toBe("INVALID_CANDIDATE_REFERENCES");
      expect(mockProvider.deepAnalysis).not.toHaveBeenCalled();
    });

    test("5. pageNumber zero, negativo ou não inteiro", async () => {
      const invalidPages = [0, -5, 10.5];
      for (const pageVal of invalidPages) {
        mockProvider.retrieveCandidates.mockResolvedValue([{ materialId: "strat-1", pageNumber: pageVal }]);

        const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
          method: "POST",
          body: JSON.stringify({
            subjectId: "sub-1",
            cfcMaterialId: "cfc-1",
            estrategiaMaterialIds: ["strat-1"],
            generationRunId: "run-1",
            targetTheme: "Contratos",
          }),
        });

        const res = await previewPOST(req);
        expect(res.status).toBe(422);
        const data = await res.json();
        expect(data.code).toBe("INVALID_CANDIDATE_REFERENCES");
      }
    });

    test("6. candidatos duplicados normalizados", async () => {
      mockProvider.retrieveCandidates.mockResolvedValue([
        { materialId: "strat-1", pageNumber: 10 },
        { materialId: "strat-1", pageNumber: 10 }
      ]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          generationRunId: "run-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1"],
          targetTheme: "Contratos",
        }),
      });

      const res = await previewPOST(req);
      expect(res.status).toBe(200);
      expect(mockProvider.deepAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        estrategiaPages: [{ materialId: "strat-1", pageNumber: 10, text: "Texto Strat-1 P10" }]
      }));
    });

    test("7 e 8. ordem diferente retornada e resultado final ordenado deterministicamente", async () => {
      mockProvider.retrieveCandidates.mockResolvedValue([
        { materialId: "strat-2", pageNumber: 15 },
        { materialId: "strat-1", pageNumber: 10 },
        { materialId: "strat-2", pageNumber: 5 }
      ]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          generationRunId: "run-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1", "strat-2"],
          targetTheme: "Contratos",
        }),
      });

      const res = await previewPOST(req);
      expect(res.status).toBe(200);

      expect(mockProvider.deepAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        estrategiaPages: [
          { materialId: "strat-1", pageNumber: 10, text: "Texto Strat-1 P10" },
          { materialId: "strat-2", pageNumber: 5, text: "Strat2 P5" },
          { materialId: "strat-2", pageNumber: 15, text: "Strat2 P15" }
        ]
      }));
    });

    test("9 e 10. lista sem candidatos ou candidatos presentes mas nenhum válido", async () => {
      mockProvider.retrieveCandidates.mockResolvedValue([]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          generationRunId: "run-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1"],
          targetTheme: "Contratos",
        }),
      });

      const res = await previewPOST(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.code).toBe("NO_CANDIDATE_PAGES_FOUND");
    });
  });

  describe("Matriz Completa de Fingerprints no Confirm", () => {
    let previewBase: any;
    let tokenBase: string;

    beforeEach(() => {
      (prisma.studySubject.findFirst as jest.Mock).mockReset();
      (prisma.studyMaterial.findMany as jest.Mock).mockReset();
      (prisma.extractedContent.findMany as jest.Mock).mockReset();

      previewBase = {
        generationRunId: "run-1",
        subject: "Direito",
        title: "Atos",
        methodology: "HYBRID_8020",
        confidence: 0.9,
        warnings: [],
        blockingWarnings: [],
        sources: [
          { materialId: "cfc-1", sourceRole: "ANCHOR_8020", isCanonical: false, segments: [{ disposition: "READ", pageStart: 1, pageEnd: 1 }] },
          { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [{ disposition: "READ", pageStart: 10, pageEnd: 10 }] },
        ],
        fccFocusPoints: [],
        flashcardSeeds: [],
        aiAuditMetadata: {
          provider: "gemini-mock",
          modelUsed: "custom-model-2.5",
          promptVersion: "v1.0.0-mock",
          generatedAt: new Date().toISOString(),
          generationRunId: "run-1",
          confidence: 0.9,
          warnings: [],
          blockingWarnings: [],
          analyzedScope: {
            cfcMaterialId: "cfc-1",
            cfcPageNumbers: [1],
            deepeningMaterials: [
              { materialId: "strat-1", pageNumbers: [10] }
            ],
          },
          sourceFingerprintCfc: canonicalHash([{ materialId: "cfc-1", pageNumber: 1, text: "Texto CFC" }]),
          sourceFingerprintsDeepening: [
            { materialId: "strat-1", fingerprint: canonicalHash([{ materialId: "strat-1", pageNumber: 10, text: "Texto Strat" }]) }
          ],
        },
      };

      tokenBase = generatePreviewToken({
        userId: "user-123",
        subjectId: "sub-1",
        generationRunId: "run-1",
        preview: previewBase,
      });

      (prisma.studySubject.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1" });

      (prisma.studyMaterial.findMany as jest.Mock).mockImplementation((args: any) => {
        const ids = args?.where?.id?.in ?? [];
        const allMats = [
          { id: "cfc-1", provider: "CFC", totalPages: 5 },
          { id: "strat-1", provider: "ESTRATEGIA", totalPages: 50 }
        ];
        return Promise.resolve(allMats.filter((m) => ids.includes(m.id)));
      });

      (prisma.extractedContent.findMany as jest.Mock).mockImplementation(() => {
        return Promise.resolve([
          { materialId: "cfc-1", pageNumber: 1, text: "Texto CFC" },
          { materialId: "strat-1", pageNumber: 10, text: "Texto Strat" }
        ]);
      });
    });

    test("1. conteúdo inalterado confirma", async () => {
      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({ preview: previewBase, previewToken: tokenBase, subjectId: "sub-1" }),
      });

      const res = await confirmPOST(req);
      expect(res.status).toBe(200);
    });

    test("2. texto do CFC alterado rejeita", async () => {
      (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
        { materialId: "cfc-1", pageNumber: 1, text: "Texto CFC Modificado" },
        { materialId: "strat-1", pageNumber: 10, text: "Texto Strat" }
      ]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({ preview: previewBase, previewToken: tokenBase, subjectId: "sub-1" }),
      });

      const res = await confirmPOST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe("SOURCE_FINGERPRINT_MISMATCH");
    });

    test("3. texto do Estratégia alterado rejeita", async () => {
      (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
        { materialId: "cfc-1", pageNumber: 1, text: "Texto CFC" },
        { materialId: "strat-1", pageNumber: 10, text: "Texto Strat Alterado" }
      ]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({ preview: previewBase, previewToken: tokenBase, subjectId: "sub-1" }),
      });

      const res = await confirmPOST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe("SOURCE_FINGERPRINT_MISMATCH");
      expect(data.divergentMaterialId).toBe("strat-1");
    });

    test("4. página analisada removida rejeita", async () => {
      (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
        { materialId: "cfc-1", pageNumber: 1, text: "Texto CFC" }
      ]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({ preview: previewBase, previewToken: tokenBase, subjectId: "sub-1" }),
      });

      const res = await confirmPOST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe("SOURCE_FINGERPRINT_MISMATCH");
    });

    test("5. página nova fora do escopo não muda o fingerprint", async () => {
      (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
        { materialId: "cfc-1", pageNumber: 1, text: "Texto CFC" },
        { materialId: "strat-1", pageNumber: 10, text: "Texto Strat" },
        { materialId: "strat-1", pageNumber: 11, text: "Nova Página Fora de Escopo" }
      ]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({ preview: previewBase, previewToken: tokenBase, subjectId: "sub-1" }),
      });

      const res = await confirmPOST(req);
      expect(res.status).toBe(200);
    });

    test("6. retorno do banco em ordem diferente mantém o mesmo hash (sorting invariance)", async () => {
      previewBase.aiAuditMetadata.analyzedScope.cfcPageNumbers = [1, 2];
      previewBase.aiAuditMetadata.sourceFingerprintCfc = canonicalHash([
        { materialId: "cfc-1", pageNumber: 1, text: "C1" },
        { materialId: "cfc-1", pageNumber: 2, text: "C2" }
      ]);

      const tokenVal = generatePreviewToken({
        userId: "user-123",
        subjectId: "sub-1",
        generationRunId: "run-1",
        preview: previewBase,
      });

      (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
        { materialId: "strat-1", pageNumber: 10, text: "Texto Strat" },
        { materialId: "cfc-1", pageNumber: 2, text: "C2" },
        { materialId: "cfc-1", pageNumber: 1, text: "C1" }
      ]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({ preview: previewBase, previewToken: tokenVal, subjectId: "sub-1" }),
      });

      const res = await confirmPOST(req);
      expect(res.status).toBe(200);
    });

    test("7. mudança em somente um material identifica o material divergente", async () => {
      (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
        { materialId: "cfc-1", pageNumber: 1, text: "Texto CFC" },
        { materialId: "strat-1", pageNumber: 10, text: "Divergente" }
      ]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({ preview: previewBase, previewToken: tokenBase, subjectId: "sub-1" }),
      });

      const res = await confirmPOST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.divergentMaterialId).toBe("strat-1");
    });

    test("8. fingerprint ausente rejeita", async () => {
      delete previewBase.aiAuditMetadata.sourceFingerprintCfc;
      const badToken = generatePreviewToken({
        userId: "user-123",
        subjectId: "sub-1",
        generationRunId: "run-1",
        preview: previewBase,
      });

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({ preview: previewBase, previewToken: badToken, subjectId: "sub-1" }),
      });

      const res = await confirmPOST(req);
      expect(res.status).toBe(409);
    });

    test("9. analyzedScope ausente rejeita", async () => {
      delete previewBase.aiAuditMetadata.analyzedScope;
      const badToken = generatePreviewToken({
        userId: "user-123",
        subjectId: "sub-1",
        generationRunId: "run-1",
        preview: previewBase,
      });

      const req = new NextRequest("http://localhost/api/hybrid-blocks/confirm", {
        method: "POST",
        body: JSON.stringify({ preview: previewBase, previewToken: badToken, subjectId: "sub-1" }),
      });

      const res = await confirmPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("INVALID_PREVIEW_METADATA");
    });
  });

  describe("Validação de Metadados do Provider", () => {
    test("1. metadados customizados aparecem em preview.aiAuditMetadata", async () => {
      const mockProvider = {
        getMetadata: jest.fn().mockReturnValue({
          provider: "provider-custom",
          model: "model-custom",
          promptVersion: "prompt-custom"
        }),
        mapPages: jest.fn().mockResolvedValue([{ pageNumber: 1, topics: ["T"], summary: "S" }]),
        retrieveCandidates: jest.fn().mockResolvedValue([{ materialId: "strat-1", pageNumber: 10 }]),
        deepAnalysis: jest.fn().mockResolvedValue({
          sources: [
            { materialId: "cfc-1", sourceRole: "ANCHOR_8020", isCanonical: false, segments: [] },
            { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [] }
          ],
          fccFocusPoints: [],
          flashcardSeeds: [],
          confidence: 0.9,
          justification: { anchorChoice: "A", deepeningChoice: "B" }
        })
      };
      registerHybridProvider(mockProvider as any);

      (prisma.studySubject.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1", name: "D" });
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue({ id: "cfc-1", provider: "CFC", totalPages: 5 });
      (prisma.studyMaterial.findMany as jest.Mock).mockResolvedValue([{ id: "strat-1", provider: "ESTRATEGIA", totalPages: 20 }]);
      (prisma.extractedContent.findMany as jest.Mock)
        .mockResolvedValueOnce([{ pageNumber: 1, text: "CFC" }])
        .mockResolvedValueOnce([{ materialId: "strat-1", pageNumber: 10, text: "S" }]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1"],
          generationRunId: "run-1",
          targetTheme: "T",
        }),
      });

      const res = await previewPOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.preview.aiAuditMetadata.provider).toBe("provider-custom");
      expect(data.preview.aiAuditMetadata.modelUsed).toBe("model-custom");
      expect(data.preview.aiAuditMetadata.promptVersion).toBe("prompt-custom");
    });

    test("2. metadata ausente, incompleta ou vazia produz falha controlada", async () => {
      const mockProvider = {
        getMetadata: jest.fn().mockReturnValue({
          provider: "",
          model: "custom",
          promptVersion: "custom"
        }),
        mapPages: jest.fn(),
      };
      registerHybridProvider(mockProvider as any);

      (prisma.studySubject.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1", name: "D" });
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue({ id: "cfc-1", provider: "CFC", totalPages: 5 });
      (prisma.studyMaterial.findMany as jest.Mock).mockResolvedValue([{ id: "strat-1", provider: "ESTRATEGIA", totalPages: 20 }]);

      const req = new NextRequest("http://localhost/api/hybrid-blocks/preview", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "sub-1",
          cfcMaterialId: "cfc-1",
          estrategiaMaterialIds: ["strat-1"],
          generationRunId: "run-1",
          targetTheme: "T",
        }),
      });

      const res = await previewPOST(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.code).toBe("INVALID_PROVIDER_METADATA");
    });
  });
});
