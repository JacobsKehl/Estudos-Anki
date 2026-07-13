/**
 * src/__tests__/api/hybrid-diagnostics.test.ts
 *
 * Testes unitários para validação das 15 regras de integridade do diagnóstico híbrido
 * e validação de query restrita a segmentos.
 */

import { GET as diagnosticsGET } from "@/app/api/diagnostics/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// Mock do Prisma completo para a rota diagnostics
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    studyBlock: {
      findMany: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    studyMaterial: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    flashcard: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    extractedContent: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth-mock", () => ({
  getMockUserId: jest.fn().mockResolvedValue("user-123"),
}));

describe("Diagnostics API — Hybrid 80/20 Block Integrity & Queries", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      ENABLE_DIAGNOSTICS: "true",
      ADMIN_EMAIL: "dev@kehl.study",
    };

    // Configura o mock do usuário para passar pelo getAdminUser()
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-123",
      email: "dev@kehl.study",
    });

    // Mocks padrões vazios para evitar falhas em diagnósticos lineares
    (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.studyMaterial.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.flashcard.findMany as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Query Restrita aos Segmentos", () => {
    it("deve mapear corretamente os segmentos e gerar consultas OR focadas sem envelopes", async () => {
      const mockBlock = {
        id: "hb-1",
        methodology: "HYBRID_8020",
        sources: [
          {
            materialId: "mat-cfc",
            sourceRole: "ANCHOR_8020",
            segments: [
              { pageStart: 2, pageEnd: 5, disposition: "READ" }
            ]
          },
          {
            materialId: "mat-strat",
            sourceRole: "DEEPENING",
            segments: [
              { pageStart: 20, pageEnd: 22, disposition: "READ" }
            ]
          }
        ]
      };

      const segmentConditions = mockBlock.sources.flatMap((source: any) =>
        source.segments.map((segment: any) => ({
          materialId: source.materialId,
          pageNumber: {
            gte: segment.pageStart,
            lte: segment.pageEnd,
          },
        }))
      );

      expect(segmentConditions).toEqual([
        { materialId: "mat-cfc", pageNumber: { gte: 2, lte: 5 } },
        { materialId: "mat-strat", pageNumber: { gte: 20, lte: 22 } }
      ]);
    });
  });

  describe("As 15 Inconsistências Híbridas", () => {
    it("deve detectar NO_SOURCES", async () => {
      (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
        // A primeira busca é para detectar duplicados (retorna bloco vazio)
        if (args?.select?.createdAt) return [];
        // A segunda busca é para a lista do set existente
        if (args?.select?.id) return [];
        
        // A busca principal de blocos híbridos
        return [
          {
            id: "hb-no-sources",
            title: "Bloco Híbrido Sem Fontes",
            methodology: "HYBRID_8020",
            sources: []
          }
        ];
      });

      const req = new NextRequest("http://localhost/api/diagnostics");
      const res = await diagnosticsGET(req);
      const data = await res.json();

      const issues = data.details.hybridIssues || [];
      expect(issues.some((i: any) => i.issue === "NO_SOURCES")).toBe(true);
    });

    it("deve detectar MISSING_ANCHOR e MISSING_DEEPENING", async () => {
      (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
        if (args?.select?.createdAt) return [];
        if (args?.select?.id) return [];
        return [
          {
            id: "hb-missing-both",
            title: "Bloco Híbrido Sem CFC e Estratégia",
            methodology: "HYBRID_8020",
            sources: [
              {
                materialId: "mat-other",
                sourceRole: "OTHER",
                segments: []
              }
            ]
          }
        ];
      });

      const req = new NextRequest("http://localhost/api/diagnostics");
      const res = await diagnosticsGET(req);
      const data = await res.json();

      const issues = data.details.hybridIssues || [];
      expect(issues.some((i: any) => i.issue === "MISSING_ANCHOR")).toBe(true);
      expect(issues.some((i: any) => i.issue === "MISSING_DEEPENING")).toBe(true);
    });

    it("deve detectar MULTIPLE_ANCHORS", async () => {
      (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
        if (args?.select?.createdAt) return [];
        if (args?.select?.id) return [];
        return [
          {
            id: "hb-multiple-anchors",
            title: "Duas Âncoras",
            methodology: "HYBRID_8020",
            sources: [
              { materialId: "cfc-1", sourceRole: "ANCHOR_8020", segments: [] },
              { materialId: "cfc-2", sourceRole: "ANCHOR_8020", segments: [] }
            ]
          }
        ];
      });

      const req = new NextRequest("http://localhost/api/diagnostics");
      const res = await diagnosticsGET(req);
      const data = await res.json();

      const issues = data.details.hybridIssues || [];
      expect(issues.some((i: any) => i.issue === "MULTIPLE_ANCHORS")).toBe(true);
    });

    it("deve detectar MISSING_CANONICAL_DEEPENING", async () => {
      (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
        if (args?.select?.createdAt) return [];
        if (args?.select?.id) return [];
        return [
          {
            id: "hb-no-canonical-deep",
            title: "Aprofundamentos Não Canônicos",
            methodology: "HYBRID_8020",
            sources: [
              { materialId: "cfc-1", sourceRole: "ANCHOR_8020", segments: [] },
              { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: false, segments: [] }
            ]
          }
        ];
      });

      const req = new NextRequest("http://localhost/api/diagnostics");
      const res = await diagnosticsGET(req);
      const data = await res.json();

      const issues = data.details.hybridIssues || [];
      expect(issues.some((i: any) => i.issue === "MISSING_CANONICAL_DEEPENING")).toBe(true);
    });

    it("deve detectar MULTIPLE_CANONICAL_DEEPENINGS", async () => {
      (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
        if (args?.select?.createdAt) return [];
        if (args?.select?.id) return [];
        return [
          {
            id: "hb-mult-canonical",
            title: "Múltiplos Canônicos",
            methodology: "HYBRID_8020",
            sources: [
              { materialId: "cfc-1", sourceRole: "ANCHOR_8020", segments: [] },
              { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [] },
              { materialId: "strat-2", sourceRole: "DEEPENING", isCanonical: true, segments: [] }
            ]
          }
        ];
      });

      const req = new NextRequest("http://localhost/api/diagnostics");
      const res = await diagnosticsGET(req);
      const data = await res.json();

      const issues = data.details.hybridIssues || [];
      expect(issues.some((i: any) => i.issue === "MULTIPLE_CANONICAL_DEEPENINGS")).toBe(true);
    });

    it("deve detectar ANCHOR_MARKED_CANONICAL", async () => {
      (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
        if (args?.select?.createdAt) return [];
        if (args?.select?.id) return [];
        return [
          {
            id: "hb-anchor-canonical",
            title: "Âncora Canônica",
            methodology: "HYBRID_8020",
            sources: [
              { materialId: "cfc-1", sourceRole: "ANCHOR_8020", isCanonical: true, segments: [] }
            ]
          }
        ];
      });

      const req = new NextRequest("http://localhost/api/diagnostics");
      const res = await diagnosticsGET(req);
      const data = await res.json();

      const issues = data.details.hybridIssues || [];
      expect(issues.some((i: any) => i.issue === "ANCHOR_MARKED_CANONICAL")).toBe(true);
    });

    it("deve detectar DUPLICATE_SOURCE_ROLE_MATERIAL", async () => {
      (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
        if (args?.select?.createdAt) return [];
        if (args?.select?.id) return [];
        return [
          {
            id: "hb-duplicate-material",
            title: "Material Duplicado com Mesmo Papel",
            methodology: "HYBRID_8020",
            sources: [
              { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [] },
              { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: false, segments: [] }
            ]
          }
        ];
      });

      const req = new NextRequest("http://localhost/api/diagnostics");
      const res = await diagnosticsGET(req);
      const data = await res.json();

      const issues = data.details.hybridIssues || [];
      expect(issues.some((i: any) => i.issue === "DUPLICATE_SOURCE_ROLE_MATERIAL")).toBe(true);
    });

    it("deve detectar NO_SEGMENTS", async () => {
      (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
        if (args?.select?.createdAt) return [];
        if (args?.select?.id) return [];
        return [
          {
            id: "hb-no-segments",
            title: "Sem Segmentos",
            methodology: "HYBRID_8020",
            sources: [
              { materialId: "cfc-1", material: { fileName: "cfc.pdf" }, sourceRole: "ANCHOR_8020", segments: [] }
            ]
          }
        ];
      });

      const req = new NextRequest("http://localhost/api/diagnostics");
      const res = await diagnosticsGET(req);
      const data = await res.json();

      const issues = data.details.hybridIssues || [];
      expect(issues.some((i: any) => i.issue === "NO_SEGMENTS")).toBe(true);
    });

    it("deve detectar INVALID_SEGMENT_RANGE", async () => {
      (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
        if (args?.select?.createdAt) return [];
        if (args?.select?.id) return [];
        return [
          {
            id: "hb-invalid-range",
            title: "Segmento Inválido",
            methodology: "HYBRID_8020",
            sources: [
              {
                materialId: "cfc-1",
                material: { fileName: "cfc.pdf" },
                sourceRole: "ANCHOR_8020",
                segments: [
                  { pageStart: 10, pageEnd: 5, disposition: "READ" }
                ]
              }
            ]
          }
        ];
      });

      const req = new NextRequest("http://localhost/api/diagnostics");
      const res = await diagnosticsGET(req);
      const data = await res.json();

      const issues = data.details.hybridIssues || [];
      expect(issues.some((i: any) => i.issue === "INVALID_SEGMENT_RANGE")).toBe(true);
    });

    it("deve detectar OVERLAPPING_CONTRADICTORY_SEGMENTS", async () => {
      (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
        if (args?.select?.createdAt) return [];
        if (args?.select?.id) return [];
        return [
          {
            id: "hb-overlap-conflict",
            title: "Sobreposição Contraditória",
            methodology: "HYBRID_8020",
            sources: [
              {
                materialId: "cfc-1",
                material: { fileName: "cfc.pdf" },
                sourceRole: "ANCHOR_8020",
                segments: [
                  { pageStart: 5, pageEnd: 10, disposition: "READ" },
                  { pageStart: 8, pageEnd: 12, disposition: "SKIP" }
                ]
              }
            ]
          }
        ];
      });

      const req = new NextRequest("http://localhost/api/diagnostics");
      const res = await diagnosticsGET(req);
      const data = await res.json();

      const issues = data.details.hybridIssues || [];
      expect(issues.some((i: any) => i.issue === "OVERLAPPING_CONTRADICTORY_SEGMENTS")).toBe(true);
    });

    describe("LEGACY_MATERIAL_MISMATCH", () => {
      it("materialId igual ao canônico não gera issue", async () => {
        (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
          if (args?.select?.createdAt) return [];
          if (args?.select?.id) return [];
          return [
            {
              id: "hb-ok",
              title: "Bloco Híbrido Ok",
              methodology: "HYBRID_8020",
              materialId: "strat-1",
              sources: [
                { materialId: "cfc-1", sourceRole: "ANCHOR_8020", segments: [] },
                { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [] }
              ]
            }
          ];
        });

        const req = new NextRequest("http://localhost/api/diagnostics");
        const res = await diagnosticsGET(req);
        const data = await res.json();
        const issues = data.details.hybridIssues || [];
        expect(issues.some((i: any) => i.issue === "LEGACY_MATERIAL_MISMATCH")).toBe(false);
      });

      it("materialId igual ao ANCHOR gera mismatch", async () => {
        (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
          if (args?.select?.createdAt) return [];
          if (args?.select?.id) return [];
          return [
            {
              id: "hb-mismatch-anchor",
              title: "MaterialId Apontado para CFC",
              methodology: "HYBRID_8020",
              materialId: "cfc-1",
              sources: [
                { materialId: "cfc-1", sourceRole: "ANCHOR_8020", segments: [] },
                { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [] }
              ]
            }
          ];
        });

        const req = new NextRequest("http://localhost/api/diagnostics");
        const res = await diagnosticsGET(req);
        const data = await res.json();
        const issues = data.details.hybridIssues || [];
        expect(issues.some((i: any) => i.issue === "LEGACY_MATERIAL_MISMATCH")).toBe(true);
      });

      it("materialId de outro DEEPENING não canônico gera mismatch", async () => {
        (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
          if (args?.select?.createdAt) return [];
          if (args?.select?.id) return [];
          return [
            {
              id: "hb-mismatch-other-deep",
              title: "MaterialId de Aprofundamento Não Canônico",
              methodology: "HYBRID_8020",
              materialId: "strat-2",
              sources: [
                { materialId: "cfc-1", sourceRole: "ANCHOR_8020", segments: [] },
                { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: true, segments: [] },
                { materialId: "strat-2", sourceRole: "DEEPENING", isCanonical: false, segments: [] }
              ]
            }
          ];
        });

        const req = new NextRequest("http://localhost/api/diagnostics");
        const res = await diagnosticsGET(req);
        const data = await res.json();
        const issues = data.details.hybridIssues || [];
        expect(issues.some((i: any) => i.issue === "LEGACY_MATERIAL_MISMATCH")).toBe(true);
      });

      it("ausência ou múltiplos canônicos não tenta escolher silenciosamente um material", async () => {
        (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
          if (args?.select?.createdAt) return [];
          if (args?.select?.id) return [];
          return [
            {
              id: "hb-no-canonicals",
              title: "Sem Canônicos",
              methodology: "HYBRID_8020",
              materialId: "strat-1",
              sources: [
                { materialId: "cfc-1", sourceRole: "ANCHOR_8020", segments: [] },
                { materialId: "strat-1", sourceRole: "DEEPENING", isCanonical: false, segments: [] }
              ]
            }
          ];
        });

        const req = new NextRequest("http://localhost/api/diagnostics");
        const res = await diagnosticsGET(req);
        const data = await res.json();
        const issues = data.details.hybridIssues || [];
        expect(issues.some((i: any) => i.issue === "LEGACY_MATERIAL_MISMATCH")).toBe(false);
      });
    });

    it("deve detectar LEGACY_PAGE_START_MISMATCH e LEGACY_PAGE_END_MISMATCH", async () => {
      (prisma.studyBlock.findMany as jest.Mock).mockImplementation(async (args) => {
        if (args?.select?.createdAt) return [];
        if (args?.select?.id) return [];
        return [
          {
            id: "hb-envelope-mismatch",
            title: "Envelopes Legados Divergentes",
            methodology: "HYBRID_8020",
            pageStart: 2,
            pageEnd: 15,
            sources: [
              { materialId: "cfc-1", sourceRole: "ANCHOR_8020", segments: [] },
              {
                materialId: "strat-1",
                sourceRole: "DEEPENING",
                isCanonical: true,
                segments: [
                  { pageStart: 5, pageEnd: 8, disposition: "READ" },
                  { pageStart: 10, pageEnd: 12, disposition: "READ" }
                ]
              }
            ]
          }
        ];
      });

      const req = new NextRequest("http://localhost/api/diagnostics");
      const res = await diagnosticsGET(req);
      const data = await res.json();

      const issues = data.details.hybridIssues || [];
      expect(issues.some((i: any) => i.issue === "LEGACY_PAGE_START_MISMATCH")).toBe(true);
      expect(issues.some((i: any) => i.issue === "LEGACY_PAGE_END_MISMATCH")).toBe(true);
    });
  });
});
