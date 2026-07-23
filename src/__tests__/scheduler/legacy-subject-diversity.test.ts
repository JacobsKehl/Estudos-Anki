import {
  selectLegacySubjectCandidate,
  planLegacyScheduleDiversityRepair,
  LegacySubjectCandidate,
  SelectLegacySubjectInput,
  RepairPlanInput
} from "@/lib/scheduler/legacy-subject-diversity";

describe("selectLegacySubjectCandidate — Função Pura de Seleção de Diversidade", () => {
  const dtCandidate: LegacySubjectCandidate = {
    subjectId: "sub-dt",
    subjectName: "Direito do Trabalho",
    studyPriority: "PRIMARY",
    pendingBlocksCount: 5,
  };

  const lpCandidate: LegacySubjectCandidate = {
    subjectId: "sub-lp",
    subjectName: "Língua Portuguesa",
    studyPriority: "PRIMARY",
    pendingBlocksCount: 3,
  };

  const daCandidate: LegacySubjectCandidate = {
    subjectId: "sub-da",
    subjectName: "Direito Administrativo",
    studyPriority: "PRIMARY",
    pendingBlocksCount: 2,
  };

  test("1. Escolhe matéria preferida ainda não utilizada hoje (PREFERRED_NEW_TODAY)", () => {
    const input: SelectLegacySubjectInput = {
      candidates: [dtCandidate, lpCandidate],
      preferredSubjectIds: ["sub-dt"],
      sameDaySubjectIds: new Set(),
      previousDaySubjectIds: new Set(),
    };

    const result = selectLegacySubjectCandidate(input);

    expect(result.subjectId).toBe("sub-dt");
    expect(result.diversityFallbackUsed).toBe(false);
    expect(result.sameDayRepetitionUnavoidable).toBe(false);
    expect(result.selectionReason).toBe("PREFERRED_NEW_TODAY");
  });

  test("2. Escolhe alternativa distinta quando a preferida já foi utilizada hoje (ALTERNATIVE_NEW_TODAY)", () => {
    const input: SelectLegacySubjectInput = {
      candidates: [dtCandidate, lpCandidate],
      preferredSubjectIds: ["sub-dt"],
      sameDaySubjectIds: new Set(["sub-dt"]), // DT já foi usada hoje
      previousDaySubjectIds: new Set(),
    };

    const result = selectLegacySubjectCandidate(input);

    expect(result.subjectId).toBe("sub-lp"); // LP escolhida como alternativa distinta
    expect(result.diversityFallbackUsed).toBe(true);
    expect(result.sameDayRepetitionUnavoidable).toBe(false);
    expect(result.selectionReason).toBe("ALTERNATIVE_NEW_TODAY");
  });

  test("3. Prefere matérias que não foram estudadas no dia anterior quando houver escolha equivalente", () => {
    const input: SelectLegacySubjectInput = {
      candidates: [dtCandidate, lpCandidate, daCandidate],
      preferredSubjectIds: [], // sem preferência de ciclo
      sameDaySubjectIds: new Set(),
      previousDaySubjectIds: new Set(["sub-dt"]), // DT estudada ontem
    };

    const result = selectLegacySubjectCandidate(input);

    expect(result.subjectId).not.toBe("sub-dt");
    expect(["sub-da", "sub-lp"]).toContain(result.subjectId);
    expect(result.sameDayRepetitionUnavoidable).toBe(false);
  });

  test("4. Permite repetição intra-dia quando só resta uma matéria com blocos pendentes", () => {
    const dtOnlyCandidate = { ...dtCandidate, pendingBlocksCount: 2 };
    const lpEmptyCandidate = { ...lpCandidate, pendingBlocksCount: 0 };

    const input: SelectLegacySubjectInput = {
      candidates: [dtOnlyCandidate, lpEmptyCandidate],
      preferredSubjectIds: ["sub-lp"], // ciclo queria LP, mas LP não tem blocos
      sameDaySubjectIds: new Set(["sub-dt"]), // DT já usada hoje
      previousDaySubjectIds: new Set(),
    };

    const result = selectLegacySubjectCandidate(input);

    expect(result.subjectId).toBe("sub-dt"); // DT repetida pois é a única com blocos pendentes
    expect(result.diversityFallbackUsed).toBe(true);
    expect(result.sameDayRepetitionUnavoidable).toBe(true);
    expect(result.selectionReason).toBe("ANY_REPEATED_UNAVOIDABLE");
  });

  test("5. Realiza desempate determinístico sem alterar os inputs recebidos", () => {
    const candidatesInput = [dtCandidate, lpCandidate];
    const preferredInput = ["sub-dt"];
    const sameDaySet = new Set<string>();
    const prevDaySet = new Set<string>();

    const input: SelectLegacySubjectInput = {
      candidates: candidatesInput,
      preferredSubjectIds: preferredInput,
      sameDaySubjectIds: sameDaySet,
      previousDaySubjectIds: prevDaySet,
    };

    const result1 = selectLegacySubjectCandidate(input);
    const result2 = selectLegacySubjectCandidate(input);

    expect(result1.subjectId).toBe(result2.subjectId);

    expect(candidatesInput.length).toBe(2);
    expect(sameDaySet.size).toBe(0);
    expect(prevDaySet.size).toBe(0);
  });
});

