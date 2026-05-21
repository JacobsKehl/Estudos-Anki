import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    console.log(`[DEBUG-SYNC] Usuário identificado: ${userId}`);

    // 2. Find the active schedule
    const activeSchedule = await prisma.studySchedule.findFirst({
      where: { userId, status: "ACTIVE" }
    });

    if (!activeSchedule) {
      return NextResponse.json({
        error: "Nenhum cronograma ATIVO encontrado para o usuário."
      }, { status: 404 });
    }

    console.log(`[DEBUG-SYNC] Cronograma Ativo encontrado: ${activeSchedule.title} (ID: ${activeSchedule.id})`);

    // 3. Find completed study blocks
    const completedBlocks = await prisma.studyBlock.findMany({
      where: { userId, status: "COMPLETED" }
    });

    console.log(`[DEBUG-SYNC] Total de blocos concluídos no banco: ${completedBlocks.length}`);

    let createdCount = 0;
    let updatedCount = 0;
    const details: string[] = [];

    for (const block of completedBlocks) {
      const completionDate = block.theoryCompletedAt || block.lastStudiedAt || new Date();

      // Check if there is already a THEORY item for this block in the active schedule
      const existingItem = await prisma.studyScheduleItem.findFirst({
        where: {
          scheduleId: activeSchedule.id,
          studyBlockId: block.id,
          actionType: "THEORY"
        }
      });

      if (existingItem) {
        if (existingItem.status !== "COMPLETED") {
          await prisma.studyScheduleItem.update({
            where: { id: existingItem.id },
            data: {
              status: "COMPLETED",
              completedAt: completionDate
            }
          });
          const msg = `Item de teoria atualizado para COMPLETED: ${block.title}`;
          console.log(`[DEBUG-SYNC] - ${msg}`);
          details.push(msg);
          updatedCount++;
        } else {
          console.log(`[DEBUG-SYNC] - Bloco já está concluído no cronograma: ${block.title}`);
        }
      } else {
        // Create a completed THEORY item in the active schedule
        await prisma.studyScheduleItem.create({
          data: {
            userId,
            scheduleId: activeSchedule.id,
            subjectId: block.subjectId,
            materialId: block.materialId,
            studyBlockId: block.id,
            actionType: "THEORY",
            priorityScore: 90,
            reason: "Colocação manual / Sincronização retroativa",
            dayNumber: 1,
            scheduledDate: completionDate,
            completedAt: completionDate,
            status: "COMPLETED"
          }
        });
        const msg = `Item de teoria criado e concluído no cronograma: ${block.title}`;
        console.log(`[DEBUG-SYNC] - ${msg}`);
        details.push(msg);
        createdCount++;
      }
    }

    return NextResponse.json({
      message: "Sincronização realizada com sucesso.",
      createdCount,
      updatedCount,
      details
    });
  } catch (error: any) {
    console.error("[DEBUG-SYNC ERROR]", error);
    return NextResponse.json({
      error: "Erro ao executar sincronização manual.",
      details: error.message
    }, { status: 500 });
  }
}
