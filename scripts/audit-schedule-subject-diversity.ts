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

export function maskIdentifier(id: string): string {
  if (!id || id.length <= 8) return "***";
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
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
  includeIdentifiers?: boolean;
}) {
  const { userEmail, from, to, scheduleId, includeIdentifiers = false } = options;

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

  const displayUserId = includeIdentifiers ? user.id : maskIdentifier(user.id);
  console.log(`ID do Usuário:     ${displayUserId}`);
  if (includeIdentifiers) {
    console.log(`Nome do Usuário:   ${user.name || "Não informado"}`);
  }
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

  const displayScheduleId = includeIdentifiers ? activeSchedule.id : maskIdentifier(activeSchedule.id);
  console.log(`\n📅 CRONOGRAMA EM ANÁLISE`);
  console.log(`ID:           ${displayScheduleId}`);
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

  // 5. Saldo Atual de Blocos Pendentes
  const currentPendingBlocks = await prisma.studyBlock.findMany({
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

  // Reconstrução Histórica: Consultar TODOS os blocos (incluindo COMPLETED) para reconstruir a fila temporal
  const allHistoricalBlocks = await prisma.studyBlock.findMany({
    where: {
      userId: user.id,
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

  for (const block of currentPendingBlocks) {
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
  console.log(`- Teoria (THEORY):               ${theoryItems.length}`);
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

  // 7. Construir universo completo de datas a partir de TODOS os itens do cronograma
  const daysMap: Record<string, typeof scheduleItems> = {};
  for (const item of scheduleItems) {
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

  for (const [dateKey, allItemsInDay] of Object.entries(daysMap)) {
    const theoryItemsInDay = allItemsInDay.filter(i => i.actionType === "THEORY");
    const blocksCount = theoryItemsInDay.length;
    const subjectsInDay = Array.from(new Set(theoryItemsInDay.map(i => i.subject?.name || i.subjectId)));
    const dayNumber = allItemsInDay[0]?.dayNumber || 0;

    let classification: DayClassification;
    let reason = "";
    const evidence: string[] = [];
    const limitations: string[] = [];

    if (blocksCount === 0) {
      classification = "NO_THEORY";
      reason = "Nenhum bloco de teoria agendado para este dia.";
      evidence.push(`Dia contém ${allItemsInDay.length} itens (SRS/Revisão/Apoio), mas 0 do tipo THEORY.`);
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

      const singleSubjectId = theoryItemsInDay[0].subjectId;
      const otherEligibleSubjects = userSubjects.filter(
        s => s.id !== singleSubjectId && (s.studyPriority === "PRIMARY" || s.studyPriority === "ACTIVE")
      );

      evidence.push(`Dia monotemático com ${blocksCount} blocos de ${subjectsInDay[0]}.`);

      if (otherEligibleSubjects.length === 0) {
        classification = "MONOTHEMATIC_UNAVOIDABLE_CONFIRMED";
        reason = "Apenas 1 matéria elegível existia nas configurações do usuário.";
        evidence.push("Não há nenhuma outra matéria com prioridade PRIMARY ou ACTIVE cadastrada.");
      } else {
        const dateObj = theoryItemsInDay[0].scheduledDate;
        if (!dateObj) {
          classification = "MONOTHEMATIC_INDETERMINATE";
          reason = "Data do item ausente para verificação histórica.";
          limitations.push("Data nula no registro do item do cronograma.");
        } else {
          // Reconstrução histórica com todos os blocos (incluindo os que foram concluídos posteriormente)
          const otherSubjectIds = otherEligibleSubjects.map(s => s.id);
          const historicalAvailableOtherBlocks = allHistoricalBlocks.filter(b => {
            if (!otherSubjectIds.includes(b.subjectId)) return false;
            const createdBefore = b.createdAt <= dateObj;
            const notCompletedBefore = !b.theoryCompletedAt || b.theoryCompletedAt > dateObj;
            return createdBefore && notCompletedBefore;
          });

          if (historicalAvailableOtherBlocks.length > 0) {
            classification = "MONOTHEMATIC_AVOIDABLE_CONFIRMED";
            reason = "Evidências convergentes comprovam que outras matérias elegíveis possuíam blocos disponíveis nesta data histórica.";
            evidence.push(
              `Encontrados ${historicalAvailableOtherBlocks.length} blocos históricos de outras matérias elegíveis criados antes de ${dateKey} e não concluídos até essa data.`
            );
          } else {
            classification = "MONOTHEMATIC_INDETERMINATE";
            reason = "Timestamps e estados históricos de transição insuficientes para comprovar com 100% de certeza o estado da fila na data passada.";
            limitations.push(
              `Não foi possível confirmar se os blocos de outras matérias já existiam e estavam disponíveis em ${dateKey}.`
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
    userId: displayUserId,
    scheduleId: displayScheduleId,
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
  let includeIdentifiers = false;

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
    } else if (args[i] === "--include-identifiers") {
      includeIdentifiers = true;
    }
  }

  if (!userEmail) {
    console.error("❌ Erro: O parâmetro --user-email é obrigatório.");
    console.log("Uso correto:");
    console.log('  npx tsx scripts/audit-schedule-subject-diversity.ts --user-email="gabriela.furtado.p@gmail.com"');
    process.exit(1);
  }

  runAudit({ userEmail, from, to, scheduleId, includeIdentifiers })
    .then(() => process.exit(0))
    .catch(err => {
      console.error("❌ Erro na execução da auditoria:", err);
      process.exit(1);
    });
}
