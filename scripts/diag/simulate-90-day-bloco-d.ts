import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ReviewQueueItem {
  blockId: string;
  title: string;
  dueDate: Date;
  stage: 1 | 2 | 3;
}

interface SimSensitivityConfig {
  readsPerDay: number;          // 2 inéditos/dia
  reviewsPerDayLimit: number;   // 3 revisões/dia
  reviewMinutesPerBlock: number; // 12m, 20m, 30m
}

async function run90DaySensitivitySim(config: SimSensitivityConfig) {
  const { data: user } = await supabase
    .from("User")
    .select("id")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();
  const userId = user!.id;

  const cfcFileNames = [
    "1 - Direito Administrativo_compressed.pdf",
    "3 - Direito Constitucional_compressed.pdf",
    "3 - Direito Constitucional.pdf",
    "Direito Processual Civil_compressed.pdf",
    "4 - Direito Processual do Trabalho.pdf",
    "2 - Direito do Trabalho.pdf"
  ];

  const { data: cfcMaterials } = await supabase
    .from("StudyMaterial")
    .select("id")
    .in("originalFileName", cfcFileNames);

  const cfcMaterialIds = (cfcMaterials || []).map(m => m.id);

  // Balde 1 (28 blocos inéditos do CFC)
  const { data: newTheoryBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, estimatedStudyMinutes")
    .eq("userId", userId)
    .is("sourceV1BlockId", null)
    .eq("possiblyAlreadyStudied", false)
    .eq("theoryStatus", "NOT_STARTED")
    .in("materialId", cfcMaterialIds);

  // Cenário A: Apenas blocos do CFC no Balde 3 (16 blocos)
  const { data: cfcCompletedBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryCompletedAt, estimatedStudyMinutes")
    .eq("userId", userId)
    .eq("theoryStatus", "COMPLETED")
    .in("materialId", cfcMaterialIds);

  // Flashcards SRS reais com nextReviewAt no banco
  const { data: flashcards } = await supabase
    .from("Flashcard")
    .select("id, nextReviewAt")
    .eq("userId", userId)
    .eq("status", "APPROVED");

  const baseSimDate = new Date("2026-08-19T00:00:00-03:00");
  const reviewQueue: ReviewQueueItem[] = [];

  // Povoar fila inicial com os 16 blocos do CFC (13 pré-creditados + 3 lidos)
  (cfcCompletedBlocks || []).forEach(b => {
    const compDate = b.theoryCompletedAt ? new Date(b.theoryCompletedAt) : new Date("2026-08-14T00:00:00-03:00");
    const d5 = new Date(compDate); d5.setDate(d5.getDate() + 5);
    const d15 = new Date(compDate); d15.setDate(d15.getDate() + 15);
    const d30 = new Date(compDate); d30.setDate(d30.getDate() + 30);

    reviewQueue.push({ blockId: b.id, title: b.title, dueDate: d5, stage: 1 });
    reviewQueue.push({ blockId: b.id, title: b.title, dueDate: d15, stage: 2 });
    reviewQueue.push({ blockId: b.id, title: b.title, dueDate: d30, stage: 3 });
  });

  const remainingTheoryQueue = [...(newTheoryBlocks || [])];

  let peakQueueDepth = 0;
  let dateOfPeak: string = "";
  let dateAllTheoryCompleted: string | null = null;
  let dateLastReviewCompleted: string | null = null;

  let totalTheoryMinutesSum = 0;
  let totalReviewMinutesSum = 0;
  let totalFlashcardMinutesSum = 0;
  let totalDailyMinutesPeak = 0;
  let peakDayStr = "";

  // Simular 90 dias (19/08/2026 a 16/11/2026)
  for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
    const currDate = new Date(baseSimDate);
    currDate.setDate(currDate.getDate() + dayOffset);

    const dateStr = currDate.toISOString().split("T")[0];
    const weekdayIdx = currDate.getDay();
    const isSunday = weekdayIdx === 0;

    // Fila de revisões vencidas no INÍCIO do dia
    // estoque inicial (N+1) = estoque final (N) + novos vencimentos do dia (N+1)
    const overdueStartOfDay = reviewQueue.filter(r => r.dueDate <= currDate).length;
    if (overdueStartOfDay > peakQueueDepth) {
      peakQueueDepth = overdueStartOfDay;
      dateOfPeak = dateStr;
    }

    let dayTheoryCount = 0;
    let dayTheoryMins = 0;
    let dayReviewCount = 0;
    let dayReviewMins = 0;

    // 1. THEORY: Se não for Domingo e houver blocos na fila
    if (!isSunday && remainingTheoryQueue.length > 0) {
      const slots = Math.min(config.readsPerDay, remainingTheoryQueue.length);
      for (let s = 0; s < slots; s++) {
        const allocated = remainingTheoryQueue.shift()!;
        dayTheoryCount++;
        const mins = allocated.estimatedStudyMinutes || 45;
        dayTheoryMins += mins;

        // D+5, D+15, D+30
        const d5 = new Date(currDate); d5.setDate(d5.getDate() + 5);
        const d15 = new Date(currDate); d15.setDate(d15.getDate() + 15);
        const d30 = new Date(currDate); d30.setDate(d30.getDate() + 30);

        reviewQueue.push({ blockId: allocated.id, title: allocated.title, dueDate: d5, stage: 1 });
        reviewQueue.push({ blockId: allocated.id, title: allocated.title, dueDate: d15, stage: 2 });
        reviewQueue.push({ blockId: allocated.id, title: allocated.title, dueDate: d30, stage: 3 });
      }
    }

    if (remainingTheoryQueue.length === 0 && !dateAllTheoryCompleted) {
      dateAllTheoryCompleted = dateStr;
    }

    // 2. REVIEW_BLOCK: Alocar vencidos (máx config.reviewsPerDayLimit)
    const dueReviews = reviewQueue
      .filter(r => r.dueDate <= currDate)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const reviewSlots = Math.min(config.reviewsPerDayLimit, dueReviews.length);
    for (let r = 0; r < reviewSlots; r++) {
      const revItem = dueReviews[r];
      dayReviewCount++;
      dayReviewMins += config.reviewMinutesPerBlock;

      const qIdx = reviewQueue.indexOf(revItem);
      if (qIdx >= 0) reviewQueue.splice(qIdx, 1);
    }

    // Fila no FIM do dia
    const overdueEndOfDay = reviewQueue.filter(r => r.dueDate <= currDate).length;
    if (overdueEndOfDay === 0 && reviewQueue.length === 0 && !dateLastReviewCompleted) {
      dateLastReviewCompleted = dateStr;
    }

    // 3. FLASHCARDS SRS REAL: 25 cards/dia em média (~18 min/dia)
    const dueCardsCount = isSunday ? 30 : 25;
    const flashcardMins = Math.round(dueCardsCount * 0.75);

    const totalDailyMins = dayTheoryMins + dayReviewMins + flashcardMins;
    if (totalDailyMins > totalDailyMinutesPeak) {
      totalDailyMinutesPeak = totalDailyMins;
      peakDayStr = dateStr;
    }

    totalTheoryMinutesSum += dayTheoryMins;
    totalReviewMinutesSum += dayReviewMins;
    totalFlashcardMinutesSum += flashcardMins;
  }

  const averageDailyMinutes = Math.round((totalTheoryMinutesSum + totalReviewMinutesSum + totalFlashcardMinutesSum) / 90);

  return {
    config,
    dateAllTheoryCompleted,
    dateLastReviewCompleted: dateLastReviewCompleted || "Além de 19/11/2026",
    peakQueueDepth,
    dateOfPeak,
    totalDailyMinutesPeak,
    peakDayStr,
    averageDailyMinutes
  };
}

async function main() {
  console.log("======================================================================");
  console.log("    ANÁLISE DE SENSIBILIDADE DE DURAÇÃO DE REVISÃO (12m vs 20m vs 30m)   ");
  console.log("    REGIME DEFINIDO: 2 LEITURAS INÉDITAS/DIA · COTA DE REVISÃO 3/DIA   ");
  console.log("======================================================================\n");

  const sensitivityConfigs: SimSensitivityConfig[] = [
    { readsPerDay: 2, reviewsPerDayLimit: 3, reviewMinutesPerBlock: 12 },
    { readsPerDay: 2, reviewsPerDayLimit: 3, reviewMinutesPerBlock: 20 },
    { readsPerDay: 2, reviewsPerDayLimit: 3, reviewMinutesPerBlock: 30 },
  ];

  const results: any[] = [];

  for (const cfg of sensitivityConfigs) {
    const res = await run90DaySensitivitySim(cfg);
    results.push({
      "Premissa de Revisão (Tempo/Bloco)": `${cfg.reviewMinutesPerBlock} min / bloco`,
      "Término 28 Teorias": res.dateAllTheoryCompleted,
      "Pico da Fila (Estoque Máx)": `${res.peakQueueDepth} itens (${res.dateOfPeak})`,
      "Término da ÚLTIMA Revisão": res.dateLastReviewCompleted,
      "Média Diária Total (90 dias)": `${res.averageDailyMinutes} min (${(res.averageDailyMinutes / 60).toFixed(1)}h)`,
      "Dia de Pico Máximo": `${res.totalDailyMinutesPeak} min (${(res.totalDailyMinutesPeak / 60).toFixed(1)}h em ${res.peakDayStr})`
    });
  }

  console.table(results);
}

main();
