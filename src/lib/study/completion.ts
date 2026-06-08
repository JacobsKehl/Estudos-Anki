import { prisma } from "@/lib/prisma";
import { getTodayRangeSP } from "@/lib/date-utils";

/**
 * Completes a study block and synchronizes it with the schedule.
 * Also schedules spaced review sessions for the block.
 */
export async function completeStudyBlock(userId: string, blockId: string, scheduleItemId?: string) {
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    // 1. Update the StudyBlock
    const block = await tx.studyBlock.update({
      where: { id: blockId },
      data: {
        status: "COMPLETED",
        theoryStatus: "COMPLETED",
        theoryCompletedAt: now,
        lastStudiedAt: now,
        nextActionType: "REVIEW_BLOCK",
        // Set future review checkpoints
        review1dScheduledAt: addDays(now, 1),
        review7dScheduledAt: addDays(now, 7),
        review15dScheduledAt: addDays(now, 15),
        review30dScheduledAt: addDays(now, 30),
      },
    });

    // 2. Synchronize with Schedule Item
    const activeSchedule = await (tx as any).studySchedule.findFirst({
      where: { userId, status: "ACTIVE" }
    });

    let scheduleItem;
    const todayRange = getTodayRangeSP(now);
    
    // Local helper to find replacement block for early completed theory tasks
    const findReplacementBlock = async (tx: any) => {
      if (!activeSchedule) return null;

      // 1. Obter matérias elegíveis do usuário (não EXCLUDED)
      const eligibleSubjects = await tx.studySubject.findMany({
        where: {
          userId,
          studyPriority: { not: "EXCLUDED" }
        }
      });
      const eligibleSubjectIds = eligibleSubjects.map((s: any) => s.id);

      // 2. IDs de blocos já agendados como PENDING ou IN_PROGRESS no cronograma ativo
      const scheduledBlockItems = await tx.studyScheduleItem.findMany({
        where: {
          userId,
          scheduleId: activeSchedule.id,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          studyBlockId: { not: null }
        },
        select: { studyBlockId: true }
      });
      const scheduledBlockIds = scheduledBlockItems.map((item: any) => item.studyBlockId).filter(Boolean);

      // 3. Buscar todos os blocos candidatos NOT_STARTED pertencentes a matérias elegíveis,
      // excluindo os já agendados e o bloco recém-concluído (blockId).
      const candidateBlocks = await tx.studyBlock.findMany({
        where: {
          userId,
          subjectId: { in: eligibleSubjectIds },
          status: "NOT_STARTED",
          id: { notIn: [...scheduledBlockIds, blockId] },
          material: {
            materialRole: { not: "SUPPORT_MATERIAL" }
          }
        },
        include: {
          subject: true
        }
      });

      const priorityWeights: Record<string, number> = {
        PRIMARY: 3,
        ACTIVE: 2,
        SECONDARY: 1,
        EXCLUDED: 0
      };

      const sameSubjectCandidates = candidateBlocks.filter((b: any) => b.subjectId === block.subjectId);
      const otherSubjectCandidates = candidateBlocks.filter((b: any) => b.subjectId !== block.subjectId);

      const sortBlocks = (a: any, b: any) => {
        if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
        if (a.pageStart !== b.pageStart) return a.pageStart - b.pageStart;
        return a.id.localeCompare(b.id);
      };

      sameSubjectCandidates.sort(sortBlocks);

      otherSubjectCandidates.sort((a: any, b: any) => {
        const weightA = priorityWeights[a.subject?.studyPriority] || 0;
        const weightB = priorityWeights[b.subject?.studyPriority] || 0;
        if (weightA !== weightB) return weightB - weightA; // Descending weight
        return sortBlocks(a, b);
      });

      return sameSubjectCandidates[0] || otherSubjectCandidates[0] || null;
    };
    
    if (scheduleItemId) {
      const targetItem = await (tx as any).studyScheduleItem.findUnique({
        where: { id: scheduleItemId }
      });

      if (targetItem) {
        const isAntecipado = targetItem.scheduledDate >= todayRange.end;
        if (isAntecipado && targetItem.actionType === "THEORY" && activeSchedule) {
          // A. Registrar que estudou hoje (conclusão antecipada)
          await (tx as any).studyScheduleItem.create({
            data: {
              userId,
              scheduleId: activeSchedule.id,
              subjectId: block.subjectId,
              materialId: block.materialId,
              studyBlockId: blockId,
              actionType: "THEORY",
              priorityScore: targetItem.priorityScore || 90,
              reason: "Estudo Antecipado",
              dayNumber: targetItem.dayNumber || 1,
              scheduledDate: now,
              completedAt: now,
              status: "COMPLETED",
            }
          });

          // B. Buscar o próximo bloco de estudo substituto elegível
          const replacementBlock = await findReplacementBlock(tx);

          if (replacementBlock) {
            scheduleItem = await tx.studyScheduleItem.update({
              where: { id: targetItem.id },
              data: {
                studyBlockId: replacementBlock.id,
                materialId: replacementBlock.materialId,
                subjectId: replacementBlock.subjectId,
                status: "PENDING",
                completedAt: null
              }
            });
          } else {
            await tx.studyScheduleItem.delete({
              where: { id: targetItem.id }
            });
            scheduleItem = null;
          }
        } else {
          scheduleItem = await tx.studyScheduleItem.update({
            where: { id: scheduleItemId },
            data: {
              status: "COMPLETED",
              completedAt: now,
            },
          });
        }
      }
    } else if (activeSchedule) {
      // Find matching pending or in-progress schedule item for this block in the active schedule
      const match = await (tx as any).studyScheduleItem.findFirst({
        where: {
          userId,
          scheduleId: activeSchedule.id,
          studyBlockId: blockId,
          actionType: "THEORY",
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        orderBy: { scheduledDate: "asc" }
      });

      if (match) {
        const isAntecipado = match.scheduledDate >= todayRange.end;
        if (isAntecipado) {
          // A. Registrar que estudou hoje (conclusão antecipada)
          await (tx as any).studyScheduleItem.create({
            data: {
              userId,
              scheduleId: activeSchedule.id,
              subjectId: block.subjectId,
              materialId: block.materialId,
              studyBlockId: blockId,
              actionType: "THEORY",
              priorityScore: match.priorityScore || 90,
              reason: "Estudo Antecipado",
              dayNumber: match.dayNumber || 1,
              scheduledDate: now,
              completedAt: now,
              status: "COMPLETED",
            }
          });

          // B. Buscar o próximo bloco de estudo substituto elegível
          const replacementBlock = await findReplacementBlock(tx);

          if (replacementBlock) {
            scheduleItem = await tx.studyScheduleItem.update({
              where: { id: match.id },
              data: {
                studyBlockId: replacementBlock.id,
                materialId: replacementBlock.materialId,
                subjectId: replacementBlock.subjectId,
                status: "PENDING",
                completedAt: null
              }
            });
          } else {
            await tx.studyScheduleItem.delete({
              where: { id: match.id }
            });
            scheduleItem = null;
          }
        } else {
          scheduleItem = await tx.studyScheduleItem.update({
            where: { id: match.id },
            data: {
              status: "COMPLETED",
              completedAt: now,
            },
          });
        }
      } else {
        console.info(`[completeStudyBlock] Nenhum StudyScheduleItem pendente/em progresso do tipo THEORY encontrado para o bloco ${blockId} no cronograma ativo.`);
        
        // Se o bloco foi concluído sem tarefa pendente correspondente, criamos uma tarefa
        // de forma concluída no cronograma ativo atual para sincronizar em tempo real.
        scheduleItem = await (tx as any).studyScheduleItem.create({
          data: {
            userId,
            scheduleId: activeSchedule.id,
            subjectId: block.subjectId,
            materialId: block.materialId,
            studyBlockId: blockId,
            actionType: "THEORY",
            priorityScore: 90,
            reason: "Concluído diretamente na matéria",
            dayNumber: 1,
            scheduledDate: now,
            completedAt: now,
            status: "COMPLETED",
          }
        });
      }
    }

    // 3. Schedule next review items in the schedule (D+1)
    if (block.subjectId && activeSchedule) {
      // SÓ criar REVIEW_BLOCK se existirem flashcards ativos/revisáveis para o bloco
      const activeCardsCount = await tx.flashcard.count({
        where: {
          studyBlockId: block.id,
          status: "APPROVED",
          reviewState: { in: ["NEW", "LEARNING", "REVIEW", "RELEARNING"] }
        }
      });

      if (activeCardsCount > 0) {
        // Prevent duplication of pending D+1 reviews
        const existingPendingReview = await (tx as any).studyScheduleItem.findFirst({
          where: {
            userId,
            scheduleId: activeSchedule.id,
            studyBlockId: block.id,
            actionType: "REVIEW_BLOCK",
            status: "PENDING",
          }
        });

        if (!existingPendingReview) {
          await (tx as any).studyScheduleItem.create({
            data: {
              userId,
              scheduleId: activeSchedule.id,
              subjectId: block.subjectId,
              materialId: block.materialId,
              studyBlockId: block.id,
              actionType: "REVIEW_BLOCK",
              reason: `Revisão D+1: ${block.title}`,
              scheduledDate: addDays(now, 1),
              dayNumber: 1, // Will be calculated by schedule logic if needed
              priorityScore: 80, // High priority for reviews
              status: "PENDING",
            }
          });
        } else {
          console.info(`[completeStudyBlock] Já existe revisão D+1 pendente para o bloco ${block.id}. Pulando duplicação.`);
        }
      } else {
        console.info(`[completeStudyBlock] Bloco ${block.id} não possui flashcards ativos/revisáveis. Não agendando REVIEW_BLOCK.`);
      }
    }

    return {
      block,
      scheduleItem,
      message: "Conteúdo concluído. Agendamos suas revisões e seus flashcards já estão disponíveis para curadoria."
    };
  });
}

