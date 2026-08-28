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
  /** Máximo de blocos de teoria por dia (hard cap) */
  maxTheoryBlocksPerDay: 4,
  /** Alias para número máximo de novas teorias por dia */
  maxNewTheoryPerDay: 4,
  /** Dias da semana sem teoria (0 = Domingo) */
  noTheoryDays: [0] as readonly number[],
} as const;
