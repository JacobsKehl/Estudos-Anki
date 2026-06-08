export const SUBJECT_PRIORITY_LABELS = {
  PRIMARY: "Alta",
  ACTIVE: "Média",
  SECONDARY: "Baixa",
  EXCLUDED: "Excluída do cronograma",
} as const;

export const SUBJECT_PRIORITY_DESCRIPTIONS = {
  PRIMARY: "Aparece com mais frequência no cronograma.",
  ACTIVE: "Distribuição normal no cronograma.",
  SECONDARY: "Aparece com menor frequência no cronograma.",
  EXCLUDED: "Não entra no cronograma, mas os dados são preservados.",
} as const;

export const SUBJECT_PRIORITY_WEIGHTS = {
  PRIMARY: 3,
  ACTIVE: 2,
  SECONDARY: 1,
  EXCLUDED: 0,
} as const;

export type SubjectPriorityType = keyof typeof SUBJECT_PRIORITY_LABELS;
