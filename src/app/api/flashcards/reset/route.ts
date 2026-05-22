import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Payload inválido. Envie um JSON." },
        { status: 400 }
      );
    }

    const { confirm } = body || {};

    if (confirm !== "DELETE_ALL_FLASHCARDS") {
      return NextResponse.json(
        { error: "Confirmação inválida. Envie o valor exato 'DELETE_ALL_FLASHCARDS'." },
        { status: 400 }
      );
    }

    // Deletar em ordem segura com transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Deletar revisões do usuário
      const reviews = await tx.flashcardReview.deleteMany({
        where: { userId }
      });

      // 2. Deletar flashcards do usuário
      const cards = await tx.flashcard.deleteMany({
        where: { userId }
      });

      return {
        deletedReviews: reviews.count,
        deletedCards: cards.count
      };
    });

    return NextResponse.json({
      message: "Todos os flashcards e revisões foram apagados com sucesso.",
      ...result
    });

  } catch (error: unknown) {
    console.error("Erro ao resetar flashcards:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: "Erro interno ao resetar flashcards.", details: err.message },
      { status: 500 }
    );
  }
}
