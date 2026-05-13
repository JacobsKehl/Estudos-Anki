/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "./prisma";

interface ScheduleOptions {
  title: string;
  dailyMinutes: number;
  startDate: Date;
}

export async function generateSimpleSchedule(userId: string, options: ScheduleOptions) {
  // 1. Buscar todos os blocos ainda não iniciados
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

  // 2. Desativar cronogramas ativos anteriores (evitar duplicatas)
  await (prisma as any).studySchedule.updateMany({
    where: { userId, status: "ACTIVE" },
    data: { status: "ARCHIVED" }
  });

  // 3. Criar o novo cronograma principal
  const schedule = await (prisma as any).studySchedule.create({
    data: {
      userId,
      title: options.title,
      dailyStudyMinutes: options.dailyMinutes,
      startDate: options.startDate,
      status: "ACTIVE"
    }
  });

  // 4. Distribuir blocos nos dias
  let currentDay = 1;
  let currentDayMinutes = 0;
  const scheduleItemsData = [];

  for (const block of blocks) {
    const blockMinutes = block.estimatedStudyMinutes || 30;

    // Se adicionar esse bloco excede o limite diário, avança para o próximo dia
    // (garante pelo menos um bloco por dia se o dia estiver vazio)
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

  // 5. Criar os itens em lote
  await (prisma as any).studyScheduleItem.createMany({
    data: scheduleItemsData
  });

  return schedule;
}
