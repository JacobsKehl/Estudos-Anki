export const LEGACY_TRT4_SUBJECT_SEQUENCE = [
  "Direito do Trabalho",
  "Língua Portuguesa",
  "Direito Processual do Trabalho",
  "Direito Administrativo",
  "Direito Constitucional",
  "Direito Processual Civil",
] as const;

/**
 * Retorna o índice canônico (0 a 5) da matéria na sequência fixa do TRT4.
 * Retorna -1 se a matéria não fizer parte das 6 matérias do ciclo principal.
 */
export function getLegacyTrt4SubjectIndex(subjectName: string): number {
  const name = subjectName.toLowerCase().trim();
  if (name.includes("trabalho") && !name.includes("processo") && !name.includes("processual")) {
    return 0; // Direito do Trabalho
  }
  if (name.includes("português") || name.includes("portugues")) {
    return 1; // Língua Portuguesa
  }
  if (name.includes("processual do trabalho") || name.includes("processo do trabalho")) {
    return 2; // Direito Processual do Trabalho
  }
  if (name.includes("administrativo")) {
    return 3; // Direito Administrativo
  }
  if (name.includes("constitucional")) {
    return 4; // Direito Constitucional
  }
  if (name.includes("processual civil") || name.includes("processo civil")) {
    return 5; // Direito Processual Civil
  }
  return -1;
}

/**
 * Comparador numérico natural para ordenação de PDFs/arquivos (ex: "PDF 2" < "PDF 10").
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Ordena os blocos pendentes de uma matéria priorizando a ordem didática dos PDFs (material)
 * e, em seguida, a ordem interna dos blocos (orderIndex / pageStart).
 */
export function sortPendingBlocksForSubject<T extends Record<string, any>>(blocks: T[]): T[] {
  return [...blocks].sort((a, b) => {
    const matA = a.material;
    const matB = b.material;

    if (matA && matB && matA.id !== matB.id) {
      const orderA = matA.orderIndex ?? matA.materialOrder ?? matA.position;
      const orderB = matB.orderIndex ?? matB.materialOrder ?? matB.position;

      if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
        return orderA - orderB;
      }

      const nameA = matA.fileName || matA.originalFileName || matA.title || "";
      const nameB = matB.fileName || matB.originalFileName || matB.title || "";
      const nameComp = naturalCompare(nameA, nameB);
      if (nameComp !== 0) return nameComp;

      if (matA.createdAt && matB.createdAt) {
        const timeA = new Date(matA.createdAt).getTime();
        const timeB = new Date(matB.createdAt).getTime();
        if (timeA !== timeB) return timeA - timeB;
      }
    }

    const bOrderA = a.orderIndex ?? 0;
    const bOrderB = b.orderIndex ?? 0;
    if (bOrderA !== bOrderB) return bOrderA - bOrderB;

    const pageA = a.pageStart ?? 0;
    const pageB = b.pageStart ?? 0;
    if (pageA !== pageB) return pageA - pageB;

    return 0;
  });
}

export interface SelectNextSubjectsInput {
  userSubjects: Array<{ id: string; name: string }>;
  completedSubjectHistory: string[];
  hasPendingBlocks?: (subjectId: string) => boolean;
  count?: number;
}

export interface SelectedSubjectSlot {
  subjectId: string;
  subjectName: string;
  canonicalIndex: number;
  isFallback: boolean;
}

/**
 * Determina as próximas matérias a serem agendadas segundo a fila circular fixa de 6 matérias
 * baseando-se estritamente nas matérias efetivamente concluídas no histórico (`completedSubjectHistory`).
 */
