import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("             DIAGNÓSTICO DA AGENDA & BLOCOS (GABRIELA)                ");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

  // ------------------------------------------------------------------
  // SEÇÃO 3: VERIFICAÇÃO DE PERDA DE DADOS (132 BLOCOS DO ESTRATÉGIA)
  // ------------------------------------------------------------------
  console.log("======================================================================");
  console.log("3. CONTAGEM TOTAL DE BLOCOS POR theoryStatus (ACERVO INTEIRO):");
  console.log("======================================================================");
  const statusCounts = await prisma.studyBlock.groupBy({
    by: ["theoryStatus"],
    where: { userId },
    _count: { id: true }
  });
  console.table(statusCounts.map(s => ({ theoryStatus: s.theoryStatus, count: s._count.id })));

  // Separado: Blocos Âncora do CFC (que possuem officialTopicId) vs Blocos Legados do Estratégia
  const anchorBlocks = await prisma.studyBlock.findMany({
    where: { userId, officialTopicId: { not: null } },
    select: {
      id: true,
      title: true,
      theoryStatus: true,
      needsManualReview: true,
      possiblyAlreadyStudied: true,
      sourceV1BlockId: true,
      subject: { select: { name: true } }
    }
  });

  console.log(`\n- Total de Blocos Âncora do CFC (officialTopicId != null): ${anchorBlocks.length}`);

  const cfcByStatus: Record<string, number> = {};
  anchorBlocks.forEach(b => {
    cfcByStatus[b.theoryStatus] = (cfcByStatus[b.theoryStatus] || 0) + 1;
  });
  console.log("- Status dos Blocos Âncora do CFC:");
  console.table(cfcByStatus);

  // ------------------------------------------------------------------
  // SEÇÃO 1: ANÁLISE DOS BLOCOS ÂNCORA (SINALIZADOS × ELEGÍVEIS)
  // ------------------------------------------------------------------
  console.log("======================================================================");
  console.log("1. ANÁLISE DETALHADA DOS BLOCOS ÂNCORA DO CFC (58 BLOCOS):");
  console.log("======================================================================");

  let preCreditedCount = 0;       // sourceV1BlockId != null AND theoryStatus == COMPLETED
  let flaggedUnconfirmedCount = 0;// sourceV1BlockId != null AND theoryStatus == NOT_STARTED AND possiblyAlreadyStudied == true
  let flaggedConfirmedCount = 0;  // sourceV1BlockId != null AND theoryStatus == COMPLETED AND NOT pre-credited (or completed manually)
  let neverStudiedCount = 0;      // sourceV1BlockId == null AND theoryStatus == NOT_STARTED

  anchorBlocks.forEach(b => {
    if (b.sourceV1BlockId !== null) {
      if (b.theoryStatus === "COMPLETED") {
        if (!b.possiblyAlreadyStudied) {
          preCreditedCount++;
        } else {
          flaggedConfirmedCount++;
        }
      } else if (b.possiblyAlreadyStudied) {
        flaggedUnconfirmedCount++;
      }
    } else if (b.theoryStatus === "NOT_STARTED") {
      neverStudiedCount++;
    }
  });

  console.log(`- Pre-creditados (sourceV1BlockId != null, COMPLETED): ${preCreditedCount}`);
  console.log(`- Sinalizados NÃO confirmados (sourceV1BlockId != null, NOT_STARTED, possiblyAlreadyStudied=true): ${flaggedUnconfirmedCount}`);
  console.log(`- Sinalizados CONFIRMADOS por ela (sourceV1BlockId != null, COMPLETED, possiblyAlreadyStudied=true): ${flaggedConfirmedCount}`);
  console.log(`- Nunca Estudados de Fato (sourceV1BlockId == null, NOT_STARTED): ${neverStudiedCount}`);

  // Listar todos os blocos âncora com sourceV1BlockId e seus status atuais
  console.log("\nLista de todos os blocos âncora com sourceV1BlockId preenchido:");
  const linkedAnchorBlocks = anchorBlocks.filter(b => b.sourceV1BlockId !== null);
  console.table(linkedAnchorBlocks.map(b => ({
    id: b.id,
    subject: b.subject?.name,
    title: b.title.substring(0, 35),
    theoryStatus: b.theoryStatus,
    possiblyAlreadyStudied: b.possiblyAlreadyStudied,
    sourceV1BlockId: b.sourceV1BlockId
  })));

  // ------------------------------------------------------------------
  // SEÇÃO 2: VERIFICAÇÃO DA AGENDA (StudySchedule & StudyScheduleItem)
  // ------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log("2. VERIFICAÇÃO DA AGENDA MATERIALIZADA (StudySchedule & StudyScheduleItem):");
  console.log("======================================================================\n");

  const schedules = await prisma.studySchedule.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          studyBlock: {
            select: {
              id: true,
              title: true,
              theoryStatus: true,
              sourceV1BlockId: true,
              possiblyAlreadyStudied: true
            }
          },
          subject: { select: { name: true } }
        },
        orderBy: { dayNumber: "asc" }
      }
    }
  });

  console.log(`Total de Agendas (StudySchedule) da Gabriela: ${schedules.length}`);

  schedules.forEach(s => {
    console.log(`\nAgenda ID: ${s.id} | Título: '${s.title}' | Status: ${s.status} | Início: ${s.startDate.toISOString()}`);
    console.log(`Total de Itens na Agenda: ${s.items.length}`);

    const itemStatusCount: Record<string, number> = {};
    const itemActionTypeCount: Record<string, number> = {};
    
    s.items.forEach(it => {
      itemStatusCount[it.status] = (itemStatusCount[it.status] || 0) + 1;
      const act = it.actionType || "NULO";
      itemActionTypeCount[act] = (itemActionTypeCount[act] || 0) + 1;
    });

    console.log("Status dos Itens da Agenda:");
    console.table(itemStatusCount);
    console.log("ActionTypes dos Itens da Agenda:");
    console.table(itemActionTypeCount);

    // Itens concluídos recentemente / hoje
    const completedItems = s.items.filter(it => it.status === "COMPLETED");
    console.log(`\nItens Marcados como COMPLETED na Agenda (${completedItems.length}):`);
    completedItems.forEach(it => {
      console.log(` - Day ${it.dayNumber} | Data: ${it.scheduledDate?.toISOString()} | Bloco: [${it.studyBlockId}] '${it.studyBlock?.title}' | sourceV1BlockId: ${it.studyBlock?.sourceV1BlockId} | blockStatus: ${it.studyBlock?.theoryStatus}`);
    });

    // Itens PENDING / IN_PROGRESS nos próximos dias
    const pendingItems = s.items.filter(it => it.status === "PENDING" || it.status === "IN_PROGRESS");
    console.log(`\nPróximos Itens PENDENTES na Agenda (${pendingItems.length}):`);
    pendingItems.slice(0, 10).forEach(it => {
      console.log(` - Day ${it.dayNumber} | Data: ${it.scheduledDate?.toISOString()} | Status: ${it.status} | Matéria: ${it.subject?.name} | Bloco: [${it.studyBlockId}] '${it.studyBlock?.title}' | sourceV1BlockId: ${it.studyBlock?.sourceV1BlockId}`);
    });
  });

  // ------------------------------------------------------------------
  // SEÇÃO 5: TABELA SOLICITADA DE RETROSPECTIVA E O QUE SOBRA
  // ------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log("5. TABELA DE COMPOSIÇÃO DOS 58 BLOCOS ÂNCORA:");
  console.log("======================================================================\n");

  // Nunca estudados por matéria
  const neverStudiedBySubject: Record<string, number> = {};
  anchorBlocks.filter(b => b.sourceV1BlockId === null && b.theoryStatus === "NOT_STARTED").forEach(b => {
    const sName = b.subject?.name || "Sem Matéria";
    neverStudiedBySubject[sName] = (neverStudiedBySubject[sName] || 0) + 1;
  });

  console.log("Distribuição dos Blocos Nunca Estudados de Fato (por matéria):");
  console.table(neverStudiedBySubject);
}

main().finally(() => prisma.$disconnect());
