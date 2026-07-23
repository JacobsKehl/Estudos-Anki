
export interface LegacySubjectCandidate {
  subjectId: string;
  subjectName: string;
  studyPriority: string;
  pendingBlocksCount: number;
  score?: number;
  orderIndex?: number;
}

export interface SelectLegacySubjectInput {
  candidates: LegacySubjectCandidate[];
  preferredSubjectIds: string[];
  sameDaySubjectIds: ReadonlySet<string>;
  previousDaySubjectIds: ReadonlySet<string>;
}

export interface SelectLegacySubjectResult {
  subjectId: string | null;
  diversityFallbackUsed: boolean;
  sameDayRepetitionUnavoidable: boolean;
  selectionReason:
    | "PREFERRED_NEW_TODAY"
    | "ALTERNATIVE_NEW_TODAY"
    | "PREFERRED_REPEATED_UNAVOIDABLE"
    | "ANY_REPEATED_UNAVOIDABLE"
    | "NO_CANDIDATE";
}

const PRIORITY_RANK: Record<string, number> = {
  PRIMARY: 3,
  ACTIVE: 2,
  SECONDARY: 1,
  EXCLUDED: 0,
};

function sortCandidates(
  candidates: LegacySubjectCandidate[],
  previousDaySubjectIds: ReadonlySet<string>
): LegacySubjectCandidate[] {
  return [...candidates].sort((a, b) => {
    // 1. Evitar preferencialmente a matéria do dia anterior
    const prevA = previousDaySubjectIds.has(a.subjectId) ? 1 : 0;
    const prevB = previousDaySubjectIds.has(b.subjectId) ? 1 : 0;
    if (prevA !== prevB) return prevA - prevB;

    // 2. Pontuação/Score se fornecido (maior primeiro)
    if (a.score !== undefined && b.score !== undefined && a.score !== b.score) {
      return b.score - a.score;
    }

    // 3. Prioridade (PRIMARY > ACTIVE > SECONDARY)
    const pA = PRIORITY_RANK[a.studyPriority] ?? 0;
    const pB = PRIORITY_RANK[b.studyPriority] ?? 0;
    if (pA !== pB) return pB - pA;

    // 4. Ordem se fornecida
    if (a.orderIndex !== undefined && b.orderIndex !== undefined && a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }

    // 5. Desempate determinístico por ID
    return a.subjectId.localeCompare(b.subjectId);
  });
}

/**
 * Função pura e determinística de seleção de matéria para o modo LEGACY_TRT4.
 *
 * Hierarquia de decisão:
 * 1. Matéria do ciclo, com bloco pendente, ainda não utilizada hoje;
 * 2. Outra matéria com bloco pendente, ainda não utilizada hoje;
 * 3. Matéria do ciclo utilizada hoje, somente sem alternativa distinta;
 * 4. Qualquer matéria utilizada hoje, somente sem alternativa distinta.
 */
export function selectLegacySubjectCandidate(
  input: SelectLegacySubjectInput
): SelectLegacySubjectResult {
  const { candidates, preferredSubjectIds, sameDaySubjectIds, previousDaySubjectIds } = input;

  const validCandidates = candidates.filter(c => c.pendingBlocksCount > 0);

  if (validCandidates.length === 0) {
    return {
      subjectId: null,
      diversityFallbackUsed: false,
      sameDayRepetitionUnavoidable: false,
      selectionReason: "NO_CANDIDATE",
    };
  }

  // 1. Matéria do ciclo, ainda não usada hoje
  const preferredNewToday = validCandidates.filter(
    c => preferredSubjectIds.includes(c.subjectId) && !sameDaySubjectIds.has(c.subjectId)
  );

  if (preferredNewToday.length > 0) {
    const sorted = sortCandidates(preferredNewToday, previousDaySubjectIds);
    return {
      subjectId: sorted[0].subjectId,
      diversityFallbackUsed: false,
      sameDayRepetitionUnavoidable: false,
      selectionReason: "PREFERRED_NEW_TODAY",
    };
  }

  // 2. Outra matéria com bloco pendente, ainda não usada hoje
  const alternativeNewToday = validCandidates.filter(c => !sameDaySubjectIds.has(c.subjectId));

  if (alternativeNewToday.length > 0) {
    const sorted = sortCandidates(alternativeNewToday, previousDaySubjectIds);
    return {
      subjectId: sorted[0].subjectId,
      diversityFallbackUsed: true,
      sameDayRepetitionUnavoidable: false,
      selectionReason: "ALTERNATIVE_NEW_TODAY",
    };
  }

  // 3. Matéria do ciclo já utilizada hoje (apenas quando não há alternativa distinta)
  const preferredRepeated = validCandidates.filter(c => preferredSubjectIds.includes(c.subjectId));

  if (preferredRepeated.length > 0) {
    const sorted = sortCandidates(preferredRepeated, previousDaySubjectIds);
    return {
      subjectId: sorted[0].subjectId,
      diversityFallbackUsed: true,
      sameDayRepetitionUnavoidable: true,
      selectionReason: "PREFERRED_REPEATED_UNAVOIDABLE",
    };
  }

  // 4. Qualquer matéria já utilizada hoje (último recurso)
  const sortedAll = sortCandidates(validCandidates, previousDaySubjectIds);
  return {
    subjectId: sortedAll[0].subjectId,
    diversityFallbackUsed: true,
    sameDayRepetitionUnavoidable: true,
    selectionReason: "ANY_REPEATED_UNAVOIDABLE",
  };
}
