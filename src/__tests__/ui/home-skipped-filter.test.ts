/**
 * home-skipped-filter.test.ts
 *
 * Teste de Aceite UI (Home):
 * Garante que itens com status = 'SKIPPED' NUNCA sejam incluídos em studyTasks,
 * reviewTasks ou no somatório de totalMinutes da página inicial.
 */

import { selectTodayTasks } from "@/lib/schedule/today-tasks";

describe("Home UI — Filtro Rigoroso de Itens SKIPPED", () => {
  test("Cenário de Aceite: todayItems com 3 PENDING (33 min) + 2 SKIPPED (120 min) deve renderizar APENAS 3 tarefas e somar 33 min", () => {
    const rawTodayItems = [
      {
        id: "item-cfc-1",
        actionType: "THEORY",
        status: "PENDING",
        estimatedMinutes: 3,
        studyBlock: { id: "b1", title: "Contratos de Trabalho" },
      },
      {
        id: "item-cfc-2",
        actionType: "THEORY",
        status: "PENDING",
        estimatedMinutes: 21,
        studyBlock: { id: "b2", title: "Controle da Administração" },
      },
      {
        id: "item-cfc-3",
        actionType: "THEORY",
        status: "PENDING",
        estimatedMinutes: 9,
        studyBlock: { id: "b3", title: "Prescrição" },
      },
      {
        id: "item-skipped-1",
        actionType: "THEORY",
        status: "SKIPPED",
        estimatedMinutes: 60,
        studyBlock: { id: "b-old-1", title: "Agentes Públicos Estratégia" },
      },
      {
        id: "item-skipped-2",
        actionType: "THEORY",
        status: "SKIPPED",
        estimatedMinutes: 60,
        studyBlock: { id: "b-old-2", title: "Poder Legislativo Estratégia" },
      },
      {
        id: "item-review-skipped",
        actionType: "REVIEW_BLOCK",
        status: "SKIPPED",
        studyBlock: { id: "b-rev-1", flashcards: [{ id: "fc-1" }] },
      },
    ];

    const result = selectTodayTasks(rawTodayItems, 0);

    // Deve conter exatamente as 3 teorias ativas (sem os 2 SKIPPED)
    expect(result.studyTasks.length).toBe(3);
    expect(result.studyTasks.map((t) => t.id)).toEqual([
      "item-cfc-1",
      "item-cfc-2",
      "item-cfc-3",
    ]);

    // O total de minutos deve ser estritamente 3 + 21 + 9 = 33 min (não 153 min!)
    expect(result.totalMinutes).toBe(33);

    // reviewTasks não deve incluir o item de revisão SKIPPED
    expect(result.reviewTasks.length).toBe(0);
  });
});
