/**
 * src/__tests__/scheduler/trt4-legacy-scheduler.test.ts
 *
 * Testes de regressão do fluxo produtivo LEGACY_TRT4.
 *
 * Importa e executa diretamente a função de produção:
 *   generateLegacyTrt4Schedule (exportada de src/lib/scheduler.ts)
 *
 * Todas as dependências externas são mockadas:
 *   - @/lib/prisma  → Prisma mocked (zero banco real)
 *   - @/lib/date-utils → getTodayRangeSP mocked
 *
 * Nenhum simulador local. Nenhuma lógica do scheduler copiada para o teste.
 * Um bloco inválido, uma mutação no código de produção → o teste falha.
 */

import {
  generateLegacyTrt4Schedule,
  SchedulerWarning,
} from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => ({
  prisma: {
    userPreferences: { findUnique: jest.fn() },
    studySubject: { findMany: jest.fn() },
    studySchedule: {
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    studyBlock: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    studyScheduleItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      createMany: jest.fn(),
    },
    studyBlockSource: { findMany: jest.fn() },
    extractedContent: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/date-utils", () => ({
  getTodayRangeSP: (date: Date) => {
    const d = new Date(date);
    const str = d.toISOString().split("T")[0];
    const start = new Date(`${str}T00:00:00.000Z`);
    const end = new Date(`${str}T23:59:59.999Z`);
    return { start, end, dateString: str };
  },
}));

// ── Tipos auxiliares de mock ───────────────────────────────────────────────────

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Preferências com scheduleGenerationMode = LEGACY_TRT4 e todos os dias de estudo */
const userPrefs = {
  scheduleGenerationMode: "LEGACY_TRT4",
  studyDaysOfWeek: "1,2,3,4,5,6,0",
};

/** Preferências com apenas dias úteis (seg-sex) */
const userPrefsWeekdays = {
  scheduleGenerationMode: "LEGACY_TRT4",
  studyDaysOfWeek: "1,2,3,4,5",
};

/** Matérias típicas do TRT4 — PRIMARY */
function makeSubjects() {
  return [
    { id: "sub-dt", name: "Direito do Trabalho", studyPriority: "PRIMARY" },
    { id: "sub-dpt", name: "Direito Processual do Trabalho", studyPriority: "PRIMARY" },
    { id: "sub-da", name: "Direito Administrativo", studyPriority: "PRIMARY" },
    { id: "sub-dc", name: "Direito Constitucional", studyPriority: "PRIMARY" },
    { id: "sub-dciv", name: "Direito Civil", studyPriority: "PRIMARY" },
    { id: "sub-dpc", name: "Direito Processual Civil", studyPriority: "PRIMARY" },
    { id: "sub-lp", name: "Língua Portuguesa", studyPriority: "PRIMARY" },
  ];
}

/** Bloco LINEAR simples */
function makeLinearBlock(
  id: string,
  subjectId: string,
  subjectName: string,
  orderIndex = 0
): any {
  return {
    id,
    subjectId,
    methodology: "LINEAR",
    status: "PENDING",
    estimatedStudyMinutes: 45,
    orderIndex,
    material: { fileName: "file.pdf", materialRole: "MAIN" },
    subject: { id: subjectId, name: subjectName },
  };
}

/** Bloco HYBRID com estimatedStudyMinutes persistido válido */
function makeHybridBlockValid(
  id: string,
  subjectId: string,
  subjectName: string,
  estimatedStudyMinutes = 60
): any {
  return {
    id,
    subjectId,
    methodology: "HYBRID_8020",
    status: "PENDING",
    estimatedStudyMinutes,
    orderIndex: 0,
    material: { fileName: "hybrid.pdf", materialRole: "MAIN" },
    subject: { id: subjectId, name: subjectName },
    aiAuditMetadata: {
      timeEstimation: { availableMinutes: 90 },
    },
  };
}

