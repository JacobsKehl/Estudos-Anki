import { buildWeeklyReviewPreview } from "@/lib/services/weekly-review";

let totalAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    throw new Error(`[ASSERT FAILURE] ${message}`);
  }
}

// Banco de dados em memória para testes isolados
class MockDatabase {
  public sessions: any[] = [];
  public blocks: any[] = [];
  public queryLogs: string[] = [];

  public getClient() {
    return {
      weeklyReviewSession: {
        findFirst: async (args: any) => {
          this.queryLogs.push("weeklyReviewSession.findFirst");
          const userId = args.where.userId;
          const filtered = this.sessions.filter((s) => s.userId === userId);
          if (args.orderBy?.originalScheduledDate === "desc") {
            filtered.sort(
              (a, b) => b.originalScheduledDate.getTime() - a.originalScheduledDate.getTime()
            );
          }
          return filtered[0] || null;
        },
        findMany: async (args: any) => {
          this.queryLogs.push("weeklyReviewSession.findMany");
          const userId = args.where.userId;
          let filtered = this.sessions.filter((s) => s.userId === userId);
          if (args.where.originalScheduledDate?.lt) {
            const limitDate = args.where.originalScheduledDate.lt;
            filtered = filtered.filter(
              (s) => s.originalScheduledDate.getTime() < limitDate.getTime()
            );
          }
          return filtered;
        }
      },
      studyBlock: {
        findMany: async (args: any) => {
          this.queryLogs.push("studyBlock.findMany");
          const userId = args.where.userId;
          let filtered = this.blocks.filter((b) => b.userId === userId);

          // Filtro por theoryCompletedAt gte/lte ou lt
          if (args.where.theoryCompletedAt) {
            const filter = args.where.theoryCompletedAt;
            if (filter.lt) {
              filtered = filtered.filter(
                (b) => b.theoryCompletedAt && b.theoryCompletedAt.getTime() < filter.lt.getTime()
              );
            }
            if (filter.gte) {
              filtered = filtered.filter(
                (b) => b.theoryCompletedAt && b.theoryCompletedAt.getTime() >= filter.gte.getTime()
              );
            }
            if (filter.lte) {
              filtered = filtered.filter(
                (b) => b.theoryCompletedAt && b.theoryCompletedAt.getTime() <= filter.lte.getTime()
              );
            }
          }

          // Filtro por status / theoryStatus
          if (args.where.status) {
            filtered = filtered.filter((b) => b.status === args.where.status);
          }
          if (args.where.theoryStatus) {
            filtered = filtered.filter((b) => b.theoryStatus === args.where.theoryStatus);
          }

          // Ordenação
          if (args.orderBy?.theoryCompletedAt === "desc") {
            filtered.sort((a, b) => b.theoryCompletedAt.getTime() - a.theoryCompletedAt.getTime());
          } else if (args.orderBy?.theoryCompletedAt === "asc") {
            filtered.sort((a, b) => a.theoryCompletedAt.getTime() - b.theoryCompletedAt.getTime());
          }

          return filtered;
        }
      }
    };
  }
}

