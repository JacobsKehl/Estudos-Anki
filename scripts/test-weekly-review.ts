import { prisma } from "@/lib/prisma";
import { getTodayRangeSP } from "@/lib/date-utils";

import {
  buildWeeklyReviewPreview,
  suggestQuestionCount,
  buildWeeklyReviewGroupKey,
  getWeeklyReviewPeriod
} from "@/lib/services/weekly-review";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERT FAILURE] ${message}`);
  }
}

async function clearDatabaseForUser(tx: any, userId: string) {
  // Limpar tabelas da revisão semanal e blocos de estudo
  await tx.weeklyReviewTopicSource.deleteMany({
    where: { weeklyReviewTopic: { weeklyReviewSession: { userId } } }
  });
  await tx.weeklyReviewTopic.deleteMany({
    where: { weeklyReviewSession: { userId } }
  });
  await tx.weeklyReviewSession.deleteMany({
    where: { userId }
  });
  await tx.studyBlock.deleteMany({
    where: { userId }
  });
}

async function runTests() {
  console.log("\n========================================================");
  console.log("   INICIANDO TESTES DO MOTOR DE SELEÇÃO DA REVISÃO      ");
  console.log("========================================================\n");

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Criar usuário e matérias de teste
      const user = await tx.user.create({
        data: {
          name: "Test User",
          email: "test.review.motor@test.com"
        }
      });
      const userId = user.id;

      // Matéria A (PRIMARY)
      const subjectPrimary = await tx.studySubject.create({
        data: {
          userId,
          name: "Matéria Primária A",
          studyPriority: "PRIMARY",
          examWeight: 2.0,
          priority: 5
        }
      });

      // Matéria B (ACTIVE)
      const subjectActive = await tx.studySubject.create({
        data: {
          userId,
          name: "Matéria Ativa B",
          studyPriority: "ACTIVE",
          examWeight: 1.0,
          priority: 3
        }
      });

      // Matéria C (SECONDARY)
      const subjectSecondary = await tx.studySubject.create({
        data: {
          userId,
          name: "Matéria Secundária C",
          studyPriority: "SECONDARY"
        }
      });

      // Matéria D (EXCLUDED)
      await tx.studySubject.create({
        data: {
          userId,
          name: "Matéria Excluída D",
          studyPriority: "EXCLUDED"
        }
      });

      // Material
      const material = await tx.studyMaterial.create({
        data: {
          userId,
          fileName: "material_teste.pdf",
          mimeType: "application/pdf"
        }
      });

      // --- TESTE 1: Questões sugeridas por tempo ---
      console.log("Teste 1: Validando sugeridor de questões por tempo...");
      assert(suggestQuestionCount(30) === 10, "30 min deve sugerir 10");
      assert(suggestQuestionCount(60) === 20, "60 min deve sugerir 20");
      assert(suggestQuestionCount(90) === 30, "90 min deve sugerir 30");
      assert(suggestQuestionCount(120) === 40, "120 min deve sugerir 40");
      assert(suggestQuestionCount(15) === 5, "mínimo de 5 questões");
      assert(suggestQuestionCount(200) === 50, "máximo de 50 questões");
      console.log("✓ Teste 1 concluído.");

      // --- TESTE 2: groupKey estável ---
      console.log("Teste 2: Validando hash do groupKey...");
      const keyNormal = buildWeeklyReviewGroupKey("subjA", ["block1"]);
      const keyCarryover = buildWeeklyReviewGroupKey("subjA", ["block1"], "prevTopic1");
      assert(keyNormal !== keyCarryover, "groupKey de carryover deve ser diferente");
      assert(
        keyNormal === buildWeeklyReviewGroupKey("subjA", ["block1"]),
        "deve ser determinístico"
      );
      console.log("✓ Teste 2 concluído.");

      // --- TESTE 3: Primeira sessão considera 6 dias ativos ---
      console.log("Teste 3: Validando cálculo do período semanal...");
      await clearDatabaseForUser(tx, userId);
      const baseDate = new Date("2026-07-15T12:00:00Z"); // Uma Quinta-feira
      const activeBlocks = [];
      for (let i = 1; i <= 7; i++) {
        const complDate = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000); // i dias atrás
        const block = await tx.studyBlock.create({
          data: {
            userId,
            subjectId: subjectPrimary.id,
            materialId: material.id,
            title: `Bloco Ativo ${i}`,
            pageStart: i * 10,
            pageEnd: i * 10 + 5,
            status: "COMPLETED",
            theoryStatus: "COMPLETED",
            theoryCompletedAt: complDate
          }
        });
        activeBlocks.push(block);
      }

      const range = await (getWeeklyReviewPeriod as any)(userId, baseDate, "America/Sao_Paulo", tx);
      const startStr = getTodayRangeSP(range.sourcePeriodStart).dateString;
      const expectedStartStr = getTodayRangeSP(activeBlocks[5].theoryCompletedAt!).dateString;
      assert(startStr === expectedStartStr, `Início do período da 1ª sessão deve ser o 6º dia ativo (${expectedStartStr}), mas veio: ${startStr}`);
      console.log("✓ Teste 3 concluído.");

      // --- TESTE 4: Exclusão de SECONDARY/EXCLUDED e teoria incompleta ---
      console.log("Teste 4: Validando restrições de elegibilidade...");
      await clearDatabaseForUser(tx, userId);
      // Bloco de matéria SECONDARY (COMPLETED)
      const bSecondary = await tx.studyBlock.create({
        data: {
          userId,
          subjectId: subjectSecondary.id,
          materialId: material.id,
          title: "Bloco Secundário",
          pageStart: 10,
          pageEnd: 15,
          status: "COMPLETED",
          theoryStatus: "COMPLETED",
          theoryCompletedAt: new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000)
        }
      });

      // Bloco incompleto (NOT_STARTED)
      const bIncomplete = await tx.studyBlock.create({
        data: {
          userId,
          subjectId: subjectPrimary.id,
          materialId: material.id,
          title: "Bloco Incompleto",
          pageStart: 20,
          pageEnd: 25,
          status: "NOT_STARTED",
          theoryStatus: "NOT_STARTED"
        }
      });

      const preview = await (buildWeeklyReviewPreview as any)(
        userId,
        "2026-07-15",
        "America/Sao_Paulo",
        60,
        tx
      );

      const foundSecondary = preview.topics.some((t: any) => t.studyBlockId === bSecondary.id);
      const foundIncomplete = preview.topics.some((t: any) => t.studyBlockId === bIncomplete.id);
      assert(!foundSecondary, "matéria SECONDARY não deve ser incluída");
      assert(!foundIncomplete, "bloco incompleto não deve ser incluído");
      console.log("✓ Teste 4 concluído.");

      // --- TESTE 5: Limites e prioridades dos Grupos ---
      console.log("Teste 5: Validando limites de seleção (12 + 2 + 1)...");
      await clearDatabaseForUser(tx, userId);
      const periodBlocks = [];
      const studyDate = new Date("2026-07-14T10:00:00Z"); // Dia anterior
      for (let i = 0; i < 15; i++) {
        const block = await tx.studyBlock.create({
          data: {
            userId,
            subjectId: subjectPrimary.id,
            materialId: material.id,
            title: `Bloco Período ${i}`,
            pageStart: i * 5,
            pageEnd: i * 5 + 4,
            status: "COMPLETED",
            theoryStatus: "COMPLETED",
            theoryCompletedAt: studyDate
          }
        });
        periodBlocks.push(block);
      }

      const previewLimit = await (buildWeeklyReviewPreview as any)(
        userId,
        "2026-07-15",
        "America/Sao_Paulo",
        60,
        tx
      );

      assert(previewLimit.totals.weekContent === 12, "deve selecionar no máximo 12 assuntos da semana");
      assert(previewLimit.totals.overdue === 2, "deve selecionar 2 atrasados");
      assert(previewLimit.totals.excessWeekContent === 1, `deve reter 1 excedente da semana, mas veio: ${previewLimit.totals.excessWeekContent}`);
      console.log("✓ Teste 5 concluído.");

      // --- TESTE 6: REVIEW_AGAIN, DID_WELL, HAD_DOUBTS ---
      console.log("Teste 6: Validando estados de revisão...");
      await clearDatabaseForUser(tx, userId);
      
      // Criar bloco com revisão concluída como DID_WELL
      const blockDidWell = await tx.studyBlock.create({
        data: {
          userId,
          subjectId: subjectPrimary.id,
          materialId: material.id,
          title: "Bloco Did Well",
          pageStart: 1,
          pageEnd: 5,
          status: "COMPLETED",
          theoryStatus: "COMPLETED",
          theoryCompletedAt: new Date("2026-07-10T10:00:00Z")
        }
      });
      const sessionPassed = await tx.weeklyReviewSession.create({
        data: {
          userId,
          originalScheduledDate: new Date("2026-07-05"),
          effectiveScheduledDate: new Date("2026-07-05"),
          sourcePeriodStart: new Date("2026-07-01"),
          sourcePeriodEnd: new Date("2026-07-04"),
          status: "COMPLETED",
          missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
        }
      });
      const topicDidWell = await tx.weeklyReviewTopic.create({
        data: {
          weeklyReviewSessionId: sessionPassed.id,
          subjectId: subjectPrimary.id,
          sourceSubjectName: "Matéria Primária A",
          displayTitle: "Bloco Did Well",
          groupKey: "key-did-well",
          selectionReason: "WEEK_CONTENT",
          result: "DID_WELL"
        }
      });
      await tx.weeklyReviewTopicSource.create({
        data: {
          weeklyReviewTopicId: topicDidWell.id,
          studyBlockId: blockDidWell.id,
          sourceBlockTitle: blockDidWell.title,
          sourceStudyDate: blockDidWell.theoryCompletedAt!
        }
      });

      // Criar bloco com revisão marcada como REVIEW_AGAIN
      const blockReviewAgain = await tx.studyBlock.create({
        data: {
          userId,
          subjectId: subjectPrimary.id,
          materialId: material.id,
          title: "Bloco Review Again",
          pageStart: 6,
          pageEnd: 10,
          status: "COMPLETED",
          theoryStatus: "COMPLETED",
          theoryCompletedAt: new Date("2026-07-10T10:00:00Z")
        }
      });
      const topicReviewAgain = await tx.weeklyReviewTopic.create({
        data: {
          weeklyReviewSessionId: sessionPassed.id,
          subjectId: subjectPrimary.id,
          sourceSubjectName: "Matéria Primária A",
          displayTitle: "Bloco Review Again",
          groupKey: "key-review-again",
          selectionReason: "WEEK_CONTENT",
          result: "REVIEW_AGAIN"
        }
      });
      await tx.weeklyReviewTopicSource.create({
        data: {
          weeklyReviewTopicId: topicReviewAgain.id,
          studyBlockId: blockReviewAgain.id,
          sourceBlockTitle: blockReviewAgain.title,
          sourceStudyDate: blockReviewAgain.theoryCompletedAt!
        }
      });

      const previewStates = await (buildWeeklyReviewPreview as any)(
        userId,
        "2026-07-15",
        "America/Sao_Paulo",
        60,
        tx
      );

      const foundDidWell = previewStates.topics.some((t: any) => t.studyBlockId === blockDidWell.id);
      const foundReviewAgain = previewStates.topics.find((t: any) => t.studyBlockId === blockReviewAgain.id);

      assert(!foundDidWell, "DID_WELL não deve ser elegível para nova revisão");
      assert(foundReviewAgain !== undefined, "REVIEW_AGAIN deve ser elegível como OVERDUE");
      assert(foundReviewAgain?.carriedFromTopicId === topicReviewAgain.id, "carriedFromTopicId deve apontar para o tópico anterior");
      console.log("✓ Teste 6 concluído.");

      // --- TESTE 7: Grupo C - Matéria há mais tempo sem contato ---
      console.log("Teste 7: Validando seleção da matéria sem contato (Grupo C)...");
      await clearDatabaseForUser(tx, userId);

      // Criar sessão passada em 2026-07-05 para o período da semana atual começar em 2026-07-06
      const lastSessionPassed = await tx.weeklyReviewSession.create({
        data: {
          userId,
          originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
          effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
          sourcePeriodStart: new Date("2026-07-01T00:00:00Z"),
          sourcePeriodEnd: new Date("2026-07-04T23:59:59Z"),
          status: "COMPLETED",
          missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
        }
      });

      // Criar bloco na Matéria A (concluído em 14/07 - dentro da semana)
      await tx.studyBlock.create({
        data: {
          userId,
          subjectId: subjectPrimary.id,
          materialId: material.id,
          title: "Assunto Matéria A",
          pageStart: 1,
          pageEnd: 5,
          status: "COMPLETED",
          theoryStatus: "COMPLETED",
          theoryCompletedAt: new Date("2026-07-14T10:00:00Z")
        }
      });

      // Criar 2 blocos de Matéria A concluídos fora da semana para ocupar os 2 slots de OVERDUE
      for (let i = 1; i <= 2; i++) {
        const blockOverdue = await tx.studyBlock.create({
          data: {
            userId,
            subjectId: subjectPrimary.id,
            materialId: material.id,
            title: `Bloco Overdue A ${i}`,
            pageStart: 10 + i,
            pageEnd: 15 + i,
            status: "COMPLETED",
            theoryStatus: "COMPLETED",
            theoryCompletedAt: new Date("2026-07-02T10:00:00Z")
          }
        });
        const topic = await tx.weeklyReviewTopic.create({
          data: {
            weeklyReviewSessionId: lastSessionPassed.id,
            subjectId: subjectPrimary.id,
            sourceSubjectName: "Matéria Primária A",
            displayTitle: blockOverdue.title,
            groupKey: `key-overdue-${i}`,
            selectionReason: "WEEK_CONTENT",
            result: "REVIEW_AGAIN"
          }
        });
        await tx.weeklyReviewTopicSource.create({
          data: {
            weeklyReviewTopicId: topic.id,
            studyBlockId: blockOverdue.id,
            sourceBlockTitle: blockOverdue.title,
            sourceStudyDate: blockOverdue.theoryCompletedAt!
          }
        });
      }

      // Criar bloco na Matéria B (concluído fora da semana, em 01/07) - não é WEEK_CONTENT nem OVERDUE (já cheio)
      await tx.studyBlock.create({
        data: {
          userId,
          subjectId: subjectActive.id,
          materialId: material.id,
          title: "Assunto Matéria B",
          pageStart: 1,
          pageEnd: 5,
          status: "COMPLETED",
          theoryStatus: "COMPLETED",
          theoryCompletedAt: new Date("2026-07-01T10:00:00Z")
        }
      });

      const previewGroupC = await (buildWeeklyReviewPreview as any)(
        userId,
        "2026-07-15",
        "America/Sao_Paulo",
        60,
        tx
      );

      const longUnseenTopic = previewGroupC.topics.find((t: any) => t.selectionReason === "LONG_UNSEEN");
      assert(longUnseenTopic !== undefined, "deve encontrar 1 assunto de matéria sem contato");
      assert(longUnseenTopic?.subjectId === subjectActive.id, `deve pertencer à Matéria Ativa B (${subjectActive.id}), mas veio: ${longUnseenTopic?.subjectId}`);
      console.log("✓ Teste 7 concluído.");

      // Forçar o rollback para garantir conformidade (Operational Security Rule 5)
      throw new Error("ROLLBACK_CONTROLLED");
    }, { timeout: 30000 });
  } catch (error: any) {
    if (error.message === "ROLLBACK_CONTROLLED") {
      console.log("\n========================================================");
      console.log("   ✓ TODOS OS TESTES PASSARAM E BANCO FOI RESETADO!     ");
      console.log("========================================================\n");
    } else {
      console.error("\n❌ FALHA NOS TESTES DO MOTOR DE SELEÇÃO:", error.message);
      process.exit(1);
    }
  }
}

runTests();
