import { prisma } from "@/lib/prisma";

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
    let scheduleItem;
    
    if (scheduleItemId) {
      scheduleItem = await tx.studyScheduleItem.update({
        where: { id: scheduleItemId },
        data: {
          status: "COMPLETED",
          completedAt: now,
        },
      });
    } else {
      // Find matching pending or in-progress schedule item for this block
      const match = await (tx as any).studyScheduleItem.findFirst({
        where: {
          userId,
          studyBlockId: blockId,
          actionType: "THEORY",
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        orderBy: { scheduledDate: "asc" }
      });

      if (match) {
        scheduleItem = await tx.studyScheduleItem.update({
          where: { id: match.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
          },
        });
      } else {
        console.info(`[completeStudyBlock] Nenhum StudyScheduleItem pendente/em progresso do tipo THEORY encontrado para o bloco ${blockId}.`);
      }
    }

    // 3. Schedule next review items in the schedule (D+1)
    if (block.subjectId) {
      const activeSchedule = await (tx as any).studySchedule.findFirst({
        where: { userId, status: "ACTIVE" }
      });

      if (activeSchedule) {
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

    // 2. Reopen the associated schedule item (THEORY that matches this block)
    const matchingItem = await (tx as any).studyScheduleItem.findFirst({
      where: {
        userId,
        studyBlockId: blockId,
        actionType: "THEORY",
      },
      orderBy: { scheduledDate: "desc" }
    });

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
