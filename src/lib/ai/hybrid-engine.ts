/**
 * src/lib/ai/hybrid-engine.ts
 *
 * Engine pura para geração de blocos híbridos 80/20.
 *
 * IMPORTANTE:
 *   - Esta função não executa Prisma.
 *   - Esta função não salva arquivos.
 *   - Esta função não modifica cronograma.
 *   - O provider de IA é injetado como dependência para facilitar testes mockados.
 *
 * Pipeline de 4 etapas:
 *   A — Page Mapping: índice de tópicos por página
 *   B — Candidate Retrieval: páginas candidatas via CFC como âncora
 *   C — Deep Analysis: cruzamento e classificação READ/CONSULT/SKIP
 *   D — Reconciliation & Validation: fusão, validação e finalização
 */

export interface HybridInputMaterial {
  id: string;
  fileName: string;
  /** Provider validado pelo servidor — nunca confiado do cliente */
  provider: "CFC" | "ESTRATEGIA";
  /** Total de páginas do PDF — validado pelo servidor */
  totalPages: number;
  textByPage: {
    pageNumber: number;
    text: string;
  }[];
}

export interface HybridBatchConfig {
  /** Limite primário por lote */
  maxInputTokensPerBatch: number;
  /** Limite secundário por lote */
  maxCharactersPerBatch: number;
  /** Proteção absoluta de páginas por lote */
  maxPagesPerBatch: number;
}

export const DEFAULT_BATCH_CONFIG: HybridBatchConfig = {
  maxInputTokensPerBatch: 12_000,
  maxCharactersPerBatch: 50_000,
  maxPagesPerBatch: 12,
};

export interface HybridBlockInput {
  /** Criado pelo cliente ANTES da chamada; reutilizado em retries */
  generationRunId: string;
  subject: string;
  targetTheme: string;
  cfcMaterial: HybridInputMaterial;
  /** Suporta múltiplos materiais de aprofundamento */
  estrategiaMaterials: HybridInputMaterial[];
  examProfile: "FCC";
  goal: string;
  availableMinutes: number;
  batchConfig?: Partial<HybridBatchConfig>;
  aiConfig: {
    provider: string;
    model: string;
    promptVersion: string;
  };
}

export interface HybridSegmentSeed {
  disposition: "READ" | "CONSULT" | "SKIP";
  pageStart: number;
  pageEnd: number;
  reason: string;
}

export interface HybridSourceSeed {
  materialId: string;
  fileName: string;
  sourceRole: "ANCHOR_8020" | "DEEPENING";
  /** ANCHOR_8020 SEMPRE false. Exatamente um DEEPENING = true. */
  isCanonical: boolean;
  selectionReason: string;
  confidence: number | null;
  orderIndex: number;
  segments: HybridSegmentSeed[];
}

export interface HybridFlashcardSeed {
  question: string;
  answer: string;
  type: "CLOZE" | "QUESTION_ANSWER";
  sourceMaterialId: string;
  /** Gerado exclusivamente de segmento READ */
  sourcePageStart: number;
  /** Gerado exclusivamente de segmento READ */
  sourcePageEnd: number;
  /** Obrigatório — nunca null */
  generationReason: string;
}

export interface HybridBlockOutput {
  generationRunId: string;
  subject: string;
  title: string;
  methodology: "HYBRID_8020";
  confidence: number | null;
  warnings: string[];
  blockingWarnings: string[];

  sources: HybridSourceSeed[];
  fccFocusPoints: string[];
  flashcardSeeds: HybridFlashcardSeed[];

  aiAuditMetadata: {
    provider: string;
    modelUsed: string;
    promptVersion: string;
    generatedAt: string;
    generationRunId: string;
    confidence: number | null;
    warnings: string[];
    blockingWarnings: string[];
    batchConfig: HybridBatchConfig;
    analyzedScope: {
      cfcMaterialId: string;
      cfcPageNumbers: number[];
      deepeningMaterials: {
        materialId: string;
        pageNumbers: number[];
      }[];
    };
    sourceFingerprintCfc: string;
    /** Ordenado por materialId antes de calcular hash/assinar */
    sourceFingerprintsDeepening: {
      materialId: string;
      fingerprint: string;
    }[];
    justification: {
      anchorChoice: string;
      deepeningChoice: string;
    };
  };
}

export interface HybridMappedPage {
  materialId: string;
  pageNumber: number;
  topics: string[];
  summary: string;
}

export interface HybridCandidatePage {
  materialId: string;
  pageNumber: number;
}

export interface HybridProviderMetadata {
  provider: string;
  model: string;
  promptVersion: string;
}

/** Interface para o provider de IA — injetável para mocks nos testes */
export interface HybridAIProvider {
  /** Metadados imutáveis do provider (Fase 2) */
  getMetadata(): HybridProviderMetadata;

