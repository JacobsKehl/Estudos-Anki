import { Prisma } from "@prisma/client";
import { getAllSubjectsMetrics, getSubjectMetrics } from "@/lib/services/subject-metrics";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    studySubject: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
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
    flashcardReview: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

describe("StudyBlock Completion & Multi-Tenant Invariant Tests", () => {
  it("deve garantir que o modelo StudyBlock usa theoryStatus como fonte única de verdade", () => {
    // Verificar em nível de tipos do Prisma que 'status' não existe mais em StudyBlock
    const dmmf = Prisma.dmmf.datamodel;
    const studyBlockModel = dmmf.models.find((m) => m.name === "StudyBlock");
    expect(studyBlockModel).toBeDefined();

    const statusField = studyBlockModel?.fields.find((f) => f.name === "status");
    expect(statusField).toBeUndefined(); // Garante que a coluna 'status' foi fisicamente removida

    const theoryStatusField = studyBlockModel?.fields.find((f) => f.name === "theoryStatus");
    expect(theoryStatusField).toBeDefined(); // Garante que 'theoryStatus' é a autoridade
  });

  it("deve garantir a invariante de isolamento de tenant em getAllSubjectsMetrics (soma das matérias == total escopado por userId)", async () => {
    const userIdA = "user_A_123";

    // Simular que o User A possui 2 matérias.
    // Matéria 1: 33 blocos do User A (mesmo que existam blocos do User B no banco)
    // Matéria 2: 12 blocos do User A
    (prisma.studySubject.findMany as jest.Mock).mockResolvedValue([
      { id: "subj_1", name: "Direito Administrativo" },
      { id: "subj_2", name: "Direito Civil" },
    ]);

    // O findFirst deve ser chamado com `where: { id, userId }` e retornar APENAS os blocos do userId A
    (prisma.studySubject.findFirst as jest.Mock).mockImplementation(({ where }) => {
      if (where.id === "subj_1" && where.userId === userIdA) {
        return Promise.resolve({
          id: "subj_1",
          name: "Direito Administrativo",
          userId: userIdA,
          materials: [{ id: "mat_1" }],
          studyBlocks: Array(33).fill({ theoryStatus: "COMPLETED" }),
          flashcards: Array(167).fill({ status: "APPROVED" }),
        });
      }
      if (where.id === "subj_2" && where.userId === userIdA) {
        return Promise.resolve({
          id: "subj_2",
          name: "Direito Civil",
          userId: userIdA,
          materials: [{ id: "mat_2" }],
          studyBlocks: Array(12).fill({ theoryStatus: "NOT_STARTED" }),
          flashcards: Array(27).fill({ status: "APPROVED" }),
        });
      }
      return Promise.resolve(null);
    });

    const metrics = await getAllSubjectsMetrics(userIdA);

    const totalBlocksFromMetrics = metrics.reduce((acc, s) => acc + s.metrics.totalBlocks, 0);
    const totalFlashcardsFromMetrics = metrics.reduce((acc, s) => acc + s.metrics.totalFlashcards, 0);
    const totalMaterialsFromMetrics = metrics.reduce((acc, s) => acc + s.metrics.totalMaterials, 0);

    // Invariantes estritas de tenant:
    expect(metrics[0].metrics.totalBlocks).toBe(33); // Direito Administrativo deve ser 33, NÃO 35!
    expect(metrics[0].metrics.totalFlashcards).toBe(167); // Direito Administrativo deve ser 167, NÃO 173!
    expect(metrics[1].metrics.totalBlocks).toBe(12);

    expect(totalBlocksFromMetrics).toBe(45); // 33 + 12
    expect(totalFlashcardsFromMetrics).toBe(194); // 167 + 27
    expect(totalMaterialsFromMetrics).toBe(2);
  });

  it.todo(
    "deve garantir 0 linhas de anomalia no banco (b.userId <> s.userId em StudyBlock e Flashcard) — atualmente existem 2 blocos e 6 flashcards do [TESTE] Dev na matéria de Direito Administrativo da Gabriela"
  );
});