/**
 * Reopens a study block and resets its schedule synchronization.
 * Also removes any future unscheduled reviews.
 */
export async function reopenStudyBlock(userId: string, blockId: string, targetStatus: string = "NOT_STARTED") {
  return await prisma.$transaction(async (tx) => {
    let blockStatus = targetStatus;
    if (targetStatus === "PENDING") {
      blockStatus = "NOT_STARTED";
    }

    // 1. Update the StudyBlock status and reset dates
    const block = await tx.studyBlock.update({
      where: { id: blockId },
      data: {
        status: blockStatus,
        theoryStatus: "NOT_STARTED",
        theoryCompletedAt: null,
        nextActionType: "THEORY",
        review1dScheduledAt: null,
        review7dScheduledAt: null,
        review15dScheduledAt: null,
        review30dScheduledAt: null,
        review1dCompletedAt: null,
        review7dCompletedAt: null,
        review15dCompletedAt: null,
        review30dCompletedAt: null,
      },
    });

    // 2. Reopen the associated schedule item (THEORY that matches this block and is completed)
    // Find the active schedule first to prioritize updating its item
    const activeSchedule = await (tx as any).studySchedule.findFirst({
      where: { userId, status: "ACTIVE" }
    });

    let matchingItem = null;
    if (activeSchedule) {
      matchingItem = await (tx as any).studyScheduleItem.findFirst({
        where: {
          userId,
          scheduleId: activeSchedule.id,
          studyBlockId: blockId,
          actionType: "THEORY",
          status: "COMPLETED",
        },
        orderBy: { completedAt: "desc" }
      });
    }

    let scheduleItem;
    if (matchingItem) {
      let scheduleStatus = "PENDING";
      if (targetStatus === "IN_PROGRESS") {
        scheduleStatus = "IN_PROGRESS";
      } else if (targetStatus === "SKIPPED") {
        scheduleStatus = "SKIPPED";
      }

      scheduleItem = await tx.studyScheduleItem.update({
        where: { id: matchingItem.id },
        data: {
          status: scheduleStatus,
          completedAt: null,
        },
      });
    }

    // 3. Delete any scheduled future reviews for this block that are still PENDING
    await (tx as any).studyScheduleItem.deleteMany({
      where: {
        userId,
        studyBlockId: blockId,
        actionType: "REVIEW_BLOCK",
        status: "PENDING",
      },
    });

    return {
      block,
      scheduleItem,
      message: "Bloco reaberto com sucesso."
    };
  });
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
