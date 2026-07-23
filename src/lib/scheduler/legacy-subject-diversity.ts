import { createHash } from "crypto";

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

// ── interfaces e Função Pura do Planejador de Reparação ─────────────────────

export interface ScheduleItemSnapshot {
  id: string;
  scheduleId: string;
  subjectId: string;
  studyBlockId?: string | null;
  actionType?: string | null;
  status: string;
  scheduledDate?: string | Date | null;
  dayNumber: number;
  estimatedMinutes?: number | null;
  subjectName?: string;
}

export interface ScheduleSnapshot {
  scheduleId: string;
  updatedAt: string | Date;
  generationMode: string;
  dailyMinutes: number;
  items: ScheduleItemSnapshot[];
}

export interface RepairPlanInput {
  scheduleSnapshot: ScheduleSnapshot;
  userSubjects: Array<{ id: string; name: string; studyPriority: string }>;
  baseDate: string | Date;
}

export interface ItemMovement {
  itemId: string;
  subjectId: string;
  subjectName: string;
  actionType: string;
  originalDate: string;
  newDate: string;
  originalDayNumber: number;
  newDayNumber: number;
  reason: string;
  sameDayRepetitionUnavoidable: boolean;
}

export interface RepairPlan {
  scheduleId: string;
  scheduleUpdatedAt: string;
  generationMode: string;
  baseDate: string;
  totalItemsCount: number;
  preservedItemsCount: number;
  movedItemsCount: number;
  unavoidableRepetitionsCount: number;
  movements: ItemMovement[];
  canonicalPlanHash: string;
}

const TRT4_CYCLE_NAMES = [
  ["trabalho", "português", "portugues"],
  ["processual do trabalho", "processo do trabalho", "administrativo"],
  ["constitucional", "processual civil", "processo civil"],
];

function getCyclePreferredSubjectIds(
  dayNumber: number,
  userSubjects: Array<{ id: string; name: string; studyPriority: string }>
): string[] {
  const cycleIndex = (dayNumber - 1) % 3;
  const targetKeywords = TRT4_CYCLE_NAMES[cycleIndex >= 0 ? cycleIndex : 0];
  return userSubjects
    .filter(s => {
      const nameLower = s.name.toLowerCase();
      return targetKeywords.some(kw => nameLower.includes(kw));
    })
    .map(s => s.id);
}

/**
 * Função pura e determinística que calcula o plano de reparação e o Hash Canônico (SHA-256).
 */