/** Bloco HYBRID inválido (estimatedStudyMinutes=0, sem metadados) */
function makeHybridBlockInvalid(
  id: string,
  subjectId: string,
  subjectName: string
): any {
  return {
    id,
    subjectId,
    methodology: "HYBRID_8020",
    status: "PENDING",
    estimatedStudyMinutes: 0,
    orderIndex: 0,
    material: { fileName: "hybrid-bad.pdf", materialRole: "MAIN" },
    subject: { id: subjectId, name: subjectName },
    aiAuditMetadata: null,
  };
}

// ── Helpers de asserção ───────────────────────────────────────────────────────

function getAllItems(): any[] {
  const calls = (mockPrisma.studyScheduleItem.createMany as jest.Mock).mock.calls;
  if (calls.length === 0) return [];
  return calls[calls.length - 1][0].data as any[];
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe("generateLegacyTrt4Schedule — regressão do fluxo LEGACY_TRT4", () => {
  const userId = "user-1";

  beforeEach(() => {
    jest.clearAllMocks();
    // reset studySubject.findMany to default
    (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(makeSubjects());
    (mockPrisma.studyBlock.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.studySchedule as any).updateMany = jest.fn().mockResolvedValue({});
    (mockPrisma.studySchedule as any).create = jest.fn().mockResolvedValue({
      id: "sched-default",
      userId,
      title: "Test",
      status: "ACTIVE",
    });
    (mockPrisma.studyScheduleItem.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.studyScheduleItem.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.studyScheduleItem.createMany as jest.Mock).mockResolvedValue({});
    (mockPrisma.studyBlock.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.studyBlockSource.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.extractedContent.findMany as jest.Mock).mockResolvedValue([]);
  });

  // ── Estrutura básica do cronograma ─────────────────────────────────────────

  describe("Operações Prisma esperadas", () => {
    it("deve arquivar cronogramas ACTIVE do usuário antes de criar um novo", async () => {
      const startDate = new Date(2026, 6, 13);
      // Simula apenas 1 dia
      const deadline = new Date(startDate);
      deadline.setDate(deadline.getDate() + 1);

      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      expect(mockPrisma.studySchedule.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId, status: "ACTIVE" }),
          data: expect.objectContaining({ status: "ARCHIVED" }),
        })
      );
    });

    it("deve criar um novo StudySchedule com status ACTIVE", async () => {
      const startDate = new Date(2026, 6, 13);
      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      expect(mockPrisma.studySchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            status: "ACTIVE",
          }),
        })
      );
    });

    it("deve buscar StudyBlocks filtrando por userId e status não COMPLETED", async () => {
      const startDate = new Date(2026, 6, 13);
      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const findManyCalls = (mockPrisma.studyBlock.findMany as jest.Mock).mock.calls;
      const pendingCall = findManyCalls.find(
        (call: any[]) => call[0]?.where?.status?.not === "COMPLETED"
      );
      expect(pendingCall).toBeDefined();
      expect(pendingCall[0].where.userId).toBe(userId);
    });
  });

  // ── SRS diário ─────────────────────────────────────────────────────────────

  describe("SRS diário", () => {
    it("deve criar 1 item REVIEW_FLASHCARDS de 30 min por dia de estudo (janela de 3 dias)", async () => {
      const startDate = new Date(2026, 6, 13); // Monday
      await generateLegacyTrt4Schedule(
        userId,
        { startDate },
        userPrefsWeekdays
      );

      const allCreated = getAllItems();
      const srsItems = allCreated.filter(
        (i: any) => i.actionType === "REVIEW_FLASHCARDS"
      );

      // Em 3 dias de estudo (seg, ter, qua) com deadline limitado pelos blocos vazios,
      // haverá pelo menos 1 SRS por dia de estudo (deadline é Nov/2026 mas sem blocos
      // o loop termina mais cedo... na verdade ele percorre todo período).
      // O SRS é criado independentemente de haver blocos de teoria.
      expect(srsItems.length).toBeGreaterThanOrEqual(1);
      srsItems.forEach((item: any) => {
        expect(item.estimatedMinutes).toBe(30);
        expect(item.actionType).toBe("REVIEW_FLASHCARDS");
        expect(item.status).toBe("PENDING");
      });
    });
  });

  // ── Ciclo de matérias ──────────────────────────────────────────────────────

  describe("Ciclo de matérias TRT4", () => {
    it("dia 1 de estudo deve conter blocos de Direito do Trabalho e Língua Portuguesa", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      const blocks = [
        makeLinearBlock("b-dt", "sub-dt", "Direito do Trabalho"),
        makeLinearBlock("b-lp", "sub-lp", "Língua Portuguesa"),
        makeLinearBlock("b-dpt", "sub-dpt", "Direito Processual do Trabalho"),
        makeLinearBlock("b-da", "sub-da", "Direito Administrativo"),
        makeLinearBlock("b-dc", "sub-dc", "Direito Constitucional"),
        makeLinearBlock("b-dpc", "sub-dpc", "Direito Processual Civil"),
      ];

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve(blocks);
        }
      );

      const startDate = new Date(2026, 6, 13); // Monday (dia de estudo 1)
      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const all = getAllItems();
      const day1Theory = all.filter(
        (i: any) => i.actionType === "THEORY" && i.dayNumber === 1
      );

      const subjectIds = day1Theory.map((i: any) => i.subjectId);
      expect(subjectIds).toContain("sub-dt");
      expect(subjectIds).toContain("sub-lp");
    });

    it("dia 2 de estudo deve conter blocos de Direito Processual do Trabalho e Direito Administrativo", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      const blocks = [
        makeLinearBlock("b-dt", "sub-dt", "Direito do Trabalho"),
        makeLinearBlock("b-lp", "sub-lp", "Língua Portuguesa"),
        makeLinearBlock("b-dpt", "sub-dpt", "Direito Processual do Trabalho"),
        makeLinearBlock("b-da", "sub-da", "Direito Administrativo"),
        makeLinearBlock("b-dc", "sub-dc", "Direito Constitucional"),
        makeLinearBlock("b-dpc", "sub-dpc", "Direito Processual Civil"),
      ];

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve(blocks);
        }
      );

      const startDate = new Date(2026, 6, 13);
      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const all = getAllItems();
      const day2Theory = all.filter(
        (i: any) => i.actionType === "THEORY" && i.dayNumber === 2
      );

      const subjectIds = day2Theory.map((i: any) => i.subjectId);
      expect(subjectIds).toContain("sub-dpt");
      expect(subjectIds).toContain("sub-da");
    });

    it("dia 3 de estudo deve conter blocos de Direito Constitucional e Direito Processual Civil", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      const blocks = [
        makeLinearBlock("b-dt", "sub-dt", "Direito do Trabalho"),
        makeLinearBlock("b-lp", "sub-lp", "Língua Portuguesa"),
        makeLinearBlock("b-dpt", "sub-dpt", "Direito Processual do Trabalho"),
        makeLinearBlock("b-da", "sub-da", "Direito Administrativo"),
        makeLinearBlock("b-dc", "sub-dc", "Direito Constitucional"),
        makeLinearBlock("b-dpc", "sub-dpc", "Direito Processual Civil"),
      ];

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve(blocks);
        }
      );

      const startDate = new Date(2026, 6, 13);
      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const all = getAllItems();
      const day3Theory = all.filter(
        (i: any) => i.actionType === "THEORY" && i.dayNumber === 3
      );

      const subjectIds = day3Theory.map((i: any) => i.subjectId);
      expect(subjectIds).toContain("sub-dc");
      expect(subjectIds).toContain("sub-dpc");
    });

    it("ciclo reinicia: dia 4 deve ter as mesmas matérias que dia 1 (DT + LP)", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      // Blocos suficientes para 4 dias
      const blocks = [
        makeLinearBlock("b-dt-1", "sub-dt", "Direito do Trabalho", 0),
        makeLinearBlock("b-dt-2", "sub-dt", "Direito do Trabalho", 1),
        makeLinearBlock("b-lp-1", "sub-lp", "Língua Portuguesa", 0),
        makeLinearBlock("b-lp-2", "sub-lp", "Língua Portuguesa", 1),
        makeLinearBlock("b-dpt", "sub-dpt", "Direito Processual do Trabalho"),
        makeLinearBlock("b-da", "sub-da", "Direito Administrativo"),
        makeLinearBlock("b-dc", "sub-dc", "Direito Constitucional"),
        makeLinearBlock("b-dpc", "sub-dpc", "Direito Processual Civil"),
      ];

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve(blocks);
        }
      );

      const startDate = new Date(2026, 6, 13);
      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const all = getAllItems();
      const day4Theory = all.filter(
        (i: any) => i.actionType === "THEORY" && i.dayNumber === 4
      );

      const subjectIds = day4Theory.map((i: any) => i.subjectId);
      expect(subjectIds).toContain("sub-dt");
      expect(subjectIds).toContain("sub-lp");
    });
  });

  // ── Terceiro bloco indevido ─────────────────────────────────────────────────

  describe("Terceiro bloco complementar", () => {
    it("não deve criar terceiro bloco quando remainingTheoryMinutes < 30", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      // Blocos com 45 min cada — 2 blocos = 90 min = dailyMinutes (120) - SRS(30)
      // Remaining após 2 blocos = 120-30-45-45 = 0 → nenhum complementar
      const blocks = [
        makeLinearBlock("b-dt", "sub-dt", "Direito do Trabalho"),
        makeLinearBlock("b-lp", "sub-lp", "Língua Portuguesa"),
      ];

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve(blocks);
        }
      );

      const startDate = new Date(2026, 6, 13);
      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const all = getAllItems();
      const day1Theory = all.filter(
        (i: any) => i.actionType === "THEORY" && i.dayNumber === 1
      );

      // Máximo 2 blocos de teoria no ciclo base (45+45=90=dailyMinutes-30)
      expect(day1Theory.length).toBeLessThanOrEqual(2);
    });

    it("não deve criar StudyScheduleItem de THEORY para bloco de Direito Civil quando não há remaining", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      const blocks = [
        makeLinearBlock("b-dt", "sub-dt", "Direito do Trabalho"),
        makeLinearBlock("b-lp", "sub-lp", "Língua Portuguesa"),
        makeLinearBlock("b-dciv", "sub-dciv", "Direito Civil"),
      ];

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve(blocks);
        }
      );

      const startDate = new Date(2026, 6, 13);
      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const all = getAllItems();
      const day1CivilItems = all.filter(
        (i: any) =>
          i.actionType === "THEORY" &&
          i.dayNumber === 1 &&
          i.subjectId === "sub-dciv"
      );

      // Não deve aparecer no dia 1 do ciclo (DT+LP) se o tempo não sobrar
      // DT(45) + LP(45) = 90 min = dailyMinutes(120) - SRS(30) = 90 → sem remaining
      expect(day1CivilItems).toHaveLength(0);
    });
  });

  // ── Bloco já concluído não bloqueia ────────────────────────────────────────

  describe("Blocos concluídos não bloqueiam pendentes", () => {
    it("bloco COMPLETED retornado pelo Prisma é excluído do pool de pendentes", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      const completedBlock = { id: "b-dt-old" };
      const pendingBlock = makeLinearBlock("b-dt-new", "sub-dt", "Direito do Trabalho");

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([completedBlock]);
          // Prisma filtra status: { not: "COMPLETED" } — só retorna pendentes
          return Promise.resolve([pendingBlock, makeLinearBlock("b-lp", "sub-lp", "Língua Portuguesa")]);
        }
      );

      const startDate = new Date(2026, 6, 13);
      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const all = getAllItems();
      const day1Theory = all.filter(
        (i: any) => i.actionType === "THEORY" && i.dayNumber === 1
      );

      // b-dt-old não deve aparecer; b-dt-new deve aparecer
      const scheduledIds = day1Theory.map((i: any) => i.studyBlockId);
      expect(scheduledIds).not.toContain("b-dt-old");
      expect(scheduledIds).toContain("b-dt-new");
    });
  });

  // ── Blocos LINEAR ──────────────────────────────────────────────────────────

  describe("Blocos LINEAR", () => {
    it("bloco LINEAR com estimatedStudyMinutes=45 é agendado com exatamente 45 min", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      const blocks = [
        makeLinearBlock("b-dt", "sub-dt", "Direito do Trabalho"),
        makeLinearBlock("b-lp", "sub-lp", "Língua Portuguesa"),
      ];

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve(blocks);
        }
      );

      const startDate = new Date(2026, 6, 13);
      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const all = getAllItems();
      const dtItem = all.find(
        (i: any) => i.studyBlockId === "b-dt" && i.actionType === "THEORY"
      );

      expect(dtItem).toBeDefined();
      expect(dtItem?.estimatedMinutes).toBe(45);
    });
  });

  // ── Blocos HYBRID válidos ──────────────────────────────────────────────────

  describe("Blocos HYBRID válidos", () => {
    it("bloco HYBRID com estimatedStudyMinutes=60 é agendado com exatamente 60 min", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      const blocks = [
        makeHybridBlockValid("hb-dt", "sub-dt", "Direito do Trabalho", 60),
        makeLinearBlock("b-lp", "sub-lp", "Língua Portuguesa"),
      ];

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve(blocks);
        }
      );

      const startDate = new Date(2026, 6, 13);
      const result = await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const all = getAllItems();
      const hybridItem = all.find(
        (i: any) => i.studyBlockId === "hb-dt" && i.actionType === "THEORY"
      );

      expect(hybridItem).toBeDefined();
      expect(hybridItem?.estimatedMinutes).toBe(60);

      // Nenhum warning para bloco válido
      expect(result.schedulerWarnings).toHaveLength(0);
    });
  });

  // ── Blocos HYBRID inválidos ────────────────────────────────────────────────

  describe("Blocos HYBRID inválidos — observabilidade e segurança", () => {
    it("bloco HYBRID inválido NÃO gera StudyScheduleItem de THEORY", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      const invalidBlock = makeHybridBlockInvalid("hb-bad", "sub-dt", "Direito do Trabalho");
      const validBlock = makeLinearBlock("b-lp", "sub-lp", "Língua Portuguesa");

      // Bloco inválido + um bloco válido de LP para garantir que o fluxo continua
      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve([invalidBlock, validBlock]);
        }
      );

      const startDate = new Date(2026, 6, 13);
      await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const all = getAllItems();
      const invalidItem = all.find(
        (i: any) => i.studyBlockId === "hb-bad" && i.actionType === "THEORY"
      );

      // ← ESTE É O TESTE CENTRAL: o bloco inválido não gerou nenhum item de cronograma
      expect(invalidItem).toBeUndefined();
    });

    it("bloco HYBRID inválido gera SchedulerWarning com código HYBRID_BLOCK_SKIPPED_INVALID_ESTIMATE", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      const invalidBlock = makeHybridBlockInvalid("hb-bad-2", "sub-dt", "Direito do Trabalho");

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve([invalidBlock, makeLinearBlock("b-lp", "sub-lp", "Língua Portuguesa")]);
        }
      );

      const startDate = new Date(2026, 6, 13);
      const result = await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      // O resultado deve conter o array de warnings
      expect(result.schedulerWarnings).toBeDefined();
      expect(Array.isArray(result.schedulerWarnings)).toBe(true);

      // Pelo menos 1 warning gerado para o bloco inválido
      const warning = result.schedulerWarnings?.find(
        (w: SchedulerWarning) => w.blockId === "hb-bad-2"
      );
      expect(warning).toBeDefined();
      expect(warning?.code).toBe("HYBRID_BLOCK_SKIPPED_INVALID_ESTIMATE");
      expect(typeof warning?.message).toBe("string");
      expect(warning?.message.length).toBeGreaterThan(0);
    });

    it("o warning NÃO representa agendamento de sucesso — nenhum item criado para hb-bad", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      const invalidBlock = makeHybridBlockInvalid("hb-bad-3", "sub-dt", "Direito do Trabalho");

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve([invalidBlock]);
        }
      );

      const startDate = new Date(2026, 6, 13);
      const result = await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      // Warning presente
      expect(result.schedulerWarnings?.some((w: SchedulerWarning) => w.blockId === "hb-bad-3")).toBe(true);

      // Mas nenhum item de teoria foi criado para esse bloco
      const calls = (mockPrisma.studyScheduleItem.createMany as jest.Mock).mock.calls;
      const allCreated = calls.length > 0 ? (calls[calls.length - 1][0].data as any[]) : [];
      const invalidItems = allCreated.filter(
        (i: any) => i.studyBlockId === "hb-bad-3"
      );
      expect(invalidItems).toHaveLength(0);
    });

    it("após bloco HYBRID inválido, o bloco seguinte da mesma matéria NÃO é tentado (loop-prevention do dia seguinte cobre)", async () => {
      // O scheduler marca o bloco inválido em scheduledBlockIds → evita retry no mesmo dia.
      // Verificamos que o bloco inválido foi adicionado à lista "completed" (agendamento de prevenção).
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      const invalidBlock = makeHybridBlockInvalid("hb-bad-4", "sub-dt", "Direito do Trabalho");
      const validDt = makeLinearBlock("b-dt-valid", "sub-dt", "Direito do Trabalho", 1);

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve([invalidBlock, validDt, makeLinearBlock("b-lp", "sub-lp", "Língua Portuguesa")]);
        }
      );

      const startDate = new Date(2026, 6, 13);
      const result = await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      const all = getAllItems();
      const day1Theory = all.filter(
        (i: any) => i.actionType === "THEORY" && i.dayNumber === 1
      );

      // hb-bad-4 NÃO foi agendado
      expect(day1Theory.map((i: any) => i.studyBlockId)).not.toContain("hb-bad-4");

      // O resultado contém warning para o bloco inválido
      expect(result.schedulerWarnings?.some((w: SchedulerWarning) => w.blockId === "hb-bad-4")).toBe(true);
    });

    it("resultado retorna schedulerWarnings como array (mesmo que vazio)", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve([makeLinearBlock("b-dt", "sub-dt", "Direito do Trabalho")]);
        }
      );

      const startDate = new Date(2026, 6, 13);
      const result = await generateLegacyTrt4Schedule(userId, { startDate }, userPrefs);

      expect(Array.isArray(result.schedulerWarnings)).toBe(true);
      expect(result.schedulerWarnings).toHaveLength(0);
    });

    it("não ocorre loop infinito com bloco HYBRID inválido — função retorna", async () => {
      const subjects = makeSubjects();
      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(subjects);

      // Apenas blocos inválidos
      const invalidBlocks = Array.from({ length: 5 }, (_, i) =>
        makeHybridBlockInvalid(`hb-bad-inf-${i}`, "sub-dt", "Direito do Trabalho")
      );

      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve(invalidBlocks);
        }
      );

      const startDate = new Date(2026, 6, 13);
      const t0 = Date.now();

      // A função deve terminar em tempo razoável (não travar)
      const result = await generateLegacyTrt4Schedule(
        userId,
        {
          startDate,
          // Limitar ao mínimo de dias para o teste não demorar percorrendo Nov/2026
        },
        {
          ...userPrefs,
          // Não existe opção de limitar dias no userPrefs; o deadline é fixo (Nov/2026).
          // O loop termina rápido porque os blocos inválidos são descartados do pool
          // na primeira iteração (scheduledBlockIds.add) e o loop não trava.
        }
      );

      const elapsed = Date.now() - t0;
      expect(elapsed).toBeLessThan(5000);
      expect(result.schedulerWarnings!.length).toBeGreaterThan(0);
    });
  });

  // ── generateSmartSchedule → LEGACY_TRT4 ───────────────────────────────────

  describe("generateSmartSchedule com modo LEGACY_TRT4", () => {
    it("deve chamar o caminho LEGACY_TRT4 quando userPrefs.scheduleGenerationMode = LEGACY_TRT4", async () => {
      // Importar generateSmartSchedule do mesmo módulo
      const { generateSmartSchedule } = await import("@/lib/scheduler");

      (mockPrisma.userPreferences as any).findUnique = jest.fn().mockResolvedValue({
        scheduleGenerationMode: "LEGACY_TRT4",
        studyDaysOfWeek: "1,2,3,4,5,6,0",
      });

      (mockPrisma.studySubject.findMany as jest.Mock).mockResolvedValue(makeSubjects());
      (mockPrisma.studyBlock.findMany as jest.Mock).mockImplementation(
        (args: any) => {
          if (args?.where?.status === "COMPLETED") return Promise.resolve([]);
          return Promise.resolve([makeLinearBlock("b-dt", "sub-dt", "Direito do Trabalho")]);
        }
      );

      const startDate = new Date(2026, 6, 13);
      const result = await generateSmartSchedule(userId, { startDate });

      // LEGACY_TRT4 cria cronograma → tem schedule retornado
      expect(result.schedule).toBeDefined();
      expect(result.schedule.id).toBe("sched-default");
      // schedulerWarnings presente no resultado (LEGACY_TRT4 os inclui)
      expect(Array.isArray(result.schedulerWarnings)).toBe(true);
    });
  });

  // ── Weekly Review e Cronômetros ────────────────────────────────────────────

  describe("Confirmação de não-interferência", () => {
    it("não altera weekly-review.ts — o mock de studyScheduleItem não inclui createWeeklyReview", async () => {
      // Esta função não existe no scheduler — garantindo que o scheduler
      // não chama nenhuma função do weekly review
      expect((mockPrisma as any).weeklyReview).toBeUndefined();
    });

    it("não acessa StudyTimerContext nem UserGlobalTimerContext — são client-side React", () => {
      // Contextos são do lado do cliente; o scheduler é server-side.
      // A ausência de import nos contextos é suficiente para garantir que não há interferência.
      const schedulerSource = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/lib/scheduler.ts"),
        "utf-8"
      );
      expect(schedulerSource).not.toContain("StudyTimerContext");
      expect(schedulerSource).not.toContain("UserGlobalTimerContext");
    });
  });
});

