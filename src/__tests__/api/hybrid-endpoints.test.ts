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
        mapPages: jest.fn().mockResolvedValue([{ pageNumber: 1, topics: ["Tópico 1"], summary: "S" }]),
        retrieveCandidates: jest.fn().mockResolvedValue([10]),
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
      registerHybridProvider({} as any);

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
  });
});
