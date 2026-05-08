import { prisma } from "@/lib/prisma";

export async function generateStudyPlan(userId: string, planInput: { estimatedExamDate: Date; dailyStudyMinutes: number; availableWeekDays: number[]; }) {
  const contents = await prisma.extractedContent.findMany({ where: { material: { userId } }, orderBy: [{ subjectId: "asc" }, { orderIndex: "asc" }] });
  const studyPlan = await prisma.studyPlan.create({
    data: {
      userId,
      estimatedExamDate: planInput.estimatedExamDate,
      dailyStudyMinutes: planInput.dailyStudyMinutes,
      availableWeekDays: planInput.availableWeekDays,
    },
  });

  let dayNumber = 1;
  let scheduledDate = new Date();
  for (const content of contents) {
    while (!planInput.availableWeekDays.includes(scheduledDate.getDay())) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    await prisma.studyPlanDay.create({
      data: {
        studyPlanId: studyPlan.id,
        dayNumber,
        scheduledDate: new Date(scheduledDate),
        subjectId: content.subjectId!,
        contentId: content.id,
      },
    });

    dayNumber += 1;
    scheduledDate.setDate(scheduledDate.getDate() + 1);
  }

  return studyPlan;
}