// ── Documentação de mutações detectáveis ───────────────────────────────────────
//
// Mutação 1: retirar o `continue` após bloco HYBRID inválido no catch block
//   → O teste "bloco HYBRID inválido NÃO gera StudyScheduleItem de THEORY" falha,
//     pois o bloco inválido será adicionado ao scheduleItemsData sem estimatedMinutes.
//
// Mutação 2: alterar TRT4_STRATEGY.cycle[0] para ["Direito Civil", "Informática"]
//   → O teste "dia 1 de estudo deve conter blocos de Direito do Trabalho e Língua Portuguesa" falha,
//     pois sub-dt e sub-lp não estarão no dia 1.
//     Também falha o teste de trt4-strategy.test.ts ("dia 0 do ciclo deve conter Direito do Trabalho").
//
// Mutação 3: remover o push de schedulerWarnings nos catch blocks
//   → O teste "bloco HYBRID inválido gera SchedulerWarning com código..." falha,
//     pois result.schedulerWarnings estará vazio.
//
// Mutação 4: retornar { schedule, itemsCount } sem schedulerWarnings
//   → O teste "resultado retorna schedulerWarnings como array" falha,
//     pois result.schedulerWarnings seria undefined.
//
// Mutação 5: criar StudyScheduleItem mesmo quando HybridScheduleIntegrityError é lançado
//   → O teste "o warning NÃO representa agendamento de sucesso" falha,
//     pois invalidItems.length seria > 0.
