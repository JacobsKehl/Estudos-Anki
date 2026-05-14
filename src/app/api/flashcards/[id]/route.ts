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
    const { question, answer, status, difficulty, type } = body;

    const updateData: any = {
      ...(question && { question }),
      ...(answer && { answer }),
      ...(status && { status }),
      ...(difficulty && { difficulty }),
      ...(type && { type }),
    };

    // Initialize SRS fields when approving
    if (status === "APPROVED") {
      const now = new Date();
      updateData.approvedAt = now;
      updateData.reviewState = "NEW";
      updateData.nextReviewAt = now;
      updateData.learningStep = 0;
      updateData.easeFactor = 2.5;
      updateData.intervalDays = 0;
      updateData.repetitionCount = 0;
      updateData.lapseCount = 0;
    }

    const updated = await (prisma as any).flashcard.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Erro ao atualizar flashcard", details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await (prisma as any).flashcard.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Erro ao excluir flashcard", details: err.message },
      { status: 500 }
    );
  }
}
