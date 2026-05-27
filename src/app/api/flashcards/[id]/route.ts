/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const userId = await getMockUserId();

    // Validar propriedade do flashcard (ownership)
    const flashcard = await prisma.flashcard.findFirst({
      where: { id, userId }
    });

    if (!flashcard) {
      return NextResponse.json({ error: "Flashcard não encontrado ou acesso não autorizado." }, { status: 404 });
    }

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
    console.error("Flashcard patch error:", err);
    return NextResponse.json(
      { error: "Erro ao atualizar flashcard" },
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
    const userId = await getMockUserId();

    // Validar propriedade do flashcard (ownership)
    const flashcard = await prisma.flashcard.findFirst({
      where: { id, userId }
    });

    if (!flashcard) {
      return NextResponse.json({ error: "Flashcard não encontrado ou acesso não autorizado." }, { status: 404 });
    }

    await (prisma as any).flashcard.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Flashcard delete error:", err);
    return NextResponse.json(
      { error: "Erro ao excluir flashcard" },
      { status: 500 }
    );
  }
}
