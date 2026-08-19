import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ReviewQueueItem {
  blockId: string;
  title: string;
  dueDate: Date;
  stage: 1 | 2 | 3; // D+5, D+15, D+30
}

interface SimConfig {
  readsPerDay: number;      // 1 ou 2 leituras por dia
  reviewsPerDayLimit: number; // 2, 3 ou 4 revisões de bloco por dia
}

async function run90DaySimulation(config: SimConfig) {
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

  // Flashcards SRS
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

  const dailyLog: any[] = [];

  // Simular 90 dias (19/08/2026 a 16/11/2026)
  for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
    const currDate = new Date(baseSimDate);
    currDate.setDate(currDate.getDate() + dayOffset);

    const dateStr = currDate.toISOString().split("T")[0];
    const weekdayIdx = currDate.getDay();
    const isSunday = weekdayIdx === 0;

    // Fila de revisões vencidas no INÍCIO do dia
    const overdueStartOfDay = reviewQueue.filter(r => r.dueDate <= currDate).length;
    if (overdueStartOfDay > peakQueueDepth) {
      peakQueueDepth = overdueStartOfDay;
      dateOfPeak = dateStr;
    }

    let dayTheoryCount = 0;
    let dayTheoryMins = 0;
    let dayReviewCount = 0;
    let dayReviewMins = 0;

    // 1. THEORY (Novo estudo): Se não for Domingo e houver blocos na fila
    if (!isSunday && remainingTheoryQueue.length > 0) {
      const slots = Math.min(config.readsPerDay, remainingTheoryQueue.length);
      for (let s = 0; s < slots; s++) {
        const allocated = remainingTheoryQueue.shift()!;
        dayTheoryCount++;
        const mins = allocated.estimatedStudyMinutes || 45;
        dayTheoryMins += mins;

        // Quando o bloco é concluído no dia currDate, insere D+5, D+15, D+30 na fila!
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
      // Tempo REALÍSTICO de releitura/revisão de bloco lido: 12 min/bloco
      dayReviewMins += 12;

      const qIdx = reviewQueue.indexOf(revItem);
      if (qIdx >= 0) reviewQueue.splice(qIdx, 1);
    }

    // Fila de revisões vencidas no FIM do dia
    const overdueEndOfDay = reviewQueue.filter(r => r.dueDate <= currDate).length;
    if (overdueEndOfDay === 0 && reviewQueue.length === 0 && !dateLastReviewCompleted) {
      dateLastReviewCompleted = dateStr;
    }

    // 3. FLASHCARDS SRS: 25 cards/dia em média (com base na rotina real de 20-30 cards)
    const dueCardsCount = isSunday ? 30 : 25;
    const flashcardMins = Math.round(dueCardsCount * 0.75); // ~18 a 22 min/dia

    const totalDailyMins = dayTheoryMins + dayReviewMins + flashcardMins;
    if (totalDailyMins > totalDailyMinutesPeak) {
      totalDailyMinutesPeak = totalDailyMins;
      peakDayStr = dateStr;
    }

    totalTheoryMinutesSum += dayTheoryMins;
    totalReviewMinutesSum += dayReviewMins;
    totalFlashcardMinutesSum += flashcardMins;

    if (dayOffset < 14 || dayOffset % 15 === 0 || dateStr === dateAllTheoryCompleted || dateStr === "2026-11-16") {
      dailyLog.push({
        day: `Dia ${dayOffset + 1} (${dateStr})`,
        theory: `${dayTheoryCount} (${dayTheoryMins}m)`,
        reviewBlock: `${dayReviewCount} (${dayReviewMins}m)`,
        flashcards: `${dueCardsCount} (${flashcardMins}m)`,
        total: `${totalDailyMins} min (${(totalDailyMins / 60).toFixed(1)}h)`,
        queueStart: overdueStartOfDay,
        queueEnd: overdueEndOfDay
      });
    }
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
    averageDailyMinutes,
    dailyLog
  };
}

async function main() {
  console.log("======================================================================");
  console.log("   SIMULAÇÃO DE 90 DIAS DO BLOCO D (ATÉ O EDITAL DE NOVEMBRO 2026)    ");
  console.log("======================================================================\n");

  const configs: SimConfig[] = [
    { readsPerDay: 2, reviewsPerDayLimit: 2 },
    { readsPerDay: 2, reviewsPerDayLimit: 3 },
    { readsPerDay: 2, reviewsPerDayLimit: 4 },
    { readsPerDay: 1, reviewsPerDayLimit: 2 },
    { readsPerDay: 1, reviewsPerDayLimit: 3 },
  ];

  const summaryResults: any[] = [];

  for (const cfg of configs) {
    const res = await run90DaySimulation(cfg);
    summaryResults.push({
      "Ritmo de Leitura": `${cfg.readsPerDay} inédito(s)/dia`,
      "Cota Revisão Bloco": `${cfg.reviewsPerDayLimit} bloco(s)/dia`,
      "Término das 28 Teorias": res.dateAllTheoryCompleted,
      "Pico da Fila (Estoque Max)": `${res.peakQueueDepth} itens (${res.dateOfPeak})`,
      "Término da ÚLTIMA Revisão": res.dateLastReviewCompleted,
      "Média Diária Total": `${res.averageDailyMinutes} min (${(res.averageDailyMinutes / 60).toFixed(1)}h)`,
      "Pico Máximo de Tempo": `${res.totalDailyMinutesPeak} min (${(res.totalDailyMinutesPeak / 60).toFixed(1)}h em ${res.peakDayStr})`
    });
  }

  console.log("--- QUADRO COMPARATIVO DOS REGIMES DE ESTUDO (90 DIAS) ---");
  console.table(summaryResults);
}

main();
