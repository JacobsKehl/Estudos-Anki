/**
 * diagnose-today-schedule.ts
 *
 * Diagnóstico completo da agenda de hoje (2026-08-20):
 * 1. Teste de determinismo: Consulta a agenda de hoje duas vezes seguidas para verificar se há volatilidade.
 * 2. Breakdown dos itens de hoje por `actionType` (THEORY, REVIEW_BLOCK, REVIEW_FLASHCARDS, etc.).
 * 3. Análise dos candidatos de Teoria no banco para entender por que apenas 1 bloco de Teoria (ou N blocos) foi agendado para hoje (cota maxNewTheoryPerDay=2 vs limite de minutos vs candidatos elegíveis).
 * 4. Regeneração do e-mail de hoje (assunto, corpo e lista de itens).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CFC_FILES = [
  "1 - Direito Administrativo_compressed.pdf",
  "2 - Direito do Trabalho.pdf",
  "3 - Direito Constitucional.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "Direito Processual Civil_compressed.pdf",
];

async function main() {
  const { data: user } = await supabase.from("User").select("id, name, email").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const todayStr = "2026-08-20";
  const startToday = "2026-08-20T00:00:00.000Z";
  const endToday = "2026-08-20T23:59:59.999Z";

  // --------------------------------------------------------------------
  // 1. TESTE DE DETERMINISMO (Duas consultas seguidas sem mutação)
  // --------------------------------------------------------------------
  console.log("=================================================================");
  console.log("  1. TESTE DE DETERMINISMO DE CONSULTA DA AGENDA (SEM MUTAÇÃO)");
  console.log("=================================================================\n");

  const runQuery = async () => {
    const { data: items } = await supabase
      .from("StudyScheduleItem")
      .select("id, status, scheduledDate, estimatedMinutes, actionType, createdAt, StudyBlock:studyBlockId(title, estimatedStudyMinutes, theoryStatus), StudySubject:subjectId(name)")
      .eq("userId", userId)
      .gte("scheduledDate", startToday)
      .lte("scheduledDate", endToday)
      .order("createdAt", { ascending: true });
    return items || [];
  };

  const pass1 = await runQuery();
  const pass2 = await runQuery();

  console.log(` Passada 1 (2026-08-20): ${pass1.length} itens encontrados.`);
  console.log(` Passada 2 (2026-08-20): ${pass2.length} itens encontrados.`);
  console.log(` Determinismo: ${pass1.length === pass2.length ? "✅ 100% IDÊNTICO E DETERMINÍSTICO" : "⚠️ VOLÁTIL"}\n`);

  // --------------------------------------------------------------------
  // 2. BREAKDOWN DOS ITENS DE HOJE POR ACTIONTYPE
  // --------------------------------------------------------------------
  console.log("=================================================================");
  console.log(`  2. DETALHAMENTO COMPLETO DA AGENDA DE HOJE (${todayStr}) POR TYPE`);
  console.log("=================================================================\n");

  const itemsByType: Record<string, any[]> = {};
  let totalMinutesToday = 0;

  for (const item of pass1) {
    const type = item.actionType || "SEM_TIPO";
    if (!itemsByType[type]) itemsByType[type] = [];
    itemsByType[type].push(item);

    const b = (item as any).StudyBlock;
    const mins = item.estimatedMinutes ?? b?.estimatedStudyMinutes ?? 0;
    totalMinutesToday += mins;
  }

  console.log(`Total de Itens na Agenda de Hoje: ${pass1.length} itens (${totalMinutesToday} min total)\n`);

  for (const [type, list] of Object.entries(itemsByType)) {
    let typeMins = 0;
    for (const it of list) {
      const b = (it as any).StudyBlock;
      typeMins += it.estimatedMinutes ?? b?.estimatedStudyMinutes ?? 0;
    }
    console.log(`📌 ActionType: '${type}' → ${list.length} item(ns) (${typeMins} min)`);
    for (const it of list) {
      const sub = (it as any).StudySubject;
      const b = (it as any).StudyBlock;
      console.log(`   - [ID: ${it.id}] [Status: ${it.status.padEnd(8)}] Subject: ${sub?.name || "N/A"} | Block: ${b?.title || "N/A"} (${it.estimatedMinutes ?? b?.estimatedStudyMinutes ?? 0}m)`);
    }
    console.log();
  }

  // --------------------------------------------------------------------
  // 3. RASTREIO DE TEORIA (Candidate Blocks & Scheduler Logic)
  // --------------------------------------------------------------------
  console.log("=================================================================");
  console.log("  3. TRACE DE ELEGIBILIDADE DE TEORIA PARA HOJE (POR QUE 1 BLOCO?)");
  console.log("=================================================================\n");

  // Buscar todos os blocos do banco para Gabriela
  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryStatus, pageStart, pageEnd, estimatedStudyMinutes, subjectId, materialId, possiblyAlreadyStudied, sourceV1BlockId, StudyMaterial:materialId(originalFileName), StudySubject:subjectId(name, studyPriority)")
    .eq("userId", userId);

  const cfcBlocks = (allBlocks || []).filter(b =>
    CFC_FILES.includes((b as any).StudyMaterial?.originalFileName || "") &&
    b.theoryStatus !== "EXCLUDED"
  );

  const notStartedTheory = cfcBlocks.filter(b => b.theoryStatus === "NOT_STARTED");
  const cleanNotStarted = notStartedTheory.filter(b => !b.possiblyAlreadyStudied);

  console.log(`  Total de blocos CFC ativos no banco: ${cfcBlocks.length}`);
  console.log(`  Total de blocos CFC 'NOT_STARTED': ${notStartedTheory.length}`);
  console.log(`  Total de blocos CFC 'NOT_STARTED' limpos (sem painel): ${cleanNotStarted.length}\n`);

  console.log("  Primeiros 5 blocos de Teoria 'NOT_STARTED' elegíveis:");
  cleanNotStarted.slice(0, 5).forEach((b: any, idx) => {
    console.log(`   ${idx + 1}. [${b.StudyMaterial?.originalFileName.substring(0, 18)}] ${b.title} (${b.estimatedStudyMinutes}m, subject: ${b.StudySubject?.name})`);
  });

  // --------------------------------------------------------------------
  // 4. REGENERAÇÃO DO CORPO E E-MAIL DE HOJE
  // --------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log("  4. CORPO DO E-MAIL REGERADO PARA HOJE");
  console.log("=================================================================\n");

  const theoryItems = itemsByType["THEORY"] || [];
  const reviewBlockItems = itemsByType["REVIEW_BLOCK"] || [];
  const reviewCardsItems = itemsByType["REVIEW_FLASHCARDS"] || [];

  console.log(`📧 ASSUNTO: Plano de Estudos Diário - ${user!.name} (${todayStr})`);
  console.log(`-----------------------------------------------------------------`);
  console.log(`Olá, ${user!.name}!\n`);
  console.log(`Aqui está o seu cronograma de estudos para hoje (${todayStr}):\n`);

  console.log(`📖 TEORIA NOVA (${theoryItems.length} bloco(s)):`);
  if (theoryItems.length === 0) {
    console.log(`   (Nenhum bloco de teoria agendado para hoje)`);
  } else {
    theoryItems.forEach((it, idx) => {
      const b = (it as any).StudyBlock;
      const sub = (it as any).StudySubject;
      console.log(`   ${idx + 1}. ${sub?.name}: "${b?.title}" [Páginas ${b?.pageStart} a ${b?.pageEnd}] (${it.estimatedMinutes ?? b?.estimatedStudyMinutes} min)`);
    });
  }

  console.log(`\n🔄 REVISÃO DE BLOCOS D3 (${reviewBlockItems.length} bloco(s)):`);
  if (reviewBlockItems.length === 0) {
    console.log(`   (Nenhuma revisão de bloco agendada para hoje)`);
  } else {
    reviewBlockItems.forEach((it, idx) => {
      const b = (it as any).StudyBlock;
      const sub = (it as any).StudySubject;
      console.log(`   ${idx + 1}. ${sub?.name}: "${b?.title}" (${it.estimatedMinutes ?? b?.estimatedStudyMinutes} min)`);
    });
  }

  console.log(`\n🎴 REVISÃO DE FLASHCARDS (${reviewCardsItems.length} sessão/ões):`);
  if (reviewCardsItems.length === 0) {
    console.log(`   (Nenhuma sessão de flashcards agendada para hoje)`);
  } else {
    reviewCardsItems.forEach((it, idx) => {
      const sub = (it as any).StudySubject;
      console.log(`   ${idx + 1}. ${sub?.name} (${it.estimatedMinutes} min)`);
    });
  }

  console.log(`\nTotal do dia: ${pass1.length} tarefas | Tempo estimado total: ${totalMinutesToday} minutos (${(totalMinutesToday / 60).toFixed(1)}h)\n`);
  console.log(`Bons estudos!`);
  console.log(`=================================================================\n`);
}

main().catch(console.error);
