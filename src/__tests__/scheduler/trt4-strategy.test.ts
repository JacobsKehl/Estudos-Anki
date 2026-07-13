/**
 * src/__tests__/scheduler/trt4-strategy.test.ts
 *
 * Testes da estrutura estática real de TRT4_STRATEGY.
 * Importa o objeto de produção diretamente — nenhuma lógica de scheduler copiada.
 * Cobertura de limitação documentada: não existe função produtiva exportada que
 * encapsule só a lógica de ciclo; os testes cobrem a fonte de verdade (o objeto).
 */

import { TRT4_STRATEGY, SubjectConfig } from "@/lib/strategies/trt4";

describe("TRT4_STRATEGY — estrutura do ciclo de estudos", () => {
  describe("Ciclo de 3 dias", () => {
    it("deve ter exatamente 3 dias de ciclo", () => {
      expect(TRT4_STRATEGY.cycle).toHaveLength(3);
    });

    it("cada dia do ciclo deve ter exatamente 2 matérias", () => {
      TRT4_STRATEGY.cycle.forEach((day) => {
        expect(day).toHaveLength(2);
      });
    });

    it("dia 0 do ciclo deve conter Direito do Trabalho", () => {
      expect(TRT4_STRATEGY.cycle[0]).toContain("Direito do Trabalho");
    });

    it("dia 0 do ciclo deve conter Língua Portuguesa", () => {
      expect(TRT4_STRATEGY.cycle[0]).toContain("Língua Portuguesa");
    });

    it("dia 1 do ciclo deve conter Direito Processual do Trabalho", () => {
      expect(TRT4_STRATEGY.cycle[1]).toContain("Direito Processual do Trabalho");
    });

    it("dia 1 do ciclo deve conter Direito Administrativo", () => {
      expect(TRT4_STRATEGY.cycle[1]).toContain("Direito Administrativo");
    });

    it("dia 2 do ciclo deve conter Direito Constitucional", () => {
      expect(TRT4_STRATEGY.cycle[2]).toContain("Direito Constitucional");
    });

    it("dia 2 do ciclo deve conter Direito Processual Civil", () => {
      expect(TRT4_STRATEGY.cycle[2]).toContain("Direito Processual Civil");
    });

    it("Direito Civil NÃO deve aparecer em nenhum dia do ciclo base", () => {
      const allInCycle = TRT4_STRATEGY.cycle.flat();
      expect(allInCycle).not.toContain("Direito Civil");
    });

    it("o ciclo não prevê terceiro slot — cada dia tem exatamente 2 matérias, não 3", () => {
      TRT4_STRATEGY.cycle.forEach((day) => {
        expect(day.length).toBe(2);
        expect(day.length).not.toBeGreaterThan(2);
      });
    });
  });

  describe("Matérias configuradas", () => {
    it("deve ter exatamente 7 matérias principais (isCoreSubject=true)", () => {
      const coreSubjects = TRT4_STRATEGY.subjects.filter(
        (s: SubjectConfig) => s.isCoreSubject
      );
      expect(coreSubjects).toHaveLength(7);
    });

    it("Direito Civil é matéria principal (isCoreSubject=true) — entra como complemento, não no ciclo base", () => {
      const dc = TRT4_STRATEGY.subjects.find(
        (s: SubjectConfig) => s.name === "Direito Civil"
      );
      expect(dc).toBeDefined();
      expect(dc?.isCoreSubject).toBe(true);
      // Direito Civil NÃO está no ciclo base (confirmado no teste acima)
      const inCycle = TRT4_STRATEGY.cycle.flat().includes("Direito Civil");
      expect(inCycle).toBe(false);
    });

    it("Direito do Trabalho deve ser matéria principal com peso 2", () => {
      const dt = TRT4_STRATEGY.subjects.find(
        (s: SubjectConfig) => s.name === "Direito do Trabalho"
      );
      expect(dt).toBeDefined();
      expect(dt?.isCoreSubject).toBe(true);
      expect(dt?.examWeight).toBe(2);
    });

    it("Direito Processual do Trabalho deve ser matéria principal com peso 2", () => {
      const dpt = TRT4_STRATEGY.subjects.find(
        (s: SubjectConfig) => s.name === "Direito Processual do Trabalho"
      );
      expect(dpt).toBeDefined();
      expect(dpt?.isCoreSubject).toBe(true);
      expect(dpt?.examWeight).toBe(2);
    });

    it("matérias de suporte devem entrar após 90 dias (cycleStartAfterDays)", () => {
      const support = TRT4_STRATEGY.subjects.filter(
        (s: SubjectConfig) => !s.isCoreSubject
      );
      expect(support.length).toBeGreaterThan(0);
      support.forEach((s: SubjectConfig) => {
        expect(s.cycleStartAfterDays).toBe(90);
      });
    });

    it("Matemática deve ser matéria de suporte que entra após 90 dias", () => {
      const mat = TRT4_STRATEGY.subjects.find(
        (s: SubjectConfig) => s.name === "Matemática e Raciocínio Lógico"
      );
      expect(mat).toBeDefined();
      expect(mat?.isCoreSubject).toBe(false);
      expect(mat?.cycleStartAfterDays).toBe(90);
    });
  });

  describe("Parâmetros de sessão diária", () => {
    it("dailyStudyMinutes deve ser 120", () => {
      expect(TRT4_STRATEGY.dailyStudyMinutes).toBe(120);
    });

    it("dailySrsMinutes deve ser 30", () => {
      expect(TRT4_STRATEGY.dailySrsMinutes).toBe(30);
    });

    it("minutesPerStudyBlock deve ser 45", () => {
      expect(TRT4_STRATEGY.minutesPerStudyBlock).toBe(45);
    });

    it("studyBlocksPerDay deve ser 2", () => {
      expect(TRT4_STRATEGY.studyBlocksPerDay).toBe(2);
    });
  });

  // ── Limitação de cobertura ────────────────────────────────────────────────
  // As funções isStudyDay, addDays, getCycleOffset, getSubjectsForDay são
  // privadas (não exportadas) do scheduler.ts. Não existem como módulo
  // separado em src/lib/schedule-window-core.ts (arquivo nunca existiu).
  // Os testes de regressão dessas funções são cobertos indiretamente em
  // trt4-legacy-scheduler.test.ts via generateLegacyTrt4Schedule + mocks.
});