export function planLegacyScheduleDiversityRepair(input: RepairPlanInput): RepairPlan {
  const { scheduleSnapshot, userSubjects, baseDate } = input;

  const scheduleId = scheduleSnapshot.scheduleId;
  const scheduleUpdatedAt = new Date(scheduleSnapshot.updatedAt).toISOString();
  const generationMode = scheduleSnapshot.generationMode;
  const baseDateStr = new Date(baseDate).toISOString().split("T")[0];

  const allItems = [...scheduleSnapshot.items];
  const totalItemsCount = allItems.length;

  const movements: ItemMovement[] = [];
  let unavoidableCount = 0;

  if (generationMode !== "LEGACY_TRT4") {
    // Se não for modo LEGACY_TRT4, retorna plano sem movimentos
    const preservedCount = totalItemsCount;
    const canonicalState = {
      scheduleId,
      scheduleUpdatedAt,
      generationMode,
      baseDate: baseDateStr,
      userSubjects: [...userSubjects].sort((a, b) => a.id.localeCompare(b.id)),
      items: allItems.map(i => ({
        id: i.id,
        subjectId: i.subjectId,
        studyBlockId: i.studyBlockId || null,
        actionType: i.actionType || "THEORY",
        status: i.status,
        scheduledDate: i.scheduledDate ? new Date(i.scheduledDate).toISOString() : null,
        dayNumber: i.dayNumber,
        estimatedMinutes: i.estimatedMinutes || 45,
      })).sort((a, b) => a.id.localeCompare(b.id)),
      movements: [],
    };
    const canonicalJson = JSON.stringify(canonicalState);
    const canonicalPlanHash = createHash("sha256").update(canonicalJson).digest("hex");

    return {
      scheduleId,
      scheduleUpdatedAt,
      generationMode,
      baseDate: baseDateStr,
      totalItemsCount,
      preservedItemsCount: preservedCount,
      movedItemsCount: 0,
      unavoidableRepetitionsCount: 0,
      movements: [],
      canonicalPlanHash,
    };
  }

  // Separar itens preservados vs elegíveis a reorganização
  // Preservados: COMPLETED ou acoes nao-THEORY (FLASHCARDS, SUPPORT, REVIEW)
  const preservedItems = allItems.filter(
    i => i.status === "COMPLETED" || (i.actionType && i.actionType !== "THEORY")
  );
  const eligibleItems = allItems.filter(
    i => i.status !== "COMPLETED" && (!i.actionType || i.actionType === "THEORY")
  );

  const preservedCount = preservedItems.length;

  // Agrupar todos os itens por dia de estudo (dayNumber)
  const daysMap = new Map<number, ScheduleItemSnapshot[]>();
  for (const item of allItems) {
    const existing = daysMap.get(item.dayNumber) || [];
    existing.push(item);
    daysMap.set(item.dayNumber, existing);
  }

  const sortedDayNumbers = Array.from(daysMap.keys()).sort((a, b) => a - b);

  // Rastrear contagem de blocos pendentes por matéria
  // Cada item elegível representa 1 bloco de teoria a ser alocado
  const sortedUserSubjects = [...userSubjects].sort((a, b) => a.id.localeCompare(b.id));
  const pendingCountBySubject = new Map<string, number>();
  for (const sub of sortedUserSubjects) {
    pendingCountBySubject.set(sub.id, 0);
  }
  for (const item of eligibleItems) {
    const current = pendingCountBySubject.get(item.subjectId) || 0;
    pendingCountBySubject.set(item.subjectId, current + 1);
  }

  // Rastrear matérias utilizadas por dia de estudo
  const subjectsByDay = new Map<number, Set<string>>();

  // Preencher matérias já fixadas pelos itens preservados em cada dia
  for (const item of preservedItems) {
    let set = subjectsByDay.get(item.dayNumber);
    if (!set) {
      set = new Set<string>();
      subjectsByDay.set(item.dayNumber, set);
    }
    set.add(item.subjectId);
  }

  // Reorganizar os itens elegíveis dia por dia em ordem cronológica
  for (const dayNum of sortedDayNumbers) {
    const dayItems = daysMap.get(dayNum) || [];
    const dayEligible = dayItems
      .filter(i => i.status !== "COMPLETED" && (!i.actionType || i.actionType === "THEORY"))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (dayEligible.length === 0) continue;

    let sameDaySet = subjectsByDay.get(dayNum);
    if (!sameDaySet) {
      sameDaySet = new Set<string>();
      subjectsByDay.set(dayNum, sameDaySet);
    }

    const prevDaySet = subjectsByDay.get(dayNum - 1) || new Set<string>();
    const preferredSubjectIds = getCyclePreferredSubjectIds(dayNum, sortedUserSubjects);

    for (const item of dayEligible) {
      // Construir candidatos com o saldo atual de blocos pendentes
      const candidates: LegacySubjectCandidate[] = sortedUserSubjects.map(sub => ({
        subjectId: sub.id,
        subjectName: sub.name,
        studyPriority: sub.studyPriority,
        pendingBlocksCount: pendingCountBySubject.get(sub.id) || 0,
      }));

      const selectionResult = selectLegacySubjectCandidate({
        candidates,
        preferredSubjectIds,
        sameDaySubjectIds: sameDaySet,
        previousDaySubjectIds: prevDaySet,
      });

      if (selectionResult.subjectId) {
        const chosenSub = userSubjects.find(s => s.id === selectionResult.subjectId)!;
        // Se a matéria atribuída for diferente da matéria original do item
        if (item.subjectId !== chosenSub.id) {
          const originalSubName = item.subjectName || userSubjects.find(s => s.id === item.subjectId)?.name || item.subjectId;
          const originalIsoDate = item.scheduledDate ? new Date(item.scheduledDate).toISOString() : new Date(baseDateStr).toISOString();

          movements.push({
            itemId: item.id,
            subjectId: chosenSub.id,
            subjectName: chosenSub.name,
            actionType: item.actionType || "THEORY",
            originalDate: originalIsoDate,
            newDate: originalIsoDate,
            originalDayNumber: item.dayNumber,
            newDayNumber: item.dayNumber,
            reason: `Reatribuição de matéria para diversidade (${selectionResult.selectionReason}): de ${originalSubName} para ${chosenSub.name}`,
            sameDayRepetitionUnavoidable: selectionResult.sameDayRepetitionUnavoidable,
          });

          // Atualizar a referência do item no snapshot
          item.subjectId = chosenSub.id;
          item.subjectName = chosenSub.name;
        }

        if (selectionResult.sameDayRepetitionUnavoidable) {
          unavoidableCount++;
        }

        // Marcar matéria como utilizada hoje e deduzir saldo pendente
        sameDaySet.add(chosenSub.id);
        const currentPending = pendingCountBySubject.get(chosenSub.id) || 1;
        pendingCountBySubject.set(chosenSub.id, currentPending - 1);
      }
    }
  }

  // Ordenar movements deterministicamente por itemId
  movements.sort((a, b) => a.itemId.localeCompare(b.itemId));

  // Construir Objeto Canônico Determinístico para Hash
  const canonicalState = {
    scheduleId,
    scheduleUpdatedAt,
    generationMode,
    baseDateStr,
    userSubjects: [...userSubjects].sort((a, b) => a.id.localeCompare(b.id)),
    items: allItems.map(i => ({
      id: i.id,
      subjectId: i.subjectId,
      studyBlockId: i.studyBlockId || null,
      actionType: i.actionType || "THEORY",
      status: i.status,
      scheduledDate: i.scheduledDate ? new Date(i.scheduledDate).toISOString() : null,
      dayNumber: i.dayNumber,
      estimatedMinutes: i.estimatedMinutes || 45,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    movements,
  };

  const canonicalJson = JSON.stringify(canonicalState);
  const canonicalPlanHash = createHash("sha256").update(canonicalJson).digest("hex");

  return {
    scheduleId,
    scheduleUpdatedAt,
    generationMode,
    baseDate: baseDateStr,
    totalItemsCount,
    preservedItemsCount: preservedCount,
    movedItemsCount: movements.length,
    unavoidableRepetitionsCount: unavoidableCount,
    movements,
    canonicalPlanHash,
  };
}