export function getLegacyTrt4NextSubjects(input: SelectNextSubjectsInput): SelectedSubjectSlot[] {
  const { userSubjects, completedSubjectHistory, hasPendingBlocks, count = 2 } = input;

  // Filtrar apenas matérias do usuário que pertençam à sequência de 6 matérias
  const coreUserSubjects = userSubjects
    .map(s => ({ ...s, canonicalIndex: getLegacyTrt4SubjectIndex(s.name) }))
    .filter(s => s.canonicalIndex >= 0);

  if (coreUserSubjects.length === 0) {
    // Fallback de segurança se o usuário não tiver nenhuma das 6 matérias core
    return userSubjects.slice(0, count).map(s => ({
      subjectId: s.id,
      subjectName: s.name,
      canonicalIndex: -1,
      isFallback: false,
    }));
  }

  const availableCoreIndices = Array.from(new Set(coreUserSubjects.map(s => s.canonicalIndex)));

  // Reconstruir o conjunto de matérias concluídas no ciclo atual
  const currentCycleSet = new Set<number>();
  for (const subjectId of completedSubjectHistory) {
    const matchedSubject = userSubjects.find(s => s.id === subjectId);
    if (matchedSubject) {
      const idx = getLegacyTrt4SubjectIndex(matchedSubject.name);
      if (idx >= 0 && availableCoreIndices.includes(idx)) {
        currentCycleSet.add(idx);
        if (currentCycleSet.size >= availableCoreIndices.length) {
          currentCycleSet.clear();
        }
      }
    }
  }

  const selectedSlots: SelectedSubjectSlot[] = [];
  const simulatedCycleSet = new Set<number>(currentCycleSet);
  let searchPointer = 0;

  for (let slot = 0; slot < count; slot++) {
    let chosenCanonicalIndex = -1;

    // Procura o próximo índice na sequência circular a partir de searchPointer
    for (let offset = 0; offset < 6; offset++) {
      const candidateIndex = (searchPointer + offset) % 6;
      if (availableCoreIndices.includes(candidateIndex) && !simulatedCycleSet.has(candidateIndex)) {
        chosenCanonicalIndex = candidateIndex;
        break;
      }
    }

    // Se todas as matérias ativas já foram concluídas no ciclo simulado, reinicia o ciclo em 0
    if (chosenCanonicalIndex === -1) {
      simulatedCycleSet.clear();
      searchPointer = 0;
      for (let offset = 0; offset < 6; offset++) {
        const candidateIndex = (searchPointer + offset) % 6;
        if (availableCoreIndices.includes(candidateIndex)) {
          chosenCanonicalIndex = candidateIndex;
          break;
        }
      }
    }

    if (chosenCanonicalIndex === -1) break;

    const matchedSubject = coreUserSubjects.find(s => s.canonicalIndex === chosenCanonicalIndex);
    if (!matchedSubject) break;

    const subjectHasBlocks = hasPendingBlocks ? hasPendingBlocks(matchedSubject.id) : true;

    if (subjectHasBlocks) {
      selectedSlots.push({
        subjectId: matchedSubject.id,
        subjectName: matchedSubject.name,
        canonicalIndex: chosenCanonicalIndex,
        isFallback: false,
      });
      simulatedCycleSet.add(chosenCanonicalIndex);
      if (simulatedCycleSet.size >= availableCoreIndices.length) {
        simulatedCycleSet.clear();
        searchPointer = 0;
      } else {
        searchPointer = (chosenCanonicalIndex + 1) % 6;
      }
    } else {
      // Fallback temporário: avançar na fila até achar uma matéria com blocos pendentes
      let fallbackCanonicalIndex = -1;
      for (let offset = 1; offset < 6; offset++) {
        const nextCand = (chosenCanonicalIndex + offset) % 6;
        if (availableCoreIndices.includes(nextCand)) {
          const nextSub = coreUserSubjects.find(s => s.canonicalIndex === nextCand);
          if (nextSub && (hasPendingBlocks ? hasPendingBlocks(nextSub.id) : true)) {
            fallbackCanonicalIndex = nextCand;
            break;
          }
        }
      }

      if (fallbackCanonicalIndex !== -1) {
        const fallbackSub = coreUserSubjects.find(s => s.canonicalIndex === fallbackCanonicalIndex)!;
        selectedSlots.push({
          subjectId: fallbackSub.id,
          subjectName: fallbackSub.name,
          canonicalIndex: fallbackCanonicalIndex,
          isFallback: true,
        });
        // IMPORTANTE: NÃO marcamos a matéria pulada (chosenCanonicalIndex) como concluída!
      } else {
        // Sem alternativa
        selectedSlots.push({
          subjectId: matchedSubject.id,
          subjectName: matchedSubject.name,
          canonicalIndex: chosenCanonicalIndex,
          isFallback: false,
        });
      }
      searchPointer = (chosenCanonicalIndex + 1) % 6;
    }
  }

  return selectedSlots;
}
