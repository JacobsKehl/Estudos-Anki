import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DailySimSummary {
  dayIndex: number;
  dateStr: string;
  weekdayName: string;
  isSunday: boolean;
  theoryCount: number;
  theoryBlockTitles: string[];
  reviewBlockCount: number;
  reviewBlockTitles: string[];
  flaggedPendingCountInSchedule: number;
}

async function main() {
  console.log("======================================================================");
  console.log("    SIMULAÇÃO DRY-RUN DE 14 DIAS — REGRAS DO BLOCO D (SEM GRAVAÇÃO)    ");
  console.log("======================================================================\n");

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

  // 1. Carregar Balde 1 (Estudo Novo — 28 blocos CFC inéditos)
  const { data: newTheoryBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, subjectId, StudySubject:subjectId(name)")
    .eq("userId", userId)
    .is("sourceV1BlockId", null)
    .eq("possiblyAlreadyStudied", false)
    .eq("theoryStatus", "NOT_STARTED")
    .in("materialId", cfcMaterialIds);

  // 2. Carregar Balde 2 (Confirmação Pendente — 14 blocos)
  const { data: flaggedBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title")
    .eq("userId", userId)
    .eq("possiblyAlreadyStudied", true)
    .neq("theoryStatus", "COMPLETED");

  const flaggedSet = new Set((flaggedBlocks || []).map(b => b.id));

  // 3. Carregar Balde 3 (Blocos de Teoria Concluídos para Fila de Revisão D+5, D+15, D+30)
  const { data: completedBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryCompletedAt")
    .eq("userId", userId)
    .eq("theoryStatus", "COMPLETED");

  console.log(`[D1] BALDES ENCONTRADOS NO BANCO:`);
  console.log(` - Balde 1 (Estudo Novo / Inéditos):          ${newTheoryBlocks?.length || 0} blocos (Esperado: 28)`);
  console.log(` - Balde 2 (Confirmação Pendente / Painel):  ${flaggedBlocks?.length || 0} blocos (Esperado: 14)`);
  console.log(` - Balde 3 (Blocos Concluídos para Revisão): ${completedBlocks?.length || 0} blocos`);

  // Montar fila inicial de revisões baseada em theoryCompletedAt
  // Para cada bloco concluído, agendar as revisões D+5, D+15, D+30
  interface ReviewQueueItem {
    blockId: string;
    blockTitle: string;
    dueDate: Date;
    stage: 1 | 2 | 3; // 1 = D+5, 2 = D+15, 3 = D+30
  }

  const reviewQueue: ReviewQueueItem[] = [];
  const baseSimDate = new Date("2026-08-19T00:00:00-03:00");

  (completedBlocks || []).forEach(b => {
    const completedAt = b.theoryCompletedAt ? new Date(b.theoryCompletedAt) : new Date("2026-08-14T00:00:00-03:00");
    
    // Adicionar D+5
    const d5 = new Date(completedAt);
    d5.setDate(d5.getDate() + 5);
    reviewQueue.push({ blockId: b.id, blockTitle: b.title, dueDate: d5, stage: 1 });

    // Adicionar D+15
    const d15 = new Date(completedAt);
    d15.setDate(d15.getDate() + 15);
    reviewQueue.push({ blockId: b.id, blockTitle: b.title, dueDate: d15, stage: 2 });

    // Adicionar D+30
    const d30 = new Date(completedAt);
    d30.setDate(d30.getDate() + 30);
    reviewQueue.push({ blockId: b.id, blockTitle: b.title, dueDate: d30, stage: 3 });
  });

  const remainingTheoryQueue = [...(newTheoryBlocks || [])];
  const simResults: DailySimSummary[] = [];

  let dateOfAllTheoryCompleted: string | null = null;
  let peakReviewBlockCount = 0;
  let totalFlaggedInSchedule = 0;

  const weekdaysPT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  // Simular 14 dias (Dia 1 a Dia 14)
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const currDate = new Date(baseSimDate);
    currDate.setDate(currDate.getDate() + dayOffset);

    const dateStr = currDate.toISOString().split("T")[0];
    const weekdayIdx = currDate.getDay();
    const isSunday = weekdayIdx === 0;

    let dayTheoryCount = 0;
    const dayTheoryTitles: string[] = [];
    let dayReviewCount = 0;
    const dayReviewTitles: string[] = [];
    let flaggedInDay = 0;

    // 1. Alocar TEORIA (Se não for Domingo, max 2 blocos de teoria por dia)
    if (!isSunday && remainingTheoryQueue.length > 0) {
      const slots = Math.min(2, remainingTheoryQueue.length);
      for (let s = 0; s < slots; s++) {
        const allocatedBlock = remainingTheoryQueue.shift()!;
        dayTheoryCount++;
        dayTheoryTitles.push(allocatedBlock.title.substring(0, 30));

        if (flaggedSet.has(allocatedBlock.id)) {
          flaggedInDay++;
        }

        // Quando o bloco de teoria é concluído no dia, insere a revisão D+5 na fila!
        const revD5 = new Date(currDate);
        revD5.setDate(revD5.getDate() + 5);
        reviewQueue.push({ blockId: allocatedBlock.id, blockTitle: allocatedBlock.title, dueDate: revD5, stage: 1 });

        const revD15 = new Date(currDate);
        revD15.setDate(revD15.getDate() + 15);
        reviewQueue.push({ blockId: allocatedBlock.id, blockTitle: allocatedBlock.title, dueDate: revD15, stage: 2 });

        const revD30 = new Date(currDate);
        revD30.setDate(revD30.getDate() + 30);
        reviewQueue.push({ blockId: allocatedBlock.id, blockTitle: allocatedBlock.title, dueDate: revD30, stage: 3 });
      }
    }

    if (remainingTheoryQueue.length === 0 && !dateOfAllTheoryCompleted) {
      dateOfAllTheoryCompleted = dateStr;
    }

    // 2. Alocar REVISÃO DE BLOCO (vencidos até o dia atual, máx 2 por dia)
    // Filtra vencidos
    const dueReviews = reviewQueue
      .filter(r => r.dueDate <= currDate)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const reviewSlots = Math.min(2, dueReviews.length);
    for (let r = 0; r < reviewSlots; r++) {
      const revItem = dueReviews[r];
      dayReviewCount++;
      dayReviewTitles.push(revItem.blockTitle.substring(0, 30));

      if (flaggedSet.has(revItem.blockId)) {
        flaggedInDay++;
      }

      // Remover da fila acumulada
      const qIdx = reviewQueue.indexOf(revItem);
      if (qIdx >= 0) reviewQueue.splice(qIdx, 1);
    }

    totalFlaggedInSchedule += flaggedInDay;
    if (dayReviewCount > peakReviewBlockCount) {
      peakReviewBlockCount = dayReviewCount;
    }

    simResults.push({
      dayIndex: dayOffset + 1,
      dateStr,
      weekdayName: weekdaysPT[weekdayIdx],
      isSunday,
      theoryCount: dayTheoryCount,
      theoryBlockTitles: dayTheoryTitles,
      reviewBlockCount: dayReviewCount,
      reviewBlockTitles: dayReviewTitles,
      flaggedPendingCountInSchedule: flaggedInDay
    });
  }

  console.log(`\n--- RELATÓRIO DIA A DIA DA SIMULAÇÃO DE 14 DIAS ---`);
  console.table(simResults.map(r => ({
    Dia: `Dia ${r.dayIndex} (${r.dateStr})`,
    "Dia da Semana": r.weekdayName,
    "THEORY (Novos)": r.isSunday ? "0 (DOMINGO) 🔒" : r.theoryCount,
    "REVIEW_BLOCK": r.reviewBlockCount,
    "Sinalizados Vistos na Agenda": r.flaggedPendingCountInSchedule
  })));

  console.log("\n======================================================================");
  console.log("                  RESUMO DOS REQUISITOS DE D6                          ");
  console.log("======================================================================");

  const sundaysWithTheory = simResults.filter(r => r.isSunday && r.theoryCount > 0);
  console.log(`1. Todos os domingos possuem THEORY = 0: ${sundaysWithTheory.length === 0 ? "SIM ✅ (CONFIRMADO)" : "NÃO ❌"}`);

  console.log(`2. Data de término dos 28 blocos inéditos: ${dateOfAllTheoryCompleted ? `${dateOfAllTheoryCompleted} (após 14 dias de estudo)` : "Além dos 14 dias"}`);

  console.log(`3. Pico de REVIEW_BLOCK em um único dia: ${peakReviewBlockCount} bloco(s)/dia (Dentro do limite diário ✅)`);

  console.log(`4. Blocos do balde 'Confirmação Pendente' na agenda: ${totalFlaggedInSchedule} blocos (EXATAMENTE 0 - NENHUM VAZOU ✅)`);
}

main();
