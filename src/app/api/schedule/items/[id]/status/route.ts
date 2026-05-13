/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // 1. Update the schedule item
    const updatedItem = await (prisma as any).studyScheduleItem.update({
      where: { id },
      data: { 
        status,
        ...(status === "COMPLETED" ? { completedAt: new Date() } : {})
      },
      include: {
        studyBlock: true
      }
    });

    // 2. Sync status to the original StudyBlock
    if (updatedItem.studyBlockId) {
      await (prisma as any).studyBlock.update({
        where: { id: updatedItem.studyBlockId },
        data: { status }
      });
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
