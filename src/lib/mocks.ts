export const MOCK_USER = {
  name: "Henrique Kehl",
  email: "henrique@example.com",
};

export const MOCK_SUBJECTS = [
  {
    id: "1",
    name: "Matemática",
    progress: 65,
    pendingFlashcards: 12,
    nextTopic: "Geometria Analítica",
    color: "#4B6350",
  },
  {
    id: "2",
    name: "Biologia",
    progress: 42,
    pendingFlashcards: 8,
    nextTopic: "Genética Mendeliana",
    color: "#6B8E23",
  },
  {
    id: "3",
    name: "História",
    progress: 88,
    pendingFlashcards: 0,
    nextTopic: "Segunda Guerra Mundial",
    color: "#556B2F",
  },
];

export const TODAY_SCHEDULE = [
  {
    id: "1",
    time: "09:00",
    subject: "Matemática",
    topic: "Resolução de Exercícios - Funções",
    status: "COMPLETED",
  },
  {
    id: "2",
    time: "10:30",
    subject: "Biologia",
    topic: "Leitura: Mitocôndrias e Respiração Celular",
    status: "CURRENT",
  },
  {
    id: "3",
    time: "14:00",
    subject: "Flashcards",
    topic: "Revisão Geral do Dia",
    status: "PENDING",
  },
];

export const MOCK_STATS = {
  dailyStreak: 12,
  completedTasks: 45,
  totalStudyHours: 128,
  pendingReviews: 20,
};

export const MOCK_MATERIALS = [
  {
    id: "m1",
    title: "Introdução à Genética Clássica",
    subjectId: "2",
    subjectName: "Biologia",
    type: "PDF",
    status: "PROCESSED" as const,
    organizationStatus: "ORGANIZED",
    pageCount: 42,
    extractedWords: 15400,
    uploadedAt: "2024-05-08T10:00:00Z",
    hasExistingBlocks: true,
  },
  {
    id: "m2",
    title: "Funções de Primeiro Grau - Exercícios Resolvidos",
    subjectId: "1",
    subjectName: "Matemática",
    type: "PDF",
    status: "PROCESSING" as const,
    organizationStatus: "PENDING",
    pageCount: 15,
    extractedWords: 0,
    uploadedAt: "2024-05-08T14:30:00Z",
    hasExistingBlocks: false,
  },
  {
    id: "m3",
    title: "Segunda Guerra Mundial - Resumo",
    subjectId: "3",
    subjectName: "História",
    type: "PDF",
    status: "ERROR" as const,
    organizationStatus: "ERROR",
    pageCount: 120,
    extractedWords: 0,
    uploadedAt: "2024-05-07T09:15:00Z",
    hasExistingBlocks: false,
  },
  {
    id: "m4",
    title: "Citologia e Membrana Plasmática",
    subjectId: "2",
    subjectName: "Biologia",
    type: "PDF",
    status: "PROCESSED" as const,
    organizationStatus: "ORGANIZED",
    pageCount: 28,
    extractedWords: 9200,
    uploadedAt: "2024-05-05T16:45:00Z",
    hasExistingBlocks: true,
  }
];
