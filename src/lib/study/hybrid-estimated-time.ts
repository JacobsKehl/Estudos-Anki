/**
 * src/lib/study/hybrid-estimated-time.ts
 *
 * Cálculo puro do tempo estimado de estudo para blocos HYBRID_8020.
 *
 * Regra determinística:
 *   readingMinutes = ceil(totalReadWords / wordsPerMinute)
 *   methodMinimum  = anchorMinimumMinutes + deepeningMinimumMinutes
 *   rawMinutes     = max(readingMinutes, methodMinimum)
 *   finalMinutes   = clamp(rawMinutes, minimumBlockMinutes, availableMinutes)
 *
 * Apenas segmentos READ entram no cálculo.
 * CONSULT, SKIP e páginas não analisadas são ignorados.
 */

export interface HybridTimeInput {
  /** Palavras de todos os segmentos READ do CFC */
  cfcReadWords: number;
  /** Palavras de todos os segmentos READ de todos os materiais de aprofundamento */
  deepeningReadWords: number;
  /** Minutos disponíveis informados pelo usuário (teto absoluto) */
  availableMinutes: number;
  /** Configurações opcionais — valores default se não fornecidos */
  config?: HybridTimeConfig;
}

export interface HybridTimeConfig {
  /** Palavras por minuto de leitura. Default: 150 */
  wordsPerMinute?: number;
  /** Tempo mínimo obrigatório para ancoragem CFC. Default: 15 */
  anchorMinimumMinutes?: number;
  /** Tempo mínimo obrigatório para aprofundamento. Default: 30 */
  deepeningMinimumMinutes?: number;
  /** Tempo mínimo total de qualquer bloco de estudo. Default: 30 */
  minimumBlockMinutes?: number;
}

export interface HybridTimeResult {
  /** Tempo final persistido em estimatedStudyMinutes */
  finalMinutes: number;
  /** Auditoria para aiAuditMetadata */
  audit: {
    totalReadWords: number;
    wordsPerMinute: number;
    readingMinutes: number;
    anchorMinimumMinutes: number;
    deepeningMinimumMinutes: number;
    methodMinimum: number;
    rawMinutes: number;
    availableMinutes: number;
    minimumBlockMinutes: number;
    finalMinutes: number;
    roundingRule: string;
  };
}

export interface HybridTimeValidationError {
  error: string;
  code: "AVAILABLE_MINUTES_TOO_LOW" | "NEGATIVE_WORDS" | "INVALID_CONFIG";
}

/**
 * Calcula o tempo estimado de estudo para um bloco híbrido.
 * Retorna um erro de validação se as pré-condições não forem atendidas.
 */
export function calculateHybridMinutes(
  input: HybridTimeInput
): HybridTimeResult | HybridTimeValidationError {
  const {
    cfcReadWords,
    deepeningReadWords,
    availableMinutes,
    config = {},
  } = input;

  const wordsPerMinute = config.wordsPerMinute ?? 150;
  const anchorMinimumMinutes = config.anchorMinimumMinutes ?? 15;
  const deepeningMinimumMinutes = config.deepeningMinimumMinutes ?? 30;
  const minimumBlockMinutes = config.minimumBlockMinutes ?? 30;

  // Validações de pré-condição
  if (cfcReadWords < 0 || deepeningReadWords < 0) {
    return {
      error: "Contagem de palavras não pode ser negativa.",
      code: "NEGATIVE_WORDS",
    };
  }

  if (wordsPerMinute <= 0 || anchorMinimumMinutes < 0 || deepeningMinimumMinutes < 0 || minimumBlockMinutes < 0) {
    return {
      error: "Configuração de tempo inválida: valores devem ser não-negativos and wordsPerMinute > 0.",
      code: "INVALID_CONFIG",
    };
  }

  if (availableMinutes < minimumBlockMinutes) {
    return {
      error: `availableMinutes (${availableMinutes}) deve ser >= minimumBlockMinutes (${minimumBlockMinutes}).`,
      code: "AVAILABLE_MINUTES_TOO_LOW",
    };
  }

  const totalReadWords = cfcReadWords + deepeningReadWords;
  const readingMinutes = Math.ceil(totalReadWords / wordsPerMinute);
  const methodMinimum = anchorMinimumMinutes + deepeningMinimumMinutes;
  const rawMinutes = Math.max(readingMinutes, methodMinimum);

  // clamp entre minimumBlockMinutes e availableMinutes
  const finalMinutes = Math.min(Math.max(rawMinutes, minimumBlockMinutes), availableMinutes);

  return {
    finalMinutes,
    audit: {
      totalReadWords,
      wordsPerMinute,
      readingMinutes,
      anchorMinimumMinutes,
      deepeningMinimumMinutes,
      methodMinimum,
      rawMinutes,
      availableMinutes,
      minimumBlockMinutes,
      finalMinutes,
      roundingRule: "Math.ceil(words / wordsPerMinute), clamp(min, max)",
    },
  };
}

/** Type guard para diferenciar resultado de erro */
export function isHybridTimeError(
  result: HybridTimeResult | HybridTimeValidationError
): result is HybridTimeValidationError {
  return "error" in result && "code" in result;
}
