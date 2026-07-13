/**
 * Testes unitários para a rota de API de materiais (/api/materials/[id])
 *
 * Executar com: npx jest src/__tests__/api/materials.test.ts
 */

import { PATCH, DELETE } from "@/app/api/materials/[id]/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// Mock das dependências globais
jest.mock("@/lib/prisma", () => ({
  prisma: {
    studyMaterial: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    studyBlockSource: {
      count: jest.fn(),
    },
    extractedContent: {
      deleteMany: jest.fn(),
    },
    studyBlock: {
      deleteMany: jest.fn(),
    },
    studyScheduleItem: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
  },
}));

jest.mock("@/lib/auth-mock", () => ({
  getMockUserId: jest.fn().mockResolvedValue("user-123"),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        remove: jest.fn().mockResolvedValue({ error: null }),
      }),
    },
  },
}));

describe("API /api/materials/[id] — PATCH & DELETE", () => {
  const mockParams = Promise.resolve({ id: "mat-abc" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Testes do PATCH ────────────────────────────────────────────────────────

  describe("PATCH", () => {
    test("atualiza provider com sucesso para material existente e não vinculado", async () => {
      // Setup
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue({ id: "mat-abc", userId: "user-123", provider: "OTHER" });
      (prisma.studyBlockSource.count as jest.Mock).mockResolvedValue(0);
      (prisma.studyMaterial.update as jest.Mock).mockResolvedValue({ id: "mat-abc", provider: "CFC" });

      const req = new NextRequest("http://localhost/api/materials/mat-abc", {
        method: "PATCH",
        body: JSON.stringify({ provider: "CFC" }),
      });

      const res = await PATCH(req, { params: mockParams });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.provider).toBe("CFC");
      expect(prisma.studyMaterial.update).toHaveBeenCalledWith({
        where: { id: "mat-abc" },
        data: { provider: "CFC" },
        select: expect.any(Object),
      });
    });

    test("retorna 400 para valor de provider inválido", async () => {
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue({ id: "mat-abc", userId: "user-123" });

      const req = new NextRequest("http://localhost/api/materials/mat-abc", {
        method: "PATCH",
        body: JSON.stringify({ provider: "INVALID_PROVIDER" }),
      });

      const res = await PATCH(req, { params: mockParams });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.code).toBe("INVALID_PROVIDER_VALUE");
    });

    test("retorna 409 se o material já estiver vinculado a um bloco híbrido", async () => {
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue({ id: "mat-abc", userId: "user-123" });
      // Vinculado a 2 blocos híbridos
      (prisma.studyBlockSource.count as jest.Mock).mockResolvedValue(2);

      const req = new NextRequest("http://localhost/api/materials/mat-abc", {
        method: "PATCH",
        body: JSON.stringify({ provider: "ESTRATEGIA" }),
      });

      const res = await PATCH(req, { params: mockParams });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.code).toBe("MATERIAL_PROVIDER_LOCKED_BY_HYBRID_BLOCK");
      expect(prisma.studyMaterial.update).not.toHaveBeenCalled();
    });

    test("retorna 404 se o material não for do usuário ou não existir", async () => {
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/materials/mat-abc", {
        method: "PATCH",
        body: JSON.stringify({ provider: "CFC" }),
      });

      const res = await PATCH(req, { params: mockParams });
      expect(res.status).toBe(404);
    });
  });

  // ── Testes do DELETE ───────────────────────────────────────────────────────

  describe("DELETE", () => {
    test("exclui material com sucesso quando não há vínculos híbridos", async () => {
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue({ id: "mat-abc", userId: "user-123", sourcePath: null });
      (prisma.studyBlockSource.count as jest.Mock).mockResolvedValue(0);

      const req = new NextRequest("http://localhost/api/materials/mat-abc", { method: "DELETE" });
      const res = await DELETE(req, { params: mockParams });

      expect(res.status).toBe(200);
      expect(prisma.studyMaterial.delete).toHaveBeenCalledWith({ where: { id: "mat-abc" } });
    });

    test("retorna 409 (MATERIAL_USED_BY_HYBRID_BLOCK) se houver vínculo com bloco híbrido", async () => {
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue({ id: "mat-abc", userId: "user-123" });
      // 1 vínculo híbrido
      (prisma.studyBlockSource.count as jest.Mock).mockResolvedValue(1);

      const req = new NextRequest("http://localhost/api/materials/mat-abc", { method: "DELETE" });
      const res = await DELETE(req, { params: mockParams });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.code).toBe("MATERIAL_USED_BY_HYBRID_BLOCK");
      expect(prisma.studyMaterial.delete).not.toHaveBeenCalled();
    });

    test("trata erro P2003 (foreign key constraint) do Prisma retornando 409", async () => {
      (prisma.studyMaterial.findFirst as jest.Mock).mockResolvedValue({ id: "mat-abc", userId: "user-123" });
      (prisma.studyBlockSource.count as jest.Mock).mockResolvedValue(0); // passa na checagem manual
      // Simula erro concorrente de FK ao executar deleção no banco
      const prismaError = new Error("Foreign key constraint failed");
      (prismaError as any).code = "P2003";
      (prisma.studyMaterial.delete as jest.Mock).mockRejectedValue(prismaError);

      const req = new NextRequest("http://localhost/api/materials/mat-abc", { method: "DELETE" });
      const res = await DELETE(req, { params: mockParams });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.code).toBe("MATERIAL_USED_BY_HYBRID_BLOCK");
    });
  });
});