async function runTests() {
  console.log("\n========================================================");
  console.log("   INICIANDO TESTES ISOLADOS (EM MEMÓRIA) DO MOTOR     ");
  console.log("========================================================\n");

  const userId = "user-gabriela-123";

  // Mock de Matérias
  const subjectPrimary = { id: "sub-1", name: "Direito Constitucional", studyPriority: "PRIMARY", examWeight: 2.0, priority: 5 };
  const subjectActive = { id: "sub-2", name: "Direito Administrativo", studyPriority: "ACTIVE", examWeight: 1.0, priority: 3 };

  // Material mock
  const material = { id: "mat-1", fileName: "constitucional.pdf" };

  // --- TESTE 1: Primeira sessão retorna zero OVERDUE e no máximo 12 + 0 + 1 ---
  {
    console.log("Teste 1: Validando primeira sessão (0 overdue, limites)...");
    const db = new MockDatabase();
    
    // Criar 15 blocos concluídos em dias diferentes
    const studyDate = new Date("2026-07-01T10:00:00Z");
    for (let i = 0; i < 15; i++) {
      db.blocks.push({
        id: `block-${i}`,
        userId,
        subjectId: subjectPrimary.id,
        subject: subjectPrimary,
        materialId: material.id,
        material,
        title: `Bloco ${i}`,
        status: "COMPLETED",
        theoryStatus: "COMPLETED",
        theoryCompletedAt: studyDate,
        weeklyReviewTopicSources: []
      });
    }

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-05", "America/Sao_Paulo", 60, db.getClient());

    assert(preview.totals.overdue === 0, "Primeira sessão deve ter 0 atrasados");
    assert(preview.totals.weekContent === 12, "Primeira sessão deve selecionar exatamente 12 da semana");
    assert(preview.totals.excessWeekContent === 3, "Excedentes da semana devem ser 3");
    assert(preview.totals.longUnseen === 0, "Retomada deve ser 0 se não há matérias sem contato distintas");
    assert(preview.topics.length === 12, "Primeira sessão deve conter no máximo 12 tópicos");
    console.log("✓ Teste 1 concluído.");
  }

  // --- TESTE 2: Blocos históricos nunca revisados não viram OVERDUE e QuestionReviewTask não é consultada ---
  {
    console.log("Teste 2: Verificando que blocos históricos antigos não viram overdue...");
    const db = new MockDatabase();
    
    // Bloco antigo antes de qualquer sessão
    db.blocks.push({
      id: "block-ancient",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Antigo",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-05-01T10:00:00Z"),
      weeklyReviewTopicSources: []
    });

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-05", "America/Sao_Paulo", 60, db.getClient());

    assert(preview.totals.overdue === 0, "Blocos antigos sem sessões anteriores semanais correspondentes NÃO são overdue");
    assert(!db.queryLogs.includes("questionReviewTask.findMany"), "A tabela QuestionReviewTask não deve ser consultada");
    console.log("✓ Teste 2 concluído.");
  }

  // --- TESTE 3: Excedentes da sessão anterior viram OVERDUE na sessão seguinte ---
  {
    console.log("Teste 3: Validando excedentes virando overdue na sessão seguinte...");
    const db = new MockDatabase();

    // Sessão passada cadastrada em 05/07
    db.sessions.push({
      id: "session-passed",
      userId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
      status: "COMPLETED",
      missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
    });

    // Bloco completado em 01/07 (antes da sessão de 05/07) que ficou excedente (não participou de tópicos)
    db.blocks.push({
      id: "block-excedente",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Excedente",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T10:00:00Z"),
      weeklyReviewTopicSources: []
    });

    // Bloco da semana atual (estudado em 10/07)
    db.blocks.push({
      id: "block-atual",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Atual",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-10T10:00:00Z"),
      weeklyReviewTopicSources: []
    });

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-12", "America/Sao_Paulo", 60, db.getClient());

    const overdueTopic = preview.topics.find((t) => t.studyBlockId === "block-excedente");
    assert(overdueTopic !== undefined, "Excedente da sessão anterior deve ser selecionado como OVERDUE");
    assert(overdueTopic?.selectionReason === "OVERDUE", "Excedente deve ter motivo OVERDUE");
    console.log("✓ Teste 3 concluído.");
  }

  // --- TESTE 4: REVIEW_AGAIN, PENDING, SKIPPED, DID_WELL, HAD_DOUBTS ---
  {
    console.log("Teste 4: Validando estados de revisão...");
    const db = new MockDatabase();

    // Sessão anterior em 05/07
    const sessionPassed = {
      id: "session-passed",
      userId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      status: "COMPLETED",
      missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
    };
    db.sessions.push(sessionPassed);

    // Sessão skipped anterior
    const sessionSkipped = {
      id: "session-skipped",
      userId,
      originalScheduledDate: new Date("2026-06-28T12:00:00Z"),
      status: "SKIPPED",
      missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
    };
    db.sessions.push(sessionSkipped);

    // 1. Bloco marked as REVIEW_AGAIN
    const blockReviewAgain = {
      id: "block-review-again",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Review Again",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    };
    const topicReviewAgain = {
      id: "topic-1",
      weeklyReviewSessionId: sessionPassed.id,
      weeklyReviewSession: sessionPassed,
      result: "REVIEW_AGAIN"
    };
    blockReviewAgain.weeklyReviewTopicSources.push({
      weeklyReviewTopicId: topicReviewAgain.id,
      weeklyReviewTopic: topicReviewAgain,
      studyBlockId: blockReviewAgain.id
    } as any);
    db.blocks.push(blockReviewAgain);

    // 2. Bloco in SKIPPED session
    const blockSkipped = {
      id: "block-skipped",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Skipped",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-06-25T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    };
    const topicSkipped = {
      id: "topic-2",
      weeklyReviewSessionId: sessionSkipped.id,
      weeklyReviewSession: sessionSkipped,
      result: "DID_WELL" // Mas a sessão inteira foi SKIPPED!
    };
    blockSkipped.weeklyReviewTopicSources.push({
      weeklyReviewTopicId: topicSkipped.id,
      weeklyReviewTopic: topicSkipped,
      studyBlockId: blockSkipped.id
    } as any);
    db.blocks.push(blockSkipped);

    // 3. Bloco PENDING in previous session
    const blockPending = {
      id: "block-pending",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Pending",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T11:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    };
    const topicPending = {
      id: "topic-3",
      weeklyReviewSessionId: sessionPassed.id,
      weeklyReviewSession: sessionPassed,
      result: null // PENDING / Vazio
    };
    blockPending.weeklyReviewTopicSources.push({
      weeklyReviewTopicId: topicPending.id,
      weeklyReviewTopic: topicPending,
      studyBlockId: blockPending.id
    } as any);
    db.blocks.push(blockPending);

    // 4. Bloco DID_WELL (deve ser inibido)
    const blockDidWell = {
      id: "block-did-well",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Did Well",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T12:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    };
    const topicDidWell = {
      id: "topic-4",
      weeklyReviewSessionId: sessionPassed.id,
      weeklyReviewSession: sessionPassed,
      result: "DID_WELL"
    };
    blockDidWell.weeklyReviewTopicSources.push({
      weeklyReviewTopicId: topicDidWell.id,
      weeklyReviewTopic: topicDidWell,
      studyBlockId: blockDidWell.id
    } as any);
    db.blocks.push(blockDidWell);

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-12", "America/Sao_Paulo", 60, db.getClient());

    const foundReviewAgain = preview.topics.find((t) => t.studyBlockId === "block-review-again");
    const foundSkipped = preview.topics.find((t) => t.studyBlockId === "block-skipped");
    const foundDidWell = preview.topics.some((t) => t.studyBlockId === "block-did-well");

    assert(foundReviewAgain !== undefined, "REVIEW_AGAIN deve retornar como OVERDUE");
    assert(foundReviewAgain?.carriedFromTopicId === "topic-1", "REVIEW_AGAIN deve preencher carriedFromTopicId");
    assert(foundSkipped !== undefined, "Bloco de sessão SKIPPED deve permanecer elegível");
    assert(!foundDidWell, "DID_WELL deve deixar de ser elegível");
    assert(preview.totals.excessOverdue === 1, "Tópico PENDING de sessão anterior deve permanecer elegível como OVERDUE excedente");
    console.log("✓ Teste 4 concluído.");
  }

  // --- TESTE 5: Somente as 6 datas ativas são utilizadas ---
  {
    console.log("Teste 5: Validando seleção apenas nas 6 datas ativas...");
    const db = new MockDatabase();

    // 7 datas ativas diferentes
    const dates = [
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
      "2026-07-07"
    ];

    // Criar um bloco por dia
    for (let i = 0; i < dates.length; i++) {
      db.blocks.push({
        id: `block-day-${i}`,
        userId,
        subjectId: subjectPrimary.id,
        subject: subjectPrimary,
        materialId: material.id,
        material,
        title: `Bloco no dia ${dates[i]}`,
        status: "COMPLETED",
        theoryStatus: "COMPLETED",
        theoryCompletedAt: new Date(dates[i] + "T10:00:00Z"),
        weeklyReviewTopicSources: []
      });
    }

    // Prévia no dia 08/07 (Quarta-feira). Sem sessões passadas.
    // O período deve extrair as 6 datas mais recentes: de 02/07 a 07/07.
    // O dia 01/07 (mais antigo) deve ser excluído da seleção e do período ativo.
    const preview = await buildWeeklyReviewPreview(userId, "2026-07-08", "America/Sao_Paulo", 60, db.getClient());

    assert(preview.activeStudyDates.length === 6, "Deve conter exatamente 6 datas ativas");
    assert(!preview.activeStudyDates.includes("2026-07-01"), "O dia mais antigo (01/07) deve ser excluído das datas ativas");
    const foundOldestBlock = preview.topics.some((t) => t.studyBlockId === "block-day-0");
    assert(!foundOldestBlock, "O bloco estudado no dia 01/07 não deve ser selecionado");
    console.log("✓ Teste 5 concluído.");
  }

  // --- TESTE 6: Segunda sessão limite de 12 + 2 + 1 ---
  {
    console.log("Teste 6: Validando limites da segunda sessão (12 + 2 + 1)...");
    const db = new MockDatabase();

    // Cadastrar uma sessão anterior para ativar o modo de sessões posteriores
    const sessionPassed = {
      id: "session-passed",
      userId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      status: "COMPLETED",
      missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
    };
    db.sessions.push(sessionPassed);

    // 3 blocos atrasados elegíveis (estudados em 01/07, antes da sessão)
    for (let i = 1; i <= 3; i++) {
      db.blocks.push({
        id: `block-overdue-${i}`,
        userId,
        subjectId: subjectPrimary.id,
        subject: subjectPrimary,
        materialId: material.id,
        material,
        title: `Bloco Atrasado ${i}`,
        status: "COMPLETED",
        theoryStatus: "COMPLETED",
        theoryCompletedAt: new Date("2026-07-01T10:00:00Z"),
        weeklyReviewTopicSources: []
      });
    }

    // 13 blocos na semana atual (estudados em 06/07)
    for (let i = 1; i <= 13; i++) {
      db.blocks.push({
        id: `block-week-${i}`,
        userId,
        subjectId: subjectPrimary.id,
        subject: subjectPrimary,
        materialId: material.id,
        material,
        title: `Bloco Semana ${i}`,
        status: "COMPLETED",
        theoryStatus: "COMPLETED",
        theoryCompletedAt: new Date("2026-07-06T10:00:00Z"),
        weeklyReviewTopicSources: []
      });
    }

    // 1 bloco no dia 10/07 para manter o último contato de Matéria A em 10/07
    db.blocks.push({
      id: "block-week-14",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Semana 14",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-10T10:00:00Z"),
      weeklyReviewTopicSources: []
    });

    // Matéria B (ACTIVE) com conclusão em 2026-07-07 (durante a semana, mas não selecionado em WEEK_CONTENT)
    db.blocks.push({
      id: "block-long-unseen",
      userId,
      subjectId: subjectActive.id,
      subject: subjectActive,
      materialId: material.id,
      material,
      title: "Bloco Recente Matéria B",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-07T10:00:00Z"),
      weeklyReviewTopicSources: []
    });

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-12", "America/Sao_Paulo", 60, db.getClient());

    assert(preview.totals.overdue === 2, "Segunda sessão deve conter exatamente 2 atrasados");
    assert(preview.totals.weekContent === 12, "Segunda sessão deve conter exatamente 12 da semana");
    assert(preview.totals.longUnseen === 1, "Segunda sessão deve conter exatamente 1 de retomada");
    assert(preview.totals.selected === 15, "Total selecionado deve ser 15");
    assert(preview.totals.excessOverdue === 1, `Excedentes atrasados deve ser 1, mas veio: ${preview.totals.excessOverdue}`);
    assert(preview.totals.excessWeekContent === 3, `Excedentes da semana deve ser 3, mas veio: ${preview.totals.excessWeekContent}`);
    console.log("✓ Teste 6 concluído.");
  }

  console.log("\n========================================================");
  console.log(`   ✓ TODOS OS TESTES PASSARAM! TOTAL DE ASSERTIONS: ${totalAssertions}  `);
  console.log("========================================================\n");
}

runTests().catch((e) => {
  console.error("\n❌ FALHA NOS TESTES ISOLADOS:", e.message);
  process.exit(1);
});