  /**
   * Etapa A: Mapeia tópicos e cria índice por página.
   * Recebe lotes; nunca o material completo em uma chamada.
   */
  mapPages(params: {
    materialId: string;
    pages: { pageNumber: number; text: string }[];
    batchConfig: HybridBatchConfig;
  }): Promise<{ pageNumber: number; topics: string[]; summary: string }[]>;

  /**
   * Etapa B: Identifica páginas candidatas no Estratégia usando o CFC como âncora.
   */
  retrieveCandidates(params: {
    cfcAnchorPoints: string[];
    estrategiaMappedPages: HybridMappedPage[];
    targetTheme: string;
    examProfile: string;
  }): Promise<HybridCandidatePage[]>;

  /**
   * Etapa C: Análise profunda e classificação READ/CONSULT/SKIP.
   * Recebe somente as páginas candidatas da Etapa B.
   * Flashcard seeds gerados exclusivamente de segmentos READ.
   */
  deepAnalysis(params: {
    cfcPages: { pageNumber: number; text: string }[];
    estrategiaPages: { materialId: string; pageNumber: number; text: string }[];
    targetTheme: string;
    examProfile: string;
    goal: string;
    batchConfig: HybridBatchConfig;
  }): Promise<{
    sources: HybridSourceSeed[];
    fccFocusPoints: string[];
    flashcardSeeds: HybridFlashcardSeed[];
    confidence: number | null;
    justification: { anchorChoice: string; deepeningChoice: string };
  }>;
}

// ─── Validações internas ───────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Valida o input da engine antes de qualquer processamento.
 * Retorna lista de erros (vazia = válido).
 */
export function validateHybridInput(input: HybridBlockInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.generationRunId || input.generationRunId.trim() === "") {
    errors.push({ field: "generationRunId", message: "generationRunId é obrigatório" });
  }

  // Validar CFC
  if (input.cfcMaterial.provider !== "CFC") {
    errors.push({ field: "cfcMaterial.provider", message: "cfcMaterial.provider deve ser 'CFC'" });
  }
  errors.push(...validateMaterialPages(input.cfcMaterial, "cfcMaterial"));

  // Validar Estratégia
  if (input.estrategiaMaterials.length === 0) {
    errors.push({ field: "estrategiaMaterials", message: "Ao menos um material de aprofundamento é obrigatório" });
  }
  for (const [i, m] of input.estrategiaMaterials.entries()) {
    if (m.provider !== "ESTRATEGIA") {
      errors.push({
        field: `estrategiaMaterials[${i}].provider`,
        message: `estrategiaMaterials[${i}].provider deve ser 'ESTRATEGIA'`,
      });
    }
    errors.push(...validateMaterialPages(m, `estrategiaMaterials[${i}]`));
  }

  if (input.availableMinutes <= 0) {
    errors.push({ field: "availableMinutes", message: "availableMinutes deve ser positivo" });
  }

  return errors;
}

function validateMaterialPages(
  material: HybridInputMaterial,
  prefix: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (material.totalPages <= 0) {
    errors.push({ field: `${prefix}.totalPages`, message: "totalPages deve ser positivo" });
  }

  const seenPages = new Set<number>();
  for (const page of material.textByPage) {
    if (page.pageNumber <= 0) {
      errors.push({
        field: `${prefix}.textByPage`,
        message: `pageNumber deve ser > 0 (encontrado: ${page.pageNumber})`,
      });
    }
    if (page.pageNumber > material.totalPages) {
      errors.push({
        field: `${prefix}.textByPage`,
        message: `pageNumber ${page.pageNumber} excede totalPages ${material.totalPages}`,
      });
    }
    if (seenPages.has(page.pageNumber)) {
      errors.push({
        field: `${prefix}.textByPage`,
        message: `Página duplicada: ${page.pageNumber}`,
      });
    }
    seenPages.add(page.pageNumber);
  }

  return errors;
}

/**
 * Valida o output gerado pela IA antes da etapa de reconciliação.
 */
