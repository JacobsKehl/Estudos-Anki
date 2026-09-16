/**
 * src/lib/scheduler/config.ts
 *
 * Configurações canônicas do agendador e limites operacionais.
 */

export const ORDEM_MATERIAS = [
  "Direito do Trabalho",
  "Direito Processual do Trabalho",
  "Direito Administrativo",
  "Direito Constitucional",
  "Direito Processual Civil",
] as const;

export const CFC_FILE_NAMES = [
  "1 - Direito Administrativo_compressed.pdf",
  "2 - Direito do Trabalho.pdf",
  "3 - Direito Constitucional.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "Direito Processual Civil_compressed.pdf",
] as const;

export const SCHEDULER_LIMITS = {
  /** Cota diária de teoria em minutos — soma estimatedStudyMinutes até este teto */
  dailyTheoryMinutesTarget: 45,
  /** Mínimo de minutos no dia se houver bloco disponível */
  dailyTheoryMinutesFloor: 30,
  /** Teto de minutos de teoria por dia — nunca ultrapassar */
  dailyTheoryMinutesCeil: 60,
  /** Máximo de blocos de teoria por dia (hard cap, cobre obrigatórias + preenchimento) */
  maxTheoryBlocksPerDay: 4,
  /** Quantas matérias obrigatórias do ciclo TRT4 entram por dia, sempre, antes do
   *  preenchimento por piso/alvo/teto. Era 4 (divergia do comentário histórico em
   *  scheduler.ts, "cota = 2 MANDA", e do default de adaptive-scheduler.ts). */
  maxNewTheoryPerDay: 2,
  /** Dias da semana sem teoria (0 = Domingo) */
  noTheoryDays: [0] as readonly number[],
} as const;

export const SRS_LIMITS = {
  /** Teto diário da fila de revisão SRS — os mais atrasados primeiro. Não reescreve nextReviewAt. */
  maxReviewsPerDay: 100,
} as const;
