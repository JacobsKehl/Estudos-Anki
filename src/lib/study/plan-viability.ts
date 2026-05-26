/**
 * Calcula a viabilidade do plano de estudos com base nos blocos de teoria pendentes,
 * a meta diária e o prazo final estabelecido.
 */

interface ViabilityParams {
  remainingBlockMinutes: number;
  dailyGoalMinutes: number;
  flashcardMinutesPerDay?: number;
  deadline: Date | string;
  studyDaysOfWeek?: string; // Ex: "1,2,3,4,5,6,0" (0=Domingo, 1=Segunda, etc.)
  startDate?: Date;
}

interface ViabilityResult {
  daysRemaining: number;
  studyDaysRemaining: number;
  dailyTheoryMinutes: number;
  totalAvailableHours: number;
  requiredHours: number;
  isViable: boolean;
  deficitHours: number;
  surplusHours: number;
  recommendedDailyMinutes: number;
}

export function calculatePlanViability({
  remainingBlockMinutes,
  dailyGoalMinutes,
  flashcardMinutesPerDay = 30,
  deadline,
  studyDaysOfWeek = "1,2,3,4,5,6,0", // Padrão: 7 dias por semana
  startDate = new Date()
}: ViabilityParams): ViabilityResult {
  
  // 1. Normalizar datas
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(deadline);
  end.setHours(23, 59, 59, 999);

  // Se o prazo já passou
  if (end.getTime() < start.getTime()) {
    return {
      daysRemaining: 0,
      studyDaysRemaining: 0,
      dailyTheoryMinutes: 0,
      totalAvailableHours: 0,
      requiredHours: Math.round((remainingBlockMinutes / 60) * 10) / 10,
      isViable: false,
      deficitHours: Math.round((remainingBlockMinutes / 60) * 10) / 10,
      surplusHours: 0,
      recommendedDailyMinutes: dailyGoalMinutes
    };
  }

  // 2. Mapear dias de estudo ativos (Ex: [0, 1, 2, 3, 4, 5, 6])
  const activeDays = studyDaysOfWeek
    ? studyDaysOfWeek.split(",").map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n))
    : [0, 1, 2, 3, 4, 5, 6];

  let daysRemaining = 0;
  let studyDaysRemaining = 0;

  const current = new Date(start);
  while (current.getTime() <= end.getTime()) {
    daysRemaining++;
    const dayOfWeek = current.getDay(); // 0 = Domingo, 1 = Segunda...
    if (activeDays.includes(dayOfWeek)) {
      studyDaysRemaining++;
    }
    current.setDate(current.getDate() + 1);
  }

  // 3. Tempo diário líquido para teoria (descontando flashcards)
  const dailyTheoryMinutes = Math.max(0, dailyGoalMinutes - flashcardMinutesPerDay);

  // 4. Tempo disponível total
  const totalAvailableMinutes = studyDaysRemaining * dailyTheoryMinutes;

  const totalAvailableHours = Math.round((totalAvailableMinutes / 60) * 10) / 10;
  const requiredHours = Math.round((remainingBlockMinutes / 60) * 10) / 10;

  const isViable = totalAvailableMinutes >= remainingBlockMinutes;
  
  let deficitHours = 0;
  let surplusHours = 0;

  if (isViable) {
    surplusHours = Math.round(((totalAvailableMinutes - remainingBlockMinutes) / 60) * 10) / 10;
  } else {
    deficitHours = Math.round(((remainingBlockMinutes - totalAvailableMinutes) / 60) * 10) / 10;
  }

  // 5. Calcular meta diária sugerida caso não caiba
  let recommendedDailyMinutes = dailyGoalMinutes;
  if (!isViable && studyDaysRemaining > 0) {
    const requiredTheoryPerDay = remainingBlockMinutes / studyDaysRemaining;
    recommendedDailyMinutes = Math.ceil(requiredTheoryPerDay + flashcardMinutesPerDay);
  }

  return {
    daysRemaining,
    studyDaysRemaining,
    dailyTheoryMinutes,
    totalAvailableHours,
    requiredHours,
    isViable,
    deficitHours,
    surplusHours,
    recommendedDailyMinutes
  };
}
