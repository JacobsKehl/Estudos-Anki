import { prisma } from "../src/lib/prisma";
import { getTodayRangeSP } from "../src/lib/date-utils";

function anonymizeEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const [name, domain] = parts;
  if (name.length <= 2) return `${name}***@${domain}`;
  const anonName = `${name[0]}***${name[name.length - 1]}`;
  return `${anonName}@${domain}`;
}

export type DayClassification =
  | "DIVERSE"
  | "MONOTHEMATIC_AVOIDABLE_CONFIRMED"
  | "MONOTHEMATIC_UNAVOIDABLE_CONFIRMED"
  | "MONOTHEMATIC_INDETERMINATE"
  | "SINGLE_THEORY_BLOCK"
  | "NO_THEORY";

export interface AuditDayReport {
  date: string;
  dayNumber: number;
  blocksCount: number;
  subjects: string[];
  classification: DayClassification;
  reason: string;
  evidence: string[];
  limitations: string[];
}

export async function runAudit(options: {
  userEmail: string;
  from?: string;
  to?: string;
  scheduleId?: string;
}) {
  const { userEmail, from, to, scheduleId } = options;

  console.log("====================================================");
  console.log("🔍 AUDITORIA DE DIVERSIDADE DE MATÉRIAS (READ-ONLY)");
  console.log("====================================================");
  console.log(`Usuário Solicitado: ${anonymizeEmail(userEmail)}`);

  // 1. Resolver usuário por e-mail (SEM e-mail hardcoded)
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { preferences: true }
  });

  if (!user) {
    console.error(`❌ Erro: Usuário com e-mail "${anonymizeEmail(userEmail)}" não foi encontrado.`);
    return null;
  }

  console.log(`ID do Usuário:     ${user.id}`);
  console.log(`Nome do Usuário:   ${user.name || "Não informado"}`);
  console.log(`Modo de Geração:   ${user.preferences?.scheduleGenerationMode || "DYNAMIC"}`);

  // 2. Confirmar modo LEGACY_TRT4
  const mode = user.preferences?.scheduleGenerationMode || "DYNAMIC";
  if (mode !== "LEGACY_TRT4") {
    console.warn(`\n⚠️ ATENÇÃO: O usuário possui o modo "${mode}". A auditoria específica de diversidade aplica-se ao modo LEGACY_TRT4.`);
  }

  // 3. Localizar Cronograma Ativo ou Específico
  let activeSchedule;
  if (scheduleId) {
    activeSchedule = await prisma.studySchedule.findFirst({
      where: { id: scheduleId, userId: user.id }
    });
  } else {
    activeSchedule = await prisma.studySchedule.findFirst({
      where: { userId: user.id, status: "ACTIVE" }
    });
  }

  if (!activeSchedule) {
    console.error(`❌ Erro: Nenhum cronograma localizado para o usuário.`);
    return null;
  }

  console.log(`\n📅 CRONOGRAMA EM ANÁLISE`);
  console.log(`ID:           ${activeSchedule.id}`);
  console.log(`Título:       ${activeSchedule.title}`);
  console.log(`Status:       ${activeSchedule.status}`);
  console.log(`Data Início:  ${activeSchedule.startDate.toISOString().split("T")[0]}`);
  console.log(`Atualizado em: ${activeSchedule.updatedAt.toISOString()}`);

  // 4. Buscar Matérias do Usuário
  const userSubjects = await prisma.studySubject.findMany({
    where: { userId: user.id }
  });

  const primarySubjects = userSubjects.filter(s => s.studyPriority === "PRIMARY");
  const activeSubjects = userSubjects.filter(s => s.studyPriority === "ACTIVE");
  const secondarySubjects = userSubjects.filter(s => s.studyPriority === "SECONDARY");
  const excludedSubjects = userSubjects.filter(s => s.studyPriority === "EXCLUDED");

  console.log(`\n📚 CONFIGURAÇÃO DE MATÉRIAS`);
  console.log(`Total de Matérias: ${userSubjects.length}`);
  console.log(`- PRIMARY (${primarySubjects.length}):   ${primarySubjects.map(s => s.name).join(", ") || "Nenhuma"}`);
  console.log(`- ACTIVE (${activeSubjects.length}):    ${activeSubjects.map(s => s.name).join(", ") || "Nenhuma"}`);
  console.log(`- SECONDARY (${secondarySubjects.length}): ${secondarySubjects.map(s => s.name).join(", ") || "Nenhuma"}`);
  console.log(`- EXCLUDED (${excludedSubjects.length}):  ${excludedSubjects.map(s => s.name).join(", ") || "Nenhuma"}`);

  // 5. Buscar Blocos Pendentes e Minutos por Matéria
  const allPendingBlocks = await prisma.studyBlock.findMany({
    where: {
      userId: user.id,
      status: { not: "COMPLETED" },
      material: {
        materialRole: { not: "SUPPORT_MATERIAL" }
      }
    },
    include: {
      subject: true,
      material: true
    }
  });

  const pendingBySubject: Record<string, { name: string; count: number; estimatedMinutes: number; priority: string }> = {};
  for (const sub of userSubjects) {
    pendingBySubject[sub.id] = { name: sub.name, count: 0, estimatedMinutes: 0, priority: sub.studyPriority };
  }

  for (const block of allPendingBlocks) {
    if (pendingBySubject[block.subjectId]) {
      pendingBySubject[block.subjectId].count++;
      pendingBySubject[block.subjectId].estimatedMinutes += block.estimatedStudyMinutes || 45;
    }
  }

  console.log(`\n📊 BALANÇO ATUAL DE BLOCOS PENDENTES NA BASE`);
  console.table(
    Object.values(pendingBySubject).map(item => ({
      Matéria: item.name,
      Prioridade: item.priority,
      "Blocos Pendentes": item.count,
      "Minutos Estimados": item.estimatedMinutes
    }))
  );

  // 6. Buscar Itens do Cronograma
  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) dateFilter.lte = new Date(`${to}T23:59:59.999Z`);

  const scheduleItems = await prisma.studyScheduleItem.findMany({
    where: {
      userId: user.id,
      scheduleId: activeSchedule.id,
      ...(from || to ? { scheduledDate: dateFilter } : {})
    },
    include: {
      subject: true,
      studyBlock: true
    },
    orderBy: [
      { scheduledDate: "asc" },
      { id: "asc" }
    ]
  });

  console.log(`\n Total de Itens no Cronograma Analisado: ${scheduleItems.length}`);

  const theoryItems = scheduleItems.filter(i => i.actionType === "THEORY");
  const srsItems = scheduleItems.filter(i => i.actionType === "REVIEW_FLASHCARDS");
  const reviewBlockItems = scheduleItems.filter(i => i.actionType === "REVIEW_BLOCK");
  const supportItems = scheduleItems.filter(i => i.actionType === "SUPPORT");

  console.log(`\n📋 SEPARAÇÃO POR TIPO DE AÇÃO`);
  console.log(`- Teoria (THEORY):               ${theoryItems.length} (Utilizados na análise de diversidade)`);
  console.log(`- Revisão Cards (SRS):          ${srsItems.length}`);
  console.log(`- Revisão Bloco (REVIEW_BLOCK): ${reviewBlockItems.length}`);
  console.log(`- Apoio (SUPPORT):              ${supportItems.length}`);

  const blockCounts: Record<string, number> = {};
  for (const item of scheduleItems) {
    if (item.studyBlockId) {
      blockCounts[item.studyBlockId] = (blockCounts[item.studyBlockId] || 0) + 1;
    }
  }
  const duplicateBlockIds = Object.keys(blockCounts).filter(id => blockCounts[id] > 1);
  if (duplicateBlockIds.length > 0) {
    console.warn(`\n⚠️ ATENÇÃO: Encontrados ${duplicateBlockIds.length} studyBlockIds duplicados no cronograma!`);
  } else {
    console.log(`\n✔ Nenhum studyBlockId duplicado encontrado no cronograma.`);
  }

  // 7. Agrupar itens de THEORY por Data/Dia
  const daysMap: Record<string, typeof theoryItems> = {};
  for (const item of theoryItems) {
    const dateKey = item.scheduledDate
      ? getTodayRangeSP(item.scheduledDate).dateString
      : `Day_${item.dayNumber || 0}`;
    if (!daysMap[dateKey]) {
      daysMap[dateKey] = [];
    }
    daysMap[dateKey].push(item);
  }

  const classificationCounts: Record<DayClassification, number> = {
    DIVERSE: 0,
    MONOTHEMATIC_AVOIDABLE_CONFIRMED: 0,
    MONOTHEMATIC_UNAVOIDABLE_CONFIRMED: 0,
    MONOTHEMATIC_INDETERMINATE: 0,
    SINGLE_THEORY_BLOCK: 0,
    NO_THEORY: 0
  };

  const dayReports: AuditDayReport[] = [];
  let earliestMonothematicDate: string | null = null;

  for (const [dateKey, items] of Object.entries(daysMap)) {
    const blocksCount = items.length;
    const subjectsInDay = Array.from(new Set(items.map(i => i.subject?.name || i.subjectId)));
    const dayNumber = items[0]?.dayNumber || 0;

    let classification: DayClassification;
    let reason = "";
    const evidence: string[] = [];
    const limitations: string[] = [];

    if (blocksCount === 0) {
      classification = "NO_THEORY";
      reason = "Nenhum bloco de teoria agendado.";
      evidence.push("0 itens do tipo THEORY agendados para este dia.");
    } else if (blocksCount === 1) {
      classification = "SINGLE_THEORY_BLOCK";
      reason = "Apenas 1 bloco de teoria no dia.";
      evidence.push(`1 bloco de teoria agendado: ${subjectsInDay[0]}.`);
    } else if (subjectsInDay.length >= 2) {
      classification = "DIVERSE";
      reason = `Matérias diversificadas (${subjectsInDay.length} matérias).`;
      evidence.push(`Matérias distintas no dia: ${subjectsInDay.join(", ")}.`);
    } else {
      if (!earliestMonothematicDate) {
        earliestMonothematicDate = dateKey;
      }

      const singleSubjectId = items[0].subjectId;
      const otherEligibleSubjects = userSubjects.filter(
        s => s.id !== singleSubjectId && (s.studyPriority === "PRIMARY" || s.studyPriority === "ACTIVE")
      );

      evidence.push(`Dia monotemático com ${blocksCount} blocos de ${subjectsInDay[0]}.`);

      if (otherEligibleSubjects.length === 0) {
        classification = "MONOTHEMATIC_UNAVOIDABLE_CONFIRMED";
        reason = "Apenas 1 matéria elegível existia nas configurações do usuário.";
        evidence.push("Não há nenhuma outra matéria com prioridade PRIMARY ou ACTIVE cadastrada.");
      } else {
        const dateObj = items[0].scheduledDate;
        if (!dateObj) {
          classification = "MONOTHEMATIC_INDETERMINATE";
          reason = "Data do item ausente para verificação histórica.";
          limitations.push("Data nula no registro do item do cronograma.");
        } else {
          // Exigir EVIDÊNCIAS CONVERGENTES de disponibilidade histórica:
          // 1. Bloco de outra matéria criado ANTES da data do agendamento (createdAt <= dateObj)
          // 2. Não concluído antes dessa data (theoryCompletedAt seja nulo ou > dateObj)
          // 3. Matéria elegível (PRIMARY ou ACTIVE)
          const otherSubjectIds = otherEligibleSubjects.map(s => s.id);
          const convergentOtherBlocks = allPendingBlocks.filter(b => {
            if (!otherSubjectIds.includes(b.subjectId)) return false;
            const createdBefore = b.createdAt <= dateObj;
            const notCompletedBefore = !b.theoryCompletedAt || b.theoryCompletedAt > dateObj;
            return createdBefore && notCompletedBefore;
          });

          if (convergentOtherBlocks.length > 0) {
            classification = "MONOTHEMATIC_AVOIDABLE_CONFIRMED";
            reason = "Evidências convergentes comprovam que outras matérias elegíveis possuíam blocos disponíveis nesta data.";
            evidence.push(
              `Encontrados ${convergentOtherBlocks.length} blocos pendentes de outras matérias elegíveis criados antes de ${dateKey} e não concluídos até essa data.`
            );
          } else {
            // Se faltarem dados convergentes de timestamps históricos completos:
            classification = "MONOTHEMATIC_INDETERMINATE";
            reason = "Timestamps e estados históricos de transição insuficientes para comprovar com 100% de certeza o estado da fila na data passada.";
            limitations.push(
              `Não foi possível confirmar se os blocos atuais de outras matérias já existiam e estavam disponíveis em ${dateKey}.`
            );
            limitations.push("O banco não possui tabela de audit_log histórico de transições de status por dia.");
          }
        }
      }
    }

    classificationCounts[classification]++;
    dayReports.push({
      date: dateKey,
      dayNumber,
      blocksCount,
      subjects: subjectsInDay,
      classification,
      reason,
      evidence,
      limitations
    });
  }

  console.log(`\n====================================================`);
  console.log(`📈 CLASSIFICAÇÃO DOS DIAS DE ESTUDO`);
  console.log(`====================================================`);
  console.log(`- DIVERSE:                             ${classificationCounts.DIVERSE}`);
  console.log(`- MONOTHEMATIC_AVOIDABLE_CONFIRMED:    ${classificationCounts.MONOTHEMATIC_AVOIDABLE_CONFIRMED}`);
  console.log(`- MONOTHEMATIC_UNAVOIDABLE_CONFIRMED:  ${classificationCounts.MONOTHEMATIC_UNAVOIDABLE_CONFIRMED}`);
  console.log(`- MONOTHEMATIC_INDETERMINATE:          ${classificationCounts.MONOTHEMATIC_INDETERMINATE}`);
  console.log(`- SINGLE_THEORY_BLOCK:                 ${classificationCounts.SINGLE_THEORY_BLOCK}`);
  console.log(`- NO_THEORY:                           ${classificationCounts.NO_THEORY}`);

  if (earliestMonothematicDate) {
    console.log(`\nPrimeiro Dia Monotemático Identificado: ${earliestMonothematicDate}`);
  }

  console.log(`\n====================================================`);
  console.log(`⚠️ LIMITAÇÕES DE RECONSTRUÇÃO HISTÓRICA`);
  console.log(`====================================================`);
  console.log(`1. O banco de dados armazena apenas o estado ATUAL dos blocos e itens.`);
  console.log(`2. Não há tabela de auditoria temporal de mudanças de estado (audit_log por bloco).`);
  console.log(`3. Para dias passados onde o histórico exato de disponibilidade é ambíguo,`);
  console.log(`   a auditoria utiliza a classificação conservadora MONOTHEMATIC_INDETERMINATE.`);
  console.log(`4. Esta auditoria realizou APENAS consultas SELECT. Zero escritas efetuadas.\n`);

  return {
    user: { id: user.id, mode },
    scheduleId: activeSchedule.id,
    classificationCounts,
    dayReports,
    duplicateBlockIdsCount: duplicateBlockIds.length
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let userEmail: string | null = null;
  let from: string | undefined;
  let to: string | undefined;
  let scheduleId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--user-email=")) {
      userEmail = args[i].split("=")[1];
    } else if (args[i] === "--user-email" && i + 1 < args.length) {
      userEmail = args[i + 1];
    } else if (args[i].startsWith("--from=")) {
      from = args[i].split("=")[1];
    } else if (args[i].startsWith("--to=")) {
      to = args[i].split("=")[1];
    } else if (args[i].startsWith("--schedule-id=")) {
      scheduleId = args[i].split("=")[1];
    }
  }

  if (!userEmail) {
    console.error("❌ Erro: O parâmetro --user-email é obrigatório.");
    console.log("Uso correto:");
    console.log('  npx tsx scripts/audit-schedule-subject-diversity.ts --user-email="gabriela.furtado.p@gmail.com"');
    process.exit(1);
  }

  runAudit({ userEmail, from, to, scheduleId })
    .then(() => process.exit(0))
    .catch(err => {
      console.error("❌ Erro na execução da auditoria:", err);
      process.exit(1);
    });
}
