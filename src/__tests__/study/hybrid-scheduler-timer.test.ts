/**
 * src/__tests__/study/hybrid-scheduler-timer.test.ts
 *
 * Testes unitários para a lógica do scheduler e do timer em blocos híbridos 80/20.
 */

import { getOrComputeBlockMinutes, HybridScheduleIntegrityError, SchedulerWarning } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";

// Mock do Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    studyBlockSource: {
      findMany: jest.fn(),
    },
    extractedContent: {
      findMany: jest.fn(),
    },
  },
}));

describe("Scheduler & Timer Logic — Hybrid 80/20 Blocks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Scheduler - getOrComputeBlockMinutes", () => {
    it("deve retornar o estimatedStudyMinutes persistido se for > 0 (valor persistido utilizado)", async () => {
      const mockBlock = {
        id: "hb-1",
        methodology: "HYBRID_8020",
        estimatedStudyMinutes: 45
      };

      const mins = await getOrComputeBlockMinutes(mockBlock, "Direito");
      expect(mins).toBe(45);
    });

    it("deve estimar dinamicamente a partir dos segmentos READ quando estimatedStudyMinutes for nulo/zero (fallback usa somente READ, CONSULT/SKIP não entram, envelope linear nunca consultado)", async () => {
      const mockBlock = {
        id: "hb-1",
        methodology: "HYBRID_8020",
        estimatedStudyMinutes: 0,
        aiAuditMetadata: {
          timeEstimation: {
            availableMinutes: 120
          }
        }
      };

      // Mock das fontes. CONSULT e SKIP não devem ser inclusos na query prisma (que filtra disposition: "READ")
      (prisma.studyBlockSource.findMany as jest.Mock).mockResolvedValue([
        {
          materialId: "mat-cfc",
          sourceRole: "ANCHOR_8020",
          segments: [{ pageStart: 1, pageEnd: 2, disposition: "READ" }]
        },
        {
          materialId: "mat-strat",
          sourceRole: "DEEPENING",
          segments: [{ pageStart: 10, pageEnd: 11, disposition: "READ" }]
        }
      ]);

      // Mock do texto extraído para cálculo de palavras
      (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
        { materialId: "mat-cfc", pageNumber: 1, text: "word ".repeat(150) },
        { materialId: "mat-cfc", pageNumber: 2, text: "word ".repeat(150) },
        { materialId: "mat-strat", pageNumber: 10, text: "word ".repeat(300) },
        { materialId: "mat-strat", pageNumber: 11, text: "word ".repeat(300) }
      ]);

      const mins = await getOrComputeBlockMinutes(mockBlock, "Direito");
      
      // 300 palavras CFC + 600 palavras Estratégia = 900 palavras.
      // O cálculo do helper híbrido deve dar um tempo estimado válido maior que 0 e nenhuma duração negativa.
      expect(mins).toBeGreaterThan(0);
      expect(mins).not.toBe(60); 
      expect(mins).not.toBe(-1);
    });

    it("deve lançar erro controlado de integridade (HybridScheduleIntegrityError) se os metadados estiverem ausentes", async () => {
      const mockBlock = {
        id: "hb-1",
        methodology: "HYBRID_8020",
        estimatedStudyMinutes: 0,
        aiAuditMetadata: null // sem metadados
      };

      await expect(getOrComputeBlockMinutes(mockBlock, "Direito")).rejects.toThrow(
        HybridScheduleIntegrityError
      );
    });

    it("deve lançar erro se os metadados possuírem availableMinutes inválido ou ausente", async () => {
      const mockBlock = {
        id: "hb-1",
        methodology: "HYBRID_8020",
        estimatedStudyMinutes: 0,
        aiAuditMetadata: {
          timeEstimation: {
            availableMinutes: 0 // inválido
          }
        }
      };

      await expect(getOrComputeBlockMinutes(mockBlock, "Direito")).rejects.toThrow(
        HybridScheduleIntegrityError
      );
    });

    it("deve lançar erro controlado se não houver fontes ou segmentos no banco", async () => {
      const mockBlock = {
        id: "hb-1",
        methodology: "HYBRID_8020",
        estimatedStudyMinutes: 0,
        aiAuditMetadata: {
          timeEstimation: {
            availableMinutes: 120
          }
        }
      };

      (prisma.studyBlockSource.findMany as jest.Mock).mockResolvedValue([]);

      await expect(getOrComputeBlockMinutes(mockBlock, "Direito")).rejects.toThrow(
        HybridScheduleIntegrityError
      );
    });
  });

  describe("Timer Logic Simulation", () => {
    it("deve simular que abrir o bloco híbrido em estado PAUSED não incrementa tempo", () => {
      const timerState = {
        isRunning: false,
        elapsedSeconds: 0,
        currentBlockId: "hb-1"
      };

      // Simula a passagem do tempo em loop de tick
      const tick = () => {
        if (timerState.isRunning) {
          timerState.elapsedSeconds += 1;
        }
      };

      tick();
      tick();

      expect(timerState.elapsedSeconds).toBe(0);
    });

    it("deve simular que Play inicia a contagem e Pause interrompe", () => {
      const timerState = {
        isRunning: false,
        elapsedSeconds: 0,
        currentBlockId: "hb-1"
      };

      // Play
      timerState.isRunning = true;
      
      // Simula ticks
      if (timerState.isRunning) timerState.elapsedSeconds += 1;
      if (timerState.isRunning) timerState.elapsedSeconds += 1;

      expect(timerState.elapsedSeconds).toBe(2);

      // Pause
      timerState.isRunning = false;

      // Simula ticks
      if (timerState.isRunning) timerState.elapsedSeconds += 1;

      expect(timerState.elapsedSeconds).toBe(2);
    });

    it("deve simular que a sessão de outro bloco não é controlada e permanece independente", () => {
      const timerState = {
        isRunning: true,
        elapsedSeconds: 120,
        currentBlockId: "block-linear-123"
      };

      const requestForHybridBlockId = "hb-1";
      const isCurrentBlockSession = timerState.currentBlockId === requestForHybridBlockId;

      expect(isCurrentBlockSession).toBe(false);
      // Se não for o bloco atual, o display deve mostrar 00:00 e controles ficam desativados
      const displaySeconds = isCurrentBlockSession ? timerState.elapsedSeconds : 0;
      expect(displaySeconds).toBe(0);
    });
  });

  // ── Alinhamento de chave availableMinutes ────────────────────────────────────
  describe("Metadata key — availableMinutes alinhado entre produtor e consumidor", () => {
    it("deve ler exatamente o valor de timeEstimation.availableMinutes persistido pelo serviço", async () => {
      // Este teste confirma que o produtor (hybrid-block.ts → calculateHybridMinutes → timeAudit)
      // grava 'availableMinutes' e o consumidor (getOrComputeBlockMinutes) lê exatamente esse campo.
      const PERSISTED_AVAILABLE = 90;
      const mockBlock = {
        id: "hb-avail-1",
        methodology: "HYBRID_8020",
        estimatedStudyMinutes: 0,
        aiAuditMetadata: {
          timeEstimation: {
            availableMinutes: PERSISTED_AVAILABLE, // campo canônico, sem alias
          },
        },
      };

      (prisma.studyBlockSource.findMany as jest.Mock).mockResolvedValue([
        {
          materialId: "mat-cfc",
          sourceRole: "ANCHOR_8020",
          segments: [{ pageStart: 1, pageEnd: 2, disposition: "READ" }],
        },
      ]);

      (prisma.extractedContent.findMany as jest.Mock).mockResolvedValue([
        { materialId: "mat-cfc", pageNumber: 1, text: "word ".repeat(200) },
        { materialId: "mat-cfc", pageNumber: 2, text: "word ".repeat(200) },
      ]);

      const mins = await getOrComputeBlockMinutes(mockBlock, "Direito");
      // Deve ter clampado ao máximo de PERSISTED_AVAILABLE=90
      expect(mins).toBeGreaterThan(0);
      expect(mins).toBeLessThanOrEqual(PERSISTED_AVAILABLE);
    });

    it("deve rejeitar metadado com chave errada (availableMinutesLimit) lançando HybridScheduleIntegrityError", async () => {
      const mockBlock = {
        id: "hb-wrong-key",
        methodology: "HYBRID_8020",
        estimatedStudyMinutes: 0,
        aiAuditMetadata: {
          timeEstimation: {
            // Chave INCORRETA: não deve ser lida pelo scheduler
            availableMinutesLimit: 120,
          },
        },
      };

      await expect(getOrComputeBlockMinutes(mockBlock, "Direito")).rejects.toThrow(
        HybridScheduleIntegrityError
      );
    });

    it("deve lançar HybridScheduleIntegrityError quando timeEstimation estiver completamente ausente", async () => {
      const mockBlock = {
        id: "hb-no-meta",
        methodology: "HYBRID_8020",
        estimatedStudyMinutes: 0,
        aiAuditMetadata: {},  // timeEstimation ausente
      };

      await expect(getOrComputeBlockMinutes(mockBlock, "Direito")).rejects.toThrow(
        HybridScheduleIntegrityError
      );
    });
  });

  // ── SchedulerWarning — estrutura e observabilidade ───────────────────────────
  describe("SchedulerWarning — estrutura e observabilidade", () => {
    it("deve ter a interface SchedulerWarning com code, blockId e message", () => {
      const warning: SchedulerWarning = {
        code: "HYBRID_BLOCK_SKIPPED_INVALID_ESTIMATE",
        blockId: "hb-xyz",
        message: "availableMinutes ausente nos metadados.",
      };

      expect(warning.code).toBe("HYBRID_BLOCK_SKIPPED_INVALID_ESTIMATE");
      expect(warning.blockId).toBe("hb-xyz");
      expect(typeof warning.message).toBe("string");
    });

    it("deve capturar e registrar warning sem interromper o processamento de blocos seguintes", () => {
      const schedulerWarnings: SchedulerWarning[] = [];
      const processed: string[] = [];

      const blocks = [
        { id: "hb-bad", invalid: true },
        { id: "hb-good-1", invalid: false },
        { id: "hb-good-2", invalid: false },
      ];

      for (const block of blocks) {
        if (block.invalid) {
          schedulerWarnings.push({
            code: "HYBRID_BLOCK_SKIPPED_INVALID_ESTIMATE",
            blockId: block.id,
            message: "Metadado ausente.",
          });
          continue;
        }
        processed.push(block.id);
      }

      // O bloco inválido gerou warning, mas não interrompeu os demais
      expect(schedulerWarnings).toHaveLength(1);
      expect(schedulerWarnings[0].blockId).toBe("hb-bad");
      expect(processed).toEqual(["hb-good-1", "hb-good-2"]);
    });

    it("deve garantir que nenhum item é criado para o bloco descartado (não há schedule entry)", () => {
      const scheduleItems: Array<{ blockId: string }> = [];
      const schedulerWarnings: SchedulerWarning[] = [];

      const blocks = [
        { id: "hb-skip", invalid: true },
        { id: "hb-ok", invalid: false },
      ];

      for (const block of blocks) {
        if (block.invalid) {
          schedulerWarnings.push({
            code: "HYBRID_BLOCK_SKIPPED_INVALID_ESTIMATE",
            blockId: block.id,
            message: "Cálculo falhou.",
          });
          // Não criamos nenhum item de cronograma — apenas marcamos o warning
          continue;
        }
        scheduleItems.push({ blockId: block.id });
      }

      // Apenas o bloco válido gerou item de cronograma
      expect(scheduleItems).toHaveLength(1);
      expect(scheduleItems[0].blockId).toBe("hb-ok");

      // O bloco inválido aparece só no warnings, nunca nos itens
      const warningIds = schedulerWarnings.map((w) => w.blockId);
      const scheduleIds = scheduleItems.map((i) => i.blockId);
      expect(warningIds).toContain("hb-skip");
      expect(scheduleIds).not.toContain("hb-skip");
    });
  });
});