export function validateHybridOutput(
  output: Pick<HybridBlockOutput, "sources" | "flashcardSeeds" | "confidence">,
  _analyzedScope: { cfcPageNumbers: number[]; deepeningMaterials: { materialId: string; pageNumbers: number[] }[] }
): ValidationError[] {
  const errors: ValidationError[] = [];
  void _analyzedScope;

  const anchors = output.sources.filter((s) => s.sourceRole === "ANCHOR_8020");
  const deepenings = output.sources.filter((s) => s.sourceRole === "DEEPENING");

  // Exatamente um ANCHOR_8020
  if (anchors.length !== 1) {
    errors.push({ field: "sources", message: `Deve haver exatamente 1 ANCHOR_8020, encontrado: ${anchors.length}` });
  }

  // ANCHOR nunca canônico
  for (const a of anchors) {
    if (a.isCanonical) {
      errors.push({ field: "sources", message: "ANCHOR_8020 não pode ter isCanonical = true" });
    }
  }

  // Ao menos um DEEPENING
  if (deepenings.length === 0) {
    errors.push({ field: "sources", message: "Ao menos um DEEPENING é obrigatório" });
  }

  // Exatamente um DEEPENING canônico
  const canonicals = deepenings.filter((d) => d.isCanonical);
  if (canonicals.length !== 1) {
    errors.push({
      field: "sources",
      message: `Deve haver exatamente 1 DEEPENING com isCanonical=true, encontrado: ${canonicals.length}`,
    });
  }

  // Confidence
  if (output.confidence !== null && (output.confidence < 0 || output.confidence > 1)) {
    errors.push({ field: "confidence", message: "confidence deve estar em [0, 1] ou ser null" });
  }

  // Validar segmentos
  for (const [si, source] of output.sources.entries()) {
    const pageNumbers = new Map<number, string[]>();

    for (const seg of source.segments) {
      if (seg.pageStart <= 0) {
        errors.push({ field: `sources[${si}].segments`, message: `pageStart deve ser > 0` });
      }
      if (seg.pageEnd < seg.pageStart) {
        errors.push({ field: `sources[${si}].segments`, message: `pageEnd deve ser >= pageStart` });
      }
      // Detectar páginas com múltiplas disposições
      for (let p = seg.pageStart; p <= seg.pageEnd; p++) {
        const existing = pageNumbers.get(p) ?? [];
        existing.push(seg.disposition);
        pageNumbers.set(p, existing);
      }
    }

    for (const [page, dispositions] of pageNumbers.entries()) {
      if (dispositions.length > 1) {
        errors.push({
          field: `sources[${si}].segments`,
          message: `Página ${page} tem múltiplas disposições: ${dispositions.join(", ")}`,
        });
      }
    }
  }

  // Flashcards devem vir exclusivamente de READ
  for (const [fi, fc] of output.flashcardSeeds.entries()) {
    if (!fc.generationReason || fc.generationReason.trim() === "") {
      errors.push({ field: `flashcardSeeds[${fi}].generationReason`, message: "generationReason é obrigatório" });
    }
    if (fc.sourcePageStart <= 0) {
      errors.push({ field: `flashcardSeeds[${fi}].sourcePageStart`, message: "sourcePageStart deve ser > 0" });
    }
    if (fc.sourcePageEnd < fc.sourcePageStart) {
      errors.push({ field: `flashcardSeeds[${fi}].sourcePageEnd`, message: "sourcePageEnd deve ser >= sourcePageStart" });
    }

    // Verificar se as páginas de origem estão em um segmento READ da fonte correta
    const sourceForCard = output.sources.find((s) => s.materialId === fc.sourceMaterialId);
    if (!sourceForCard) {
      errors.push({
        field: `flashcardSeeds[${fi}].sourceMaterialId`,
        message: `Flashcard referencia material desconhecido: ${fc.sourceMaterialId}`,
      });
      continue;
    }

    const isFromRead = sourceForCard.segments.some(
      (seg) =>
        seg.disposition === "READ" &&
        seg.pageStart <= fc.sourcePageStart &&
        seg.pageEnd >= fc.sourcePageEnd
    );

    if (!isFromRead) {
      errors.push({
        field: `flashcardSeeds[${fi}]`,
        message: `Flashcard em pág ${fc.sourcePageStart}-${fc.sourcePageEnd} não está em segmento READ do material ${fc.sourceMaterialId}`,
      });
    }
  }

  return errors;
}

// ─── Utilitários de reconciliação ─────────────────────────────────────────────

/**
 * Funde segmentos adjacentes e contíguos com a mesma disposição.
 * Ex: [5,7 READ] + [8,10 READ] → [5,10 READ]
 */
export function mergeAdjacentSegments(segments: HybridSegmentSeed[]): HybridSegmentSeed[] {
  if (segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) =>
    a.disposition !== b.disposition
      ? a.disposition.localeCompare(b.disposition)
      : a.pageStart - b.pageStart
  );

  const merged: HybridSegmentSeed[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (
      current.disposition === last.disposition &&
      current.pageStart <= last.pageEnd + 1
    ) {
      last.pageEnd = Math.max(last.pageEnd, current.pageEnd);
      if (current.reason && !last.reason?.includes(current.reason)) {
        last.reason = last.reason ? `${last.reason}; ${current.reason}` : current.reason;
      }
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Calcula o envelope legado (pageStart, pageEnd) do bloco a partir
 * dos segmentos READ do DEEPENING canônico.
 * Retorna null se não houver segmento READ no DEEPENING canônico.
 */
export function computeLegacyEnvelope(
  sources: HybridSourceSeed[]
): { pageStart: number; pageEnd: number } | null {
  const canonical = sources.find((s) => s.sourceRole === "DEEPENING" && s.isCanonical);
  if (!canonical) return null;

  const readSegments = canonical.segments.filter((s) => s.disposition === "READ");
  if (readSegments.length === 0) return null;

  const pageStart = Math.min(...readSegments.map((s) => s.pageStart));
  const pageEnd = Math.max(...readSegments.map((s) => s.pageEnd));
  return { pageStart, pageEnd };
}