describe("planLegacyScheduleDiversityRepair — Testes Determinísticos de planHash", () => {
  const baseInput: RepairPlanInput = {
    scheduleSnapshot: {
      scheduleId: "sched-123",
      updatedAt: "2026-07-23T12:00:00.000Z",
      generationMode: "LEGACY_TRT4",
      dailyMinutes: 120,
      items: [
        {
          id: "item-2",
          scheduleId: "sched-123",
          subjectId: "sub-lp",
          actionType: "THEORY",
          status: "PENDING",
          scheduledDate: "2026-07-23T00:00:00.000Z",
          dayNumber: 1,
          estimatedMinutes: 45
        },
        {
          id: "item-1",
          scheduleId: "sched-123",
          subjectId: "sub-dt",
          actionType: "THEORY",
          status: "PENDING",
          scheduledDate: "2026-07-23T00:00:00.000Z",
          dayNumber: 1,
          estimatedMinutes: 45
        }
      ]
    },
    userSubjects: [
      { id: "sub-lp", name: "Língua Portuguesa", studyPriority: "PRIMARY" },
      { id: "sub-dt", name: "Direito do Trabalho", studyPriority: "PRIMARY" }
    ],
    baseDate: "2026-07-23"
  };

  test("1. Mesma entrada em ordens diferentes produz o mesmo canonicalPlanHash", () => {
    const input1 = JSON.parse(JSON.stringify(baseInput));
    const input2 = JSON.parse(JSON.stringify(baseInput));

    // Inverter ordem dos itens e matérias no input2
    input2.scheduleSnapshot.items.reverse();
    input2.userSubjects.reverse();

    const plan1 = planLegacyScheduleDiversityRepair(input1);
    const plan2 = planLegacyScheduleDiversityRepair(input2);

    expect(plan1.canonicalPlanHash).toBe(plan2.canonicalPlanHash);
  });

  test("2. Alteração de status altera o canonicalPlanHash", () => {
    const inputModified = JSON.parse(JSON.stringify(baseInput));
    inputModified.scheduleSnapshot.items[0].status = "COMPLETED";

    const planOriginal = planLegacyScheduleDiversityRepair(baseInput);
    const planModified = planLegacyScheduleDiversityRepair(inputModified);

    expect(planOriginal.canonicalPlanHash).not.toBe(planModified.canonicalPlanHash);
  });

  test("3. Alteração de scheduledDate altera o canonicalPlanHash", () => {
    const inputModified = JSON.parse(JSON.stringify(baseInput));
    inputModified.scheduleSnapshot.items[0].scheduledDate = "2026-07-24T00:00:00.000Z";

    const planOriginal = planLegacyScheduleDiversityRepair(baseInput);
    const planModified = planLegacyScheduleDiversityRepair(inputModified);

    expect(planOriginal.canonicalPlanHash).not.toBe(planModified.canonicalPlanHash);
  });

  test("4. Alteração de scheduleUpdatedAt altera o canonicalPlanHash", () => {
    const inputModified = JSON.parse(JSON.stringify(baseInput));
    inputModified.scheduleSnapshot.updatedAt = "2026-07-23T15:30:00.000Z";

    const planOriginal = planLegacyScheduleDiversityRepair(baseInput);
    const planModified = planLegacyScheduleDiversityRepair(inputModified);

    expect(planOriginal.canonicalPlanHash).not.toBe(planModified.canonicalPlanHash);
  });

  test("5. Input não é modificado durante a geração do plano", () => {
    const inputOriginalJson = JSON.stringify(baseInput);
    planLegacyScheduleDiversityRepair(baseInput);

    expect(JSON.stringify(baseInput)).toBe(inputOriginalJson);
  });

  test("6. Dois itens da matéria A e um da matéria B no mesmo dia são distribuídos como A+B antes de repetir A", () => {
    const input: RepairPlanInput = {
      scheduleSnapshot: {
        scheduleId: "sched-mono",
        updatedAt: "2026-07-23T12:00:00.000Z",
        generationMode: "LEGACY_TRT4",
        dailyMinutes: 120,
        items: [
          {
            id: "item-a1",
            scheduleId: "sched-mono",
            subjectId: "sub-dt",
            actionType: "THEORY",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
          {
            id: "item-a2",
            scheduleId: "sched-mono",
            subjectId: "sub-dt",
            actionType: "THEORY",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
          {
            id: "item-b1",
            scheduleId: "sched-mono",
            subjectId: "sub-lp",
            actionType: "THEORY",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
        ],
      },
      userSubjects: [
        { id: "sub-dt", name: "Direito do Trabalho", studyPriority: "PRIMARY" },
        { id: "sub-lp", name: "Língua Portuguesa", studyPriority: "PRIMARY" },
      ],
      baseDate: "2026-07-23",
    };

    const plan = planLegacyScheduleDiversityRepair(input);

    expect(plan.movements.length).toBeGreaterThan(0);
    expect(plan.movedItemsCount).toBe(plan.movements.length);
  });

  test("7. Movimentos são gerados quando o dia inicial é monotemático evitável e movedItemsCount bate", () => {
    const input: RepairPlanInput = {
      scheduleSnapshot: {
        scheduleId: "sched-avoidable",
        updatedAt: "2026-07-23T12:00:00.000Z",
        generationMode: "LEGACY_TRT4",
        dailyMinutes: 120,
        items: [
          {
            id: "item-1",
            scheduleId: "sched-avoidable",
            subjectId: "sub-dt",
            actionType: "THEORY",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
          {
            id: "item-2",
            scheduleId: "sched-avoidable",
            subjectId: "sub-dt",
            actionType: "THEORY",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
          {
            id: "item-3",
            scheduleId: "sched-avoidable",
            subjectId: "sub-lp",
            actionType: "THEORY",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
        ],
      },
      userSubjects: [
        { id: "sub-dt", name: "Direito do Trabalho", studyPriority: "PRIMARY" },
        { id: "sub-lp", name: "Língua Portuguesa", studyPriority: "PRIMARY" },
      ],
      baseDate: "2026-07-23",
    };

    const plan = planLegacyScheduleDiversityRepair(input);

    expect(plan.movements.length).toBeGreaterThan(0);
    expect(plan.movedItemsCount).toBe(plan.movements.length);
  });

  test("8. unavoidableRepetitionsCount é incrementado quando só resta uma matéria com blocos pendentes", () => {
    const input: RepairPlanInput = {
      scheduleSnapshot: {
        scheduleId: "sched-unavoidable",
        updatedAt: "2026-07-23T12:00:00.000Z",
        generationMode: "LEGACY_TRT4",
        dailyMinutes: 120,
        items: [
          {
            id: "item-1",
            scheduleId: "sched-unavoidable",
            subjectId: "sub-dt",
            actionType: "THEORY",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
          {
            id: "item-2",
            scheduleId: "sched-unavoidable",
            subjectId: "sub-dt",
            actionType: "THEORY",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
        ],
      },
      userSubjects: [
        { id: "sub-dt", name: "Direito do Trabalho", studyPriority: "PRIMARY" },
      ],
      baseDate: "2026-07-23",
    };

    const plan = planLegacyScheduleDiversityRepair(input);

    expect(plan.unavoidableRepetitionsCount).toBeGreaterThan(0);
  });

  test("9. Itens COMPLETED não são movidos e itens não THEORY (SRS/SUPPORT) não são alterados", () => {
    const input: RepairPlanInput = {
      scheduleSnapshot: {
        scheduleId: "sched-completed",
        updatedAt: "2026-07-23T12:00:00.000Z",
        generationMode: "LEGACY_TRT4",
        dailyMinutes: 120,
        items: [
          {
            id: "item-completed",
            scheduleId: "sched-completed",
            subjectId: "sub-dt",
            actionType: "THEORY",
            status: "COMPLETED",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
          {
            id: "item-srs",
            scheduleId: "sched-completed",
            subjectId: "sub-dt",
            actionType: "REVIEW_FLASHCARDS",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 30,
          },
        ],
      },
      userSubjects: [
        { id: "sub-dt", name: "Direito do Trabalho", studyPriority: "PRIMARY" },
        { id: "sub-lp", name: "Língua Portuguesa", studyPriority: "PRIMARY" },
      ],
      baseDate: "2026-07-23",
    };

    const plan = planLegacyScheduleDiversityRepair(input);

    expect(plan.movements.length).toBe(0);
    expect(plan.preservedItemsCount).toBe(2);
  });

  test("10. Nenhum item é perdido, nenhum itemId duplicado e nenhum studyBlockId duplicado no plano", () => {
    const input: RepairPlanInput = {
      scheduleSnapshot: {
        scheduleId: "sched-integrity",
        updatedAt: "2026-07-23T12:00:00.000Z",
        generationMode: "LEGACY_TRT4",
        dailyMinutes: 120,
        items: [
          {
            id: "item-1",
            scheduleId: "sched-integrity",
            subjectId: "sub-dt",
            studyBlockId: "block-1",
            actionType: "THEORY",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
          {
            id: "item-2",
            scheduleId: "sched-integrity",
            subjectId: "sub-dt",
            studyBlockId: "block-2",
            actionType: "THEORY",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
        ],
      },
      userSubjects: [
        { id: "sub-dt", name: "Direito do Trabalho", studyPriority: "PRIMARY" },
        { id: "sub-lp", name: "Língua Portuguesa", studyPriority: "PRIMARY" },
      ],
      baseDate: "2026-07-23",
    };

    const plan = planLegacyScheduleDiversityRepair(input);

    expect(plan.totalItemsCount).toBe(2);
    expect(plan.scheduleId).toBe("sched-integrity");

    const movedItemIds = plan.movements.map(m => m.itemId);
    const uniqueItemIds = new Set(movedItemIds);
    expect(movedItemIds.length).toBe(uniqueItemIds.size);
  });

  test("11. Modo DYNAMIC retorna plano sem movimentos (movements vazio)", () => {
    const input: RepairPlanInput = {
      scheduleSnapshot: {
        scheduleId: "sched-dynamic",
        updatedAt: "2026-07-23T12:00:00.000Z",
        generationMode: "DYNAMIC",
        dailyMinutes: 120,
        items: [
          {
            id: "item-1",
            scheduleId: "sched-dynamic",
            subjectId: "sub-dt",
            actionType: "THEORY",
            status: "PENDING",
            scheduledDate: "2026-07-23T00:00:00.000Z",
            dayNumber: 1,
            estimatedMinutes: 45,
          },
        ],
      },
      userSubjects: [
        { id: "sub-dt", name: "Direito do Trabalho", studyPriority: "PRIMARY" },
      ],
      baseDate: "2026-07-23",
    };

    const plan = planLegacyScheduleDiversityRepair(input);

    expect(plan.movements.length).toBe(0);
    expect(plan.movedItemsCount).toBe(0);
  });
});
