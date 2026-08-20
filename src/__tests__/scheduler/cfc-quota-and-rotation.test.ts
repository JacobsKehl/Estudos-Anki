import { getAdaptiveStudyPlan } from "../../lib/recommendations/adaptive-scheduler";

// Mock Prisma client para os testes unitários do agendador adaptativo
jest.mock("../../lib/prisma", () => ({
  prisma: {
    studySubject: {
      findMany: jest.fn().mockResolvedValue([
        { id: "sub-admin", name: "Direito Administrativo", examWeight: 2.0, studyPriority: "PRIMARY", schedulingStatus: "ACTIVE" },
        { id: "sub-trabalho", name: "Direito do Trabalho", examWeight: 1.5, studyPriority: "PRIMARY", schedulingStatus: "ACTIVE" },
        { id: "sub-const", name: "Direito Constitucional", examWeight: 1.5, studyPriority: "PRIMARY", schedulingStatus: "ACTIVE" },
        { id: "sub-proctrab", name: "Direito Processual do Trabalho", examWeight: 1.0, studyPriority: "PRIMARY", schedulingStatus: "ACTIVE" },
        { id: "sub-proccivil", name: "Direito Processual Civil", examWeight: 1.0, studyPriority: "PRIMARY", schedulingStatus: "ACTIVE" },
      ]),
      findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve({
        id: where?.id || "sub-admin",
        name: "Matéria Teste",
        examWeight: 1.5,
        studyPriority: "PRIMARY",
        schedulingStatus: "ACTIVE",
        materials: [{ blocks: [{ id: "b1", theoryStatus: "NOT_STARTED" }] }],
        blocks: [{ id: "b1", theoryStatus: "NOT_STARTED" }]
      })),
    },
    flashcardReview: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    studyBlock: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockImplementation(({ where }) => {
        const subId = where?.subjectId;
        const cfcMat = { originalFileName: "1 - Direito Administrativo_compressed.pdf", fileName: "pdf 1" };

        if (subId === "sub-admin") {
          return Promise.resolve([
            { id: "blk-adm-1", subjectId: "sub-admin", title: "Adm Bloco 1", pageStart: 6, pageEnd: 15, estimatedStudyMinutes: 30, orderIndex: 1, theoryStatus: "NOT_STARTED", sourceV1BlockId: null, possiblyAlreadyStudied: false, material: cfcMat },
            { id: "blk-adm-2", subjectId: "sub-admin", title: "Adm Bloco 2", pageStart: 16, pageEnd: 25, estimatedStudyMinutes: 30, orderIndex: 2, theoryStatus: "NOT_STARTED", sourceV1BlockId: null, possiblyAlreadyStudied: false, material: cfcMat },
          ]);
        }
        if (subId === "sub-trabalho") {
          return Promise.resolve([
            { id: "blk-trab-1", subjectId: "sub-trabalho", title: "Trab Bloco 1", pageStart: 4, pageEnd: 10, estimatedStudyMinutes: 30, orderIndex: 1, theoryStatus: "NOT_STARTED", sourceV1BlockId: null, possiblyAlreadyStudied: false, material: cfcMat },
          ]);
        }
        if (subId === "sub-const") {
          return Promise.resolve([
            { id: "blk-const-1", subjectId: "sub-const", title: "Const Bloco 1", pageStart: 4, pageEnd: 12, estimatedStudyMinutes: 30, orderIndex: 1, theoryStatus: "NOT_STARTED", sourceV1BlockId: null, possiblyAlreadyStudied: false, material: cfcMat },
          ]);
        }
        return Promise.resolve([]);
      }),
    },
    flashcard: {
      count: jest.fn().mockResolvedValue(0),
    },
    studySessionLog: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

describe("CFC Scheduler Quota & Rotation Rules", () => {
  it("Caso 1: Dia com múltiplos candidatos aloca NO MÁXIMO 2 blocos de teoria no total", async () => {
    const tasks = await getAdaptiveStudyPlan("user-1", { maxNewTheoryPerDay: 2, maxBlockReviewsPerDay: 3 });
    const theoryTasks = tasks.filter(t => t.type === "THEORY");

    expect(theoryTasks.length).toBeLessThanOrEqual(2);
    expect(theoryTasks.length).toBe(2);
  });

  it("Caso 2: Os 2 blocos alocados no dia vêm de matérias DIFERENTES (rodízio intercalado)", async () => {
    const tasks = await getAdaptiveStudyPlan("user-1", { maxNewTheoryPerDay: 2, maxBlockReviewsPerDay: 3 });
    const theoryTasks = tasks.filter(t => t.type === "THEORY");

    const subjectIds = theoryTasks.map(t => t.subjectId);
    const uniqueSubjects = new Set(subjectIds);

    expect(uniqueSubjects.size).toBe(2);
    expect(subjectIds[0]).not.toBe(subjectIds[1]);
  });

  it("Caso 3: Cota global maxNewTheoryPerDay = 2 é respeitada estritamente", async () => {
    const tasks = await getAdaptiveStudyPlan("user-1", 2);
    const theoryTasks = tasks.filter(t => t.type === "THEORY");

    expect(theoryTasks.length).toBeLessThanOrEqual(2);
  });
});
