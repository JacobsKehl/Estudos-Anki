import { prisma } from "@/lib/prisma";

/**
 * Completes a study block and synchronizes it with the schedule.
 * Also schedules spaced review sessions for the block.
 */
export async function completeStudyBlock(userId: string, blockId: string, scheduleItemId?: string) {
  const now = new Date();

  // 1. Update the StudyBlock
  const block = await prisma.studyBlock.update({
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
    scheduleItem = await prisma.studyScheduleItem.update({
      where: { id: scheduleItemId },
      data: {
        status: "COMPLETED",
        completedAt: now,
      },
    });
  } else {
    // Try to find the best match for the block today or in progress
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const match = await (prisma as any).studyScheduleItem.findFirst({
      where: {
        userId,
        studyBlockId: blockId,
        status: { not: "COMPLETED" },
        OR: [
          { scheduledDate: { gte: today, lt: tomorrow } },
          { status: "IN_PROGRESS" }
        ]
      },
      orderBy: { scheduledDate: "asc" }
    });

    if (match) {
      scheduleItem = await prisma.studyScheduleItem.update({
        where: { id: match.id },
        data: {
          status: "COMPLETED",
          completedAt: now,
        },
      });
    }
  }

  // 3. Schedule next review items in the schedule (D+1)
  // Note: D+7, D+15, D+30 can be handled by the adaptive scheduler later,
  // but we'll add the D+1 immediate priority item here.
  if (block.subjectId) {
    const activeSchedule = await (prisma as any).studySchedule.findFirst({
      where: { userId, status: "ACTIVE" }
    });

    if (activeSchedule) {
      await (prisma as any).studyScheduleItem.create({
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
    }
  }

  return {
    block,
    scheduleItem,
    message: "Conteúdo concluído. Agendamos suas revisões e seus flashcards já estão disponíveis para curadoria."
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
