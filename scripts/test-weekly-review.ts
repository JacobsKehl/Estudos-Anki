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

          if (args.where.theoryStatus) {
            filtered = filtered.filter((b) => b.theoryStatus === args.where.theoryStatus);
          }

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
  console.log("   INICIANDO TESTES ISOLADOS (EM MEMÓRIA) DO MOTOR v2  ");
  console.log("========================================================\n");

  const userId = "user-gabriela-123";

  // Mock de Matérias
  const subjectPrimary = { id: "sub-1", name: "Direito Constitucional", studyPriority: "PRIMARY", examWeight: 2.0, priority: 5 };
  const subjectActive = { id: "sub-2", name: "Direito Administrativo", studyPriority: "ACTIVE", examWeight: 1.0, priority: 3 };
  const material = { id: "mat-1", fileName: "constitucional.pdf" };

  // --- TESTE 1: Blocos históricos anteriores à primeira janela nunca viram OVERDUE ---
  {
    console.log("Teste 1: Blocos históricos não viram overdue...");
    const db = new MockDatabase();
    
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
      weeklyReviewTopicSources: [] as any[]
    });

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-05", "America/Sao_Paulo", 60, db.getClient());
    assert(preview.totals.overdue === 0, "Historico sem sessões nunca é overdue");
    console.log("✓ Teste 1 concluído.");
  }

  // --- TESTE 2: Após a criação da primeira sessão, o histórico antigo continua excluído ---
  {
    console.log("Teste 2: Após primeira sessão, histórico antigo continua excluído...");
    const db = new MockDatabase();

    db.sessions.push({
      id: "session-1",
      userId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
      sourcePeriodStart: new Date("2026-06-29T00:00:00Z"),
      sourcePeriodEnd: new Date("2026-07-04T23:59:59Z"),
      status: "COMPLETED"
    });

    db.blocks.push({
      id: "block-ancient-2",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Antigo 2",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-06-01T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    });

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-12", "America/Sao_Paulo", 60, db.getClient());
    assert(preview.totals.overdue === 0, "Historico antes de earliest sourcePeriodStart continua excluído de overdue");
    console.log("✓ Teste 2 concluído.");
  }

  // --- TESTE 3: Bloco excedente dentro da janela anterior vira OVERDUE ---
  {
    console.log("Teste 3: Bloco excedente dentro da janela anterior vira OVERDUE...");
    const db = new MockDatabase();

    db.sessions.push({
      id: "session-1",
      userId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
      sourcePeriodStart: new Date("2026-06-29T00:00:00Z"),
      sourcePeriodEnd: new Date("2026-07-04T23:59:59Z"),
      status: "COMPLETED"
    });

    db.blocks.push({
      id: "block-excedente",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Excedente 1",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T10:00:00Z"), // Dentro da janela de session-1
      weeklyReviewTopicSources: [] as any[]
    });

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-12", "America/Sao_Paulo", 60, db.getClient());
    const found = preview.topics.find(t => t.studyBlockId === "block-excedente");
    assert(found !== undefined && found.selectionReason === "OVERDUE", "Excedente dentro da janela anterior vira overdue");
    console.log("✓ Teste 3 concluído.");
  }

  // --- TESTE 4: Bloco fora da janela anterior não vira OVERDUE ---
  {
    console.log("Teste 4: Bloco fora da janela anterior não vira OVERDUE...");
    const db = new MockDatabase();

    db.sessions.push({
      id: "session-1",
      userId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
      sourcePeriodStart: new Date("2026-06-29T00:00:00Z"),
      sourcePeriodEnd: new Date("2026-07-04T23:59:59Z"),
      status: "COMPLETED"
    });

    db.blocks.push({
      id: "block-outside",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Fora",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-06-20T10:00:00Z"), // Antes de sourcePeriodStart de session-1
      weeklyReviewTopicSources: [] as any[]
    });

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-12", "America/Sao_Paulo", 60, db.getClient());
    assert(preview.totals.overdue === 0, "Bloco fora da janela anterior não deve virar overdue");
    console.log("✓ Teste 4 concluído.");
  }

  // --- TESTE 5: REVIEW_AGAIN vira OVERDUE com carriedFromTopicId ---
  {
    console.log("Teste 5: REVIEW_AGAIN vira OVERDUE com carriedFromTopicId...");
    const db = new MockDatabase();

    const session = {
      id: "session-1",
      userId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
      sourcePeriodStart: new Date("2026-06-29T00:00:00Z"),
      sourcePeriodEnd: new Date("2026-07-04T23:59:59Z"),
      status: "COMPLETED"
    };
    db.sessions.push(session);

    const block = {
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
    const topic = {
      id: "topic-123",
      weeklyReviewSessionId: session.id,
      weeklyReviewSession: session,
      result: "REVIEW_AGAIN"
    };
    block.weeklyReviewTopicSources.push({
      weeklyReviewTopicId: topic.id,
      weeklyReviewTopic: topic,
      studyBlockId: block.id
    } as any);
    db.blocks.push(block);

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-12", "America/Sao_Paulo", 60, db.getClient());
    const found = preview.topics.find(t => t.studyBlockId === "block-review-again");
    assert(found !== undefined && found.selectionReason === "OVERDUE", "REVIEW_AGAIN vira overdue");
    assert(found?.carriedFromTopicId === "topic-123", "carriedFromTopicId deve ser preenchido");
    console.log("✓ Teste 5 concluído.");
  }

  // --- TESTE 6: PENDING de sessão vencida permanece elegível ---
  {
    console.log("Teste 6: PENDING de sessão vencida permanece elegível...");
    const db = new MockDatabase();

    const session = {
      id: "session-1",
      userId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
      sourcePeriodStart: new Date("2026-06-29T00:00:00Z"),
      sourcePeriodEnd: new Date("2026-07-04T23:59:59Z"),
      status: "COMPLETED" // Finalizada, mas este tópico ficou nulo/vazio
    };
    db.sessions.push(session);

    const block = {
      id: "block-pending",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Pending",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    };
    const topic = {
      id: "topic-pending-1",
      weeklyReviewSessionId: session.id,
      weeklyReviewSession: session,
      result: null
    };
    block.weeklyReviewTopicSources.push({
      weeklyReviewTopicId: topic.id,
      weeklyReviewTopic: topic,
      studyBlockId: block.id
    } as any);
    db.blocks.push(block);

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-12", "America/Sao_Paulo", 60, db.getClient());
    const found = preview.topics.find(t => t.studyBlockId === "block-pending");
    assert(found !== undefined && found.selectionReason === "OVERDUE", "PENDING de sessão concluída/vencida permanece elegível");
    console.log("✓ Teste 6 concluído.");
  }

  // --- TESTE 7: PENDING de sessão transferida e ainda ativa não é duplicado ---
  {
    console.log("Teste 7: PENDING de sessão transferida e ainda ativa não é duplicado...");
    const db = new MockDatabase();

    // Sessão com data original 05/07, mas transferida para 14/07
    const sessionActive = {
      id: "session-active",
      userId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      effectiveScheduledDate: new Date("2026-07-14T12:00:00Z"), // No futuro em relação a referenceDate
      sourcePeriodStart: new Date("2026-06-29T00:00:00Z"),
      sourcePeriodEnd: new Date("2026-07-04T23:59:59Z"),
      status: "PENDING"
    };
    db.sessions.push(sessionActive);

    const block = {
      id: "block-active-pending",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Active Pending",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    };
    const topic = {
      id: "topic-active-1",
      weeklyReviewSessionId: sessionActive.id,
      weeklyReviewSession: sessionActive,
      result: null
    };
    block.weeklyReviewTopicSources.push({
      weeklyReviewTopicId: topic.id,
      weeklyReviewTopic: topic,
      studyBlockId: block.id
    } as any);
    db.blocks.push(block);

    // Prévia rodada em 12/07. A sessão ativa está agendada para 14/07 (futuro).
    const preview = await buildWeeklyReviewPreview(userId, "2026-07-12", "America/Sao_Paulo", 60, db.getClient());
    assert(preview.totals.overdue === 0, "PENDING de sessão ativa/no futuro não deve virar overdue");
    console.log("✓ Teste 7 concluído.");
  }

  // --- TESTE 8: Sessão SKIPPED mantém elegibilidade ---
  {
    console.log("Teste 8: Sessão SKIPPED mantém elegibilidade...");
    const db = new MockDatabase();

    const sessionSkipped = {
      id: "session-skipped",
      userId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
      sourcePeriodStart: new Date("2026-06-29T00:00:00Z"),
      sourcePeriodEnd: new Date("2026-07-04T23:59:59Z"),
      status: "SKIPPED"
    };
    db.sessions.push(sessionSkipped);

    const block = {
      id: "block-skipped",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Skipped",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    };
    const topic = {
      id: "topic-skipped-1",
      weeklyReviewSessionId: sessionSkipped.id,
      weeklyReviewSession: sessionSkipped,
      result: "DID_WELL" // Mesmo com resultado, a sessão foi SKIPPED
    };
    block.weeklyReviewTopicSources.push({
      weeklyReviewTopicId: topic.id,
      weeklyReviewTopic: topic,
      studyBlockId: block.id
    } as any);
    db.blocks.push(block);

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-12", "America/Sao_Paulo", 60, db.getClient());
    const found = preview.topics.find(t => t.studyBlockId === "block-skipped");
    assert(found !== undefined && found.selectionReason === "OVERDUE", "Sessão SKIPPED deve reativar elegibilidade como overdue");
    console.log("✓ Teste 8 concluído.");
  }

  // --- TESTE 9 & 10: DID_WELL e HAD_DOUBTS removem elegibilidade ---
  {
    console.log("Teste 9/10: DID_WELL e HAD_DOUBTS removem elegibilidade...");
    const db = new MockDatabase();

    const session = {
      id: "session-1",
      userId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
      sourcePeriodStart: new Date("2026-06-29T00:00:00Z"),
      sourcePeriodEnd: new Date("2026-07-04T23:59:59Z"),
      status: "COMPLETED"
    };
    db.sessions.push(session);

    // Bloco com DID_WELL
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
      theoryCompletedAt: new Date("2026-07-01T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    };
    blockDidWell.weeklyReviewTopicSources.push({
      weeklyReviewTopicId: "t-did-well",
      weeklyReviewTopic: { id: "t-did-well", weeklyReviewSessionId: session.id, weeklyReviewSession: session, result: "DID_WELL" },
      studyBlockId: blockDidWell.id
    } as any);
    db.blocks.push(blockDidWell);

    // Bloco com HAD_DOUBTS
    const blockHadDoubts = {
      id: "block-had-doubts",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Had Doubts",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T11:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    };
    blockHadDoubts.weeklyReviewTopicSources.push({
      weeklyReviewTopicId: "t-had-doubts",
      weeklyReviewTopic: { id: "t-had-doubts", weeklyReviewSessionId: session.id, weeklyReviewSession: session, result: "HAD_DOUBTS" },
      studyBlockId: blockHadDoubts.id
    } as any);
    db.blocks.push(blockHadDoubts);

    // Bloco da matéria B para ser selecionado como LONG_UNSEEN
    db.blocks.push({
      id: "block-active-ancient",
      userId,
      subjectId: subjectActive.id,
      subject: subjectActive,
      materialId: material.id,
      material,
      title: "Bloco Antigo B",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-05-01T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    });

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-12", "America/Sao_Paulo", 60, db.getClient());
    assert(!preview.topics.some(t => t.studyBlockId === "block-did-well"), "DID_WELL remove elegibilidade");
    assert(!preview.topics.some(t => t.studyBlockId === "block-had-doubts"), "HAD_DOUBTS remove elegibilidade");
    console.log("✓ Teste 9 e 10 concluídos.");
  }

  // --- TESTE 11: LONG_UNSEEN considera blocos excedentes ---
  {
    console.log("Teste 11: LONG_UNSEEN considera blocos excedentes...");
    const db = new MockDatabase();

    // 13 blocos na semana atual para Matéria A (encher o limite de 12 WEEK_CONTENT)
    for (let i = 1; i <= 13; i++) {
      db.blocks.push({
        id: `block-week-A-${i}`,
        userId,
        subjectId: subjectPrimary.id,
        subject: subjectPrimary,
        materialId: material.id,
        material,
        title: `Bloco A ${i}`,
        status: "COMPLETED",
        theoryStatus: "COMPLETED",
        theoryCompletedAt: new Date("2026-07-01T10:00:00Z"),
        weeklyReviewTopicSources: [] as any[]
      });
    }

    // Bloco da Matéria B (ACTIVE) concluído na mesma data
    // Ele será um excedente da semana (pois o limite de 12 será todo ocupado pelos blocos de Matéria A)
    db.blocks.push({
      id: "block-excedente-B",
      userId,
      subjectId: subjectActive.id,
      subject: subjectActive,
      materialId: material.id,
      material,
      title: "Bloco Excedente B",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T11:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    });

    // Como as duas matérias tiveram teoria concluída na mesma semana, nenhuma das duas é eligible para LONG_UNSEEN
    // (pois ambas possuem conclusões dentro do sourcePeriod atual).
    const preview = await buildWeeklyReviewPreview(userId, "2026-07-05", "America/Sao_Paulo", 60, db.getClient());
    assert(preview.totals.longUnseen === 0, "Nenhuma matéria deve ser LONG_UNSEEN se todas têm teoria no período");
    console.log("✓ Teste 11 concluído.");
  }

  // --- TESTE 12: Matéria estudada no período atual não pode ser LONG_UNSEEN ---
  {
    console.log("Teste 12: Matéria estudada no período atual não pode ser LONG_UNSEEN...");
    const db = new MockDatabase();

    // Matéria A estudada na semana
    db.blocks.push({
      id: "block-week-A",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Semana A",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    });

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-05", "America/Sao_Paulo", 60, db.getClient());
    assert(!preview.topics.some(t => t.selectionReason === "LONG_UNSEEN" && t.subjectId === subjectPrimary.id), "Matéria vista na semana não vira LONG_UNSEEN");
    console.log("✓ Teste 12 concluído.");
  }

  // --- TESTE 13: LONG_UNSEEN é deduplicado por subjectId ---
  {
    console.log("Teste 13: LONG_UNSEEN é deduplicado por subjectId...");
    const db = new MockDatabase();

    // Bloco da Matéria A (WEEK_CONTENT)
    db.blocks.push({
      id: "block-week-A",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Semana A",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-07-01T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    });

    // Bloco antigo da Matéria A (PRIMARY)
    db.blocks.push({
      id: "block-old-A",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco Antigo A",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-06-01T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    });

    const preview = await buildWeeklyReviewPreview(userId, "2026-07-05", "America/Sao_Paulo", 60, db.getClient());
    // Matéria A já foi selecionada em WEEK_CONTENT. Portanto, seu bloco antigo não pode virar LONG_UNSEEN.
    assert(!preview.topics.some(t => t.selectionReason === "LONG_UNSEEN"), "Deduplicação de subjectId impede LONG_UNSEEN de mesma matéria");
    console.log("✓ Teste 13 concluído.");
  }

  // --- TESTE 14: Último contato usa MAX(theoryCompletedAt) de todos os blocos da matéria ---
  {
    console.log("Teste 14: Último contato usa MAX(theoryCompletedAt) de todos os blocos...");
    const db = new MockDatabase();

    db.sessions.push({
      id: "session-past-14",
      userId,
      originalScheduledDate: new Date("2026-06-20T12:00:00Z"),
      effectiveScheduledDate: new Date("2026-06-20T12:00:00Z"),
      sourcePeriodStart: new Date("2026-06-14T00:00:00Z"),
      sourcePeriodEnd: new Date("2026-06-19T23:59:59Z"),
      status: "COMPLETED"
    });

    // Matéria A tem conclusão antiga em 01/06 e conclusão recente em 15/06
    db.blocks.push({
      id: "block-A-1",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco A 1",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-06-01T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    });
    db.blocks.push({
      id: "block-A-2",
      userId,
      subjectId: subjectPrimary.id,
      subject: subjectPrimary,
      materialId: material.id,
      material,
      title: "Bloco A 2",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-06-15T10:00:00Z"), // Último contato real
      weeklyReviewTopicSources: [] as any[]
    });

    // Matéria B tem conclusão em 10/06
    db.blocks.push({
      id: "block-B-1",
      userId,
      subjectId: subjectActive.id,
      subject: subjectActive,
      materialId: material.id,
      material,
      title: "Bloco B 1",
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date("2026-06-10T10:00:00Z"),
      weeklyReviewTopicSources: [] as any[]
    });

    // Período da prévia em 05/07 (nenhuma estudada na semana)
    const preview = await buildWeeklyReviewPreview(userId, "2026-07-05", "America/Sao_Paulo", 60, db.getClient());
    
    // Comparação de contatos reais:
    // Matéria B = 10/06 (mais antiga que 15/06 da Matéria A).
    // Logo, Matéria B deve ser a escolhida!
    const longUnseenTopic = preview.topics.find(t => t.selectionReason === "LONG_UNSEEN");
    assert(longUnseenTopic?.subjectId === subjectActive.id, "Matéria B deve ser selecionada pois 10/06 é mais antigo que o contato máximo de A (15/06)");
    console.log("✓ Teste 14 concluído.");
  }

  // --- TESTE 15: Nenhum acesso à tabela QuestionReviewTask ---
  {
    console.log("Teste 15: Nenhum acesso a QuestionReviewTask...");
    const db = new MockDatabase();
    await buildWeeklyReviewPreview(userId, "2026-07-05", "America/Sao_Paulo", 60, db.getClient());
    assert(!db.queryLogs.some(log => log.toLowerCase().includes("questionreviewtask")), "Nenhuma consulta à QuestionReviewTask");
    console.log("✓ Teste 15 concluído.");
  }

  console.log("\n========================================================");
  console.log(`   ✓ TODOS OS TESTES PASSARAM! TOTAL DE ASSERTIONS: ${totalAssertions}  `);
  console.log("========================================================\n");
}

runTests().catch((e) => {
  console.error("\n❌ FALHA NOS TESTES ISOLADOS:", e.message);
  process.exit(1);
});
