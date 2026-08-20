import { getSubjectMetrics } from "@/lib/services/subject-metrics";
import { DELETE as deleteSubject } from "@/app/api/subjects/[id]/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// Mock das dependências globais do Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    studySubject: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    studyBlock: {
      count: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
    },
    flashcard: {
      count: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
    },
    studyMaterial: {
      count: jest.fn(),
    },
    studyScheduleItem: {
      count: jest.fn(),
    },
    flashcardReview: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

jest.mock("@/lib/auth-mock", () => ({
  getCurrentUserId: jest.fn(),
}));

import { getCurrentUserId } from "@/lib/auth-mock";

describe("Tenant Isolation Behavioral Security Tests", () => {
  const userA_id = "user_A_123";
  const userB_id = "user_B_456";

  const subjectA = {
    id: "subject_const_userA",
    name: "Direito Constitucional",
    userId: userA_id,
    _count: { materials: 1, studyBlocks: 5, flashcards: 10 },
    materials: [{ id: "mat_A_1" }],
    studyBlocks: [
      { theoryStatus: "COMPLETED" },
      { theoryStatus: "COMPLETED" },
      { theoryStatus: "NOT_STARTED" },
      { theoryStatus: "NOT_STARTED" },
      { theoryStatus: "NOT_STARTED" },
    ],
    flashcards: [
      { status: "APPROVED", nextReviewAt: new Date(), easeFactor: 2.5, intervalDays: 1 },
    ],
  };

  const subjectB = {
    id: "subject_const_userB",
    name: "Direito Constitucional",
    userId: userB_id,
    _count: { materials: 2, studyBlocks: 3, flashcards: 6 },
    materials: [{ id: "mat_B_1" }, { id: "mat_B_2" }],
    studyBlocks: [
      { theoryStatus: "COMPLETED" },
      { theoryStatus: "NOT_STARTED" },
      { theoryStatus: "NOT_STARTED" },
    ],
    flashcards: [
      { status: "APPROVED", nextReviewAt: new Date(), easeFactor: 2.5, intervalDays: 3 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Isolamento de Leitura por Tenant", () => {
    it("deve retornar apenas as métricas e blocos do Usuário A para sua matéria", async () => {
      (prisma.studySubject.findFirst as jest.Mock).mockImplementation(({ where }) => {
        if (where.id === subjectA.id && where.userId === userA_id) {
          return Promise.resolve(subjectA);
        }
        return Promise.resolve(null);
      });

      (prisma.flashcardReview.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.studyBlock.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.studyBlock.findFirst as jest.Mock).mockResolvedValue(null);

      const metricsA = await getSubjectMetrics(subjectA.id, userA_id);

      expect(metricsA.totalBlocks).toBe(5);
      expect(metricsA.completedBlocks).toBe(2);
      expect(prisma.studySubject.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: subjectA.id, userId: userA_id }),
        })
      );
    });

    it("deve proibir o Usuário A de ler métricas da matéria do Usuário B (mesmo sabendo o ID)", async () => {
      (prisma.studySubject.findFirst as jest.Mock).mockImplementation(({ where }) => {
        if (where.id === subjectB.id && where.userId === userA_id) {
          return Promise.resolve(null); // Retorna null pois Usuário A não é dono da matéria B
        }
        return Promise.resolve(null);
      });

      await expect(getSubjectMetrics(subjectB.id, userA_id)).rejects.toThrow("Subject not found");
    });
  });

  describe("2. Isolamento de Escrita por Tenant (Tentativa de Exclusão Cruzada)", () => {
    it("deve recusar a exclusão da matéria do Usuário B quando a requisição vem do Usuário A", async () => {
      // Autenticado como Usuário A
      (getCurrentUserId as jest.Mock).mockResolvedValue(userA_id);

      // Tentando acessar/deletar a matéria pertencente ao Usuário B
      (prisma.studySubject.findFirst as jest.Mock).mockImplementation(({ where }) => {
        if (where.id === subjectB.id && where.userId === userA_id) {
          return Promise.resolve(null); // Não encontra matéria do Usuário B sob o escopo do Usuário A
        }
        return Promise.resolve(null);
      });

      const req = new NextRequest(`http://localhost:3000/api/subjects/${subjectB.id}`, {
        method: "DELETE",
      });

      const response = await deleteSubject(req, { params: Promise.resolve({ id: subjectB.id }) });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe("Matéria não encontrada");
      // Garante que o método prisma.studySubject.delete NUNCA foi chamado
      expect(prisma.studySubject.delete).not.toHaveBeenCalled();
    });

    it("deve permitir a exclusão apenas quando o usuário é o verdadeiro proprietário e não há dependências", async () => {
      // Autenticado como Usuário A
      (getCurrentUserId as jest.Mock).mockResolvedValue(userA_id);

      // Valida propriedade da matéria A sob Usuário A
      (prisma.studySubject.findFirst as jest.Mock).mockResolvedValue(subjectA);

      // Simula zero dependências (matéria limpa)
      (prisma.studyMaterial.count as jest.Mock).mockResolvedValue(0);
      (prisma.studyBlock.count as jest.Mock).mockResolvedValue(0);
      (prisma.flashcard.count as jest.Mock).mockResolvedValue(0);
      (prisma.studyScheduleItem.count as jest.Mock).mockResolvedValue(0);
      (prisma.studySubject.delete as jest.Mock).mockResolvedValue(subjectA);

      const req = new NextRequest(`http://localhost:3000/api/subjects/${subjectA.id}`, {
        method: "DELETE",
      });

      const response = await deleteSubject(req, { params: Promise.resolve({ id: subjectA.id }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.message).toBe("Matéria excluída com sucesso");
      expect(prisma.studySubject.delete).toHaveBeenCalledWith({ where: { id: subjectA.id } });
    });
  });
});
