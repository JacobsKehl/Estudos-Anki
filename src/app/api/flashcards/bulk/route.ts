/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const { ids, status } = await req.json();

    if (!Array.isArray(ids) || !status) {
      return NextResponse.json({ error: "IDs e status são obrigatórios" }, { status: 400 });
    }

    const updateData: any = { status };
    
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

    const updated = await (prisma as any).flashcard.updateMany({
      where: {
        id: { in: ids }
      },
      data: updateData
    });

    return NextResponse.json({ 
      message: `${updated.count} flashcards atualizados.`,
      count: updated.count 
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json({ error: "Erro ao processar atualização em massa." }, { status: 500 });
  }
}
