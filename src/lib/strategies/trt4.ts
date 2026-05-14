export interface SubjectConfig {
  name: string;
  examWeight: number;
  isCoreSubject: boolean;
  cycleStartAfterDays?: number;
}

export const TRT4_STRATEGY = {
  dailyStudyMinutes: 120,
  dailySrsMinutes: 30,
  studyBlocksPerDay: 2,
  minutesPerStudyBlock: 45,
  examDate: "2026-10-01",
  coreCycleDays: 90,
  
  subjects: [
    { name: "Direito do Trabalho", examWeight: 2, isCoreSubject: true },
    { name: "Direito Processual do Trabalho", examWeight: 2, isCoreSubject: true },
    { name: "Direito Administrativo", examWeight: 1, isCoreSubject: true },
    { name: "Direito Constitucional", examWeight: 1, isCoreSubject: true },
    { name: "Direito Civil", examWeight: 1, isCoreSubject: true },
    { name: "Direito Processual Civil", examWeight: 1, isCoreSubject: true },
    { name: "Língua Portuguesa", examWeight: 1, isCoreSubject: true },
    
    // Support subjects (enter after 90 days)
    { name: "Matemática e Raciocínio Lógico", examWeight: 1, isCoreSubject: false, cycleStartAfterDays: 90 },
    { name: "Informática", examWeight: 1, isCoreSubject: false, cycleStartAfterDays: 90 },
    { name: "Direitos das Pessoas com Deficiência", examWeight: 1, isCoreSubject: false, cycleStartAfterDays: 90 },
    { name: "Legislação específica", examWeight: 1, isCoreSubject: false, cycleStartAfterDays: 90 },
    { name: "Discursiva", examWeight: 1, isCoreSubject: false, cycleStartAfterDays: 90 },
  ] as SubjectConfig[],

  // 6-day cycle definition (subject names)
  cycle: [
    ["Direito do Trabalho", "Língua Portuguesa"],
    ["Direito Processual do Trabalho", "Direito Administrativo"],
    ["Direito Constitucional", "Direito Civil"],
    ["Direito Processual Civil", "Direito do Trabalho"],
    ["Direito Processual do Trabalho", "Língua Portuguesa"],
    ["Direito Administrativo", "Direito Processual Civil"],
  ]
};
