import { shouldReorganizeSchedule } from "@/lib/scheduler/legacy-trt4-queue";

describe("Decisão de Reorganização e Auto-Recuperação do Cronograma", () => {
  const todayStr = "2026-08-11";

  test("Cenário 1 — Cronograma atualizado hoje, 0 teoria hoje, mas existem blocos elegíveis pendentes -> Reorganiza (shouldReorganize = true)", () => {
    const result = shouldReorganizeSchedule({
      hasActiveSchedule: true,
      scheduleTodayStr: todayStr,
      todayStr,
      hasTodayPendingTheory: false,
      hasEligiblePendingTheoryBlocks: true,
    });

    expect(result).toBe(true);
  });

  test("Cenário 2 — Cronograma atualizado hoje, possui 2 teorias pendentes hoje, existem blocos pendentes -> NÃO reorganiza (shouldReorganize = false)", () => {
    const result = shouldReorganizeSchedule({
      hasActiveSchedule: true,
      scheduleTodayStr: todayStr,
      todayStr,
      hasTodayPendingTheory: true,
      hasEligiblePendingTheoryBlocks: true,
    });

    expect(result).toBe(false);
  });

  test("Cenário 3 — Cronograma atualizado hoje, 0 teoria hoje e 0 blocos pendentes -> NÃO reorganiza (shouldReorganize = false)", () => {
    const result = shouldReorganizeSchedule({
      hasActiveSchedule: true,
      scheduleTodayStr: todayStr,
      todayStr,
      hasTodayPendingTheory: false,
      hasEligiblePendingTheoryBlocks: false,
    });

    expect(result).toBe(false);
  });

  test("Cenário 4 — Rollover Diário: Cronograma não foi atualizado hoje -> Reorganiza (shouldReorganize = true)", () => {
    const result = shouldReorganizeSchedule({
      hasActiveSchedule: true,
      scheduleTodayStr: "2026-08-10",
      todayStr,
      hasTodayPendingTheory: false,
      hasEligiblePendingTheoryBlocks: false,
    });

    expect(result).toBe(true);
  });

  test("Cenário 5 — Sem cronograma ativo -> NÃO reorganiza (shouldReorganize = false)", () => {
    const result = shouldReorganizeSchedule({
      hasActiveSchedule: false,
      scheduleTodayStr: undefined,
      todayStr,
      hasTodayPendingTheory: false,
      hasEligiblePendingTheoryBlocks: true,
    });

    expect(result).toBe(false);
  });
});
