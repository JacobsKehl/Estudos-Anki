/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "./prisma";

interface ScheduleOptions {
  title: string;
  dailyMinutes: number;
  startDate: Date;
}

export async function generateSimpleSchedule(userId: string, options: ScheduleOptions) {
  // 1. Fetch all NOT_STARTED study blocks
  const blocks = await (prisma as any).studyBlock.findMany({
    where: {
      userId,
      status: "NOT_STARTED"
    },
    include: {
      subject: true,
      material: true
    },
    orderBy: [
      { subject: { priority: "desc" } },
      { orderIndex: "asc" }
    ]
  });

  if (blocks.length === 0) return null;

  // 2. Create the main schedule record
  const schedule = await (prisma as any).studySchedule.create({
    data: {
      userId,
      title: options.title,
      dailyStudyMinutes: options.dailyMinutes,
      startDate: options.startDate,
      status: "ACTIVE"
    }
  });

  // 3. Distribute blocks into days
  let currentDay = 1;
  let currentDayMinutes = 0;
  const scheduleItemsData = [];

  for (const block of blocks) {
    const blockMinutes = block.estimatedStudyMinutes || 30; // Default to 30 if missing

    // If adding this block exceeds daily limit, move to next day
    // (But always put at least one block per day if day is empty)
    if (currentDayMinutes > 0 && currentDayMinutes + blockMinutes > options.dailyMinutes) {
      currentDay++;
      currentDayMinutes = 0;
    }

    const scheduledDate = new Date(options.startDate);
    scheduledDate.setDate(scheduledDate.getDate() + (currentDay - 1));

    scheduleItemsData.push({
      userId,
      scheduleId: schedule.id,
      subjectId: block.subjectId,
      materialId: block.materialId,
      studyBlockId: block.id,
      dayNumber: currentDay,
      scheduledDate,
      estimatedMinutes: blockMinutes,
      status: "PENDING"
    });

    currentDayMinutes += blockMinutes;
  }

  // 4. Batch create items
  await (prisma as any).studyScheduleItem.createMany({
    data: scheduleItemsData
  });

  return schedule;
}
