/**
 * src/lib/study/estimated-time.ts
 *
 * Módulo neutro para cálculo de tempo estimado de estudo.
 * Reaproveitável no dimensionamento de blocos e projeção de conclusão do edital.
 */

export interface ReadingTimeInput {
  /** Total de palavras a serem lidas */
  totalWords?: number;
  /** Total de páginas */
  totalPages?: number;
  /** Palavras por minuto (PPM). Default: 150 */
  wordsPerMinute?: number;
  /** Minutos por página (se palavras não fornecidas). Default: 3 */
  minutesPerPage?: number;
  /** Tempo mínimo do bloco (minutos). Default: 30 */
  minimumBlockMinutes?: number;
  /** Teto máximo disponível (minutos) */
  availableMinutes?: number;
}

export interface ReadingTimeResult {
  estimatedMinutes: number;
  calculationMethod: "WORDS" | "PAGES" | "DEFAULT";
}

/**
 * Calcula o tempo estimado de leitura/estudo em minutos.
 */
export function calculateEstimatedStudyMinutes(input: ReadingTimeInput): ReadingTimeResult {
  const wordsPerMinute = input.wordsPerMinute ?? 150;
  const minutesPerPage = input.minutesPerPage ?? 3;
  const minimumBlockMinutes = input.minimumBlockMinutes ?? 30;

  let rawMinutes = minimumBlockMinutes;
  let method: "WORDS" | "PAGES" | "DEFAULT" = "DEFAULT";

  if (input.totalWords && input.totalWords > 0) {
    rawMinutes = Math.ceil(input.totalWords / wordsPerMinute);
    method = "WORDS";
  } else if (input.totalPages && input.totalPages > 0) {
    rawMinutes = Math.ceil(input.totalPages * minutesPerPage);
    method = "PAGES";
  }

  let finalMinutes = Math.max(rawMinutes, minimumBlockMinutes);

  if (input.availableMinutes && input.availableMinutes > 0) {
    finalMinutes = Math.min(finalMinutes, input.availableMinutes);
  }

  return {
    estimatedMinutes: finalMinutes,
    calculationMethod: method,
  };
}
