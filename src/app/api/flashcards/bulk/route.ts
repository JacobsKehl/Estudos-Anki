/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const { ids, status } = await req.json();

    if (!Array.isArray(ids) || !status) {
      return NextResponse.json({ error: "IDs e status são obrigatórios" }, { status: 400 });
    }

    const updated = await (prisma as any).flashcard.updateMany({
      where: {
        id: { in: ids }
      },
      data: { status }
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
