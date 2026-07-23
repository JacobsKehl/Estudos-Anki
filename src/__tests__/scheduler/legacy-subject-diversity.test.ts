import {
  selectLegacySubjectCandidate,
  LegacySubjectCandidate,
  SelectLegacySubjectInput,
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

  // ── Testes de Regressão: Prioridade Intra-Dia ────────────────────────────────

  describe("Regressão — prioridade intra-dia: evitar repetição hoje > evitar repetição ontem", () => {
    /**
     * Cenário: A foi estudada hoje, B foi estudada ontem.
     * Candidatos disponíveis: A (usada hoje) e B (usada ontem) e C (nova).
     * Regra esperada: C deve ser escolhida (nova hoje, nova ontem).
     */
    test("R1. Prefere matéria nova (não usada hoje nem ontem) antes de repetir qualquer anterior", () => {
      const aCandidate: LegacySubjectCandidate = {
        subjectId: "sub-a",
        subjectName: "Matéria A",
        studyPriority: "PRIMARY",
        pendingBlocksCount: 3,
      };
      const bCandidate: LegacySubjectCandidate = {
        subjectId: "sub-b",
        subjectName: "Matéria B",
        studyPriority: "PRIMARY",
        pendingBlocksCount: 3,
      };
      const cCandidate: LegacySubjectCandidate = {
        subjectId: "sub-c",
        subjectName: "Matéria C",
        studyPriority: "PRIMARY",
        pendingBlocksCount: 3,
      };

      const input: SelectLegacySubjectInput = {
        candidates: [aCandidate, bCandidate, cCandidate],
        preferredSubjectIds: [],
        sameDaySubjectIds: new Set(["sub-a"]), // A já usada hoje
        previousDaySubjectIds: new Set(["sub-b"]), // B usada ontem
      };

      const result = selectLegacySubjectCandidate(input);

      // C é a única nova hoje e nova ontem — deve ser escolhida
      expect(result.subjectId).toBe("sub-c");
      expect(result.sameDayRepetitionUnavoidable).toBe(false);
    });

    /**
     * Cenário: A foi estudada hoje. B foi estudada ontem. C não existe.
     * Entre A e B, B deve ser preferida (ainda não usada hoje).
     */
    test("R2. Entre matéria usada hoje e matéria usada ontem (mas não hoje), prefere a usada ontem", () => {
      const aCandidate: LegacySubjectCandidate = {
        subjectId: "sub-a",
        subjectName: "Matéria A",
        studyPriority: "PRIMARY",
        pendingBlocksCount: 3,
      };
      const bCandidate: LegacySubjectCandidate = {
        subjectId: "sub-b",
        subjectName: "Matéria B",
        studyPriority: "PRIMARY",
        pendingBlocksCount: 3,
      };

      const input: SelectLegacySubjectInput = {
        candidates: [aCandidate, bCandidate],
        preferredSubjectIds: [],
        sameDaySubjectIds: new Set(["sub-a"]), // A já usada hoje
        previousDaySubjectIds: new Set(["sub-b"]), // B usada ontem
      };

      const result = selectLegacySubjectCandidate(input);

      // B é nova hoje (apenas usada ontem) — prioridade sobre repetir A hoje
      expect(result.subjectId).toBe("sub-b");
      expect(result.sameDayRepetitionUnavoidable).toBe(false);
    });

    /**
     * Cenário crítico de regressão: A usada hoje, B usada ontem, sem C.
     * Repetir hoje (A) só é aceitável quando não há nenhuma alternativa não usada hoje.
     */
    test("R3. sameDayRepetitionUnavoidable é true apenas quando todas as matérias com blocos já foram usadas hoje", () => {
      const aCandidate: LegacySubjectCandidate = {
        subjectId: "sub-a",
        subjectName: "Matéria A",
        studyPriority: "PRIMARY",
        pendingBlocksCount: 3,
      };
      const bCandidate: LegacySubjectCandidate = {
        subjectId: "sub-b",
        subjectName: "Matéria B",
        studyPriority: "PRIMARY",
        pendingBlocksCount: 0, // sem blocos — não é candidata real
      };

      const input: SelectLegacySubjectInput = {
        candidates: [aCandidate, bCandidate],
        preferredSubjectIds: [],
        sameDaySubjectIds: new Set(["sub-a"]),
        previousDaySubjectIds: new Set(["sub-b"]),
      };

      const result = selectLegacySubjectCandidate(input);

      // A é a única com blocos — repetição inevitável
      expect(result.subjectId).toBe("sub-a");
      expect(result.sameDayRepetitionUnavoidable).toBe(true);
    });

    /**
     * Garante que `sameDaySubjectIds` é checado antes de `previousDaySubjectIds`.
     * C está livre. C deve ser escolhida antes de B (usada ontem) e A (usada hoje+ontem).
     */
    test("R4. Prioridade: nova hoje E nova ontem > nova hoje mas usada ontem > usada hoje", () => {
      const aCandidate: LegacySubjectCandidate = {
        subjectId: "sub-a",
        subjectName: "Matéria A",
        studyPriority: "PRIMARY",
        pendingBlocksCount: 3,
      };
      const bCandidate: LegacySubjectCandidate = {
        subjectId: "sub-b",
        subjectName: "Matéria B",
        studyPriority: "PRIMARY",
        pendingBlocksCount: 3,
      };
      const cCandidate: LegacySubjectCandidate = {
        subjectId: "sub-c",
        subjectName: "Matéria C",
        studyPriority: "PRIMARY",
        pendingBlocksCount: 3,
      };

      const input: SelectLegacySubjectInput = {
        candidates: [aCandidate, bCandidate, cCandidate],
        preferredSubjectIds: [],
        sameDaySubjectIds: new Set(["sub-a"]), // A usada hoje
        previousDaySubjectIds: new Set(["sub-a", "sub-b"]), // A e B usadas ontem
      };

      const result = selectLegacySubjectCandidate(input);

      // C: nova hoje E nova ontem — máxima preferência
      expect(result.subjectId).toBe("sub-c");
      expect(result.sameDayRepetitionUnavoidable).toBe(false);
    });
  });
});
