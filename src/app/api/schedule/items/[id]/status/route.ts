/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { completeStudyBlock, reopenStudyBlock } from "@/lib/study/completion";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "Status é obrigatório" }, { status: 400 });
    }

    // Find the item first to check actionType and studyBlockId
    const item = await (prisma as any).studyScheduleItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json({ error: "Item do cronograma não encontrado" }, { status: 404 });
    }

    let updatedItem;

    if (item.studyBlockId && item.actionType === "THEORY") {
      if (status === "COMPLETED") {
        await completeStudyBlock(item.userId, item.studyBlockId, item.id);
      } else {
        await reopenStudyBlock(item.userId, item.studyBlockId, status);
      }
      
      updatedItem = await (prisma as any).studyScheduleItem.findUnique({
        where: { id },
        include: { studyBlock: true }
      });
    } else {
      // 1. Update the schedule item
      updatedItem = await (prisma as any).studyScheduleItem.update({
        where: { id },
        data: { 
          status,
          ...(status === "COMPLETED" ? { completedAt: new Date() } : { completedAt: null })
        },
        include: {
          studyBlock: true
        }
      });

      // 2. Sync status to the original StudyBlock (only for completed items)
      if (updatedItem.studyBlockId) {
        if (status === "COMPLETED") {
          await (prisma as any).studyBlock.update({
            where: { id: updatedItem.studyBlockId },
            data: { status }
          });
        }
      }
    }

    return NextResponse.json(updatedItem);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Erro ao atualizar item do cronograma", details: err.message },
      { status: 500 }
    );
  }
}
