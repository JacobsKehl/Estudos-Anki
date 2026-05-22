/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { generateFlashcards } from "@/lib/ai/flashcards";
import type { FlashcardDifficulty } from "@/lib/ai/prompts/flashcard-generation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mockUserId = await getMockUserId();

  try {
    // 1. Fetch the study block
    const block = await (prisma as any).studyBlock.findUnique({
      where: { id },
      include: {
        material: true,
        subject: true
      }
    });

    // Bloquear geração múltipla: verificar se já existem flashcards vinculados a este bloco
    const existingCardsCount = await prisma.flashcard.count({
      where: { studyBlockId: id }
    });

    if (existingCardsCount > 0) {
      return NextResponse.json({ 
        error: "Você já gerou flashcards para este bloco. Não é possível gerar novamente para evitar duplicidade." 
      }, { status: 400 });
    }

    if (!block) {
      return NextResponse.json({ error: "Ops! Não encontramos esse bloco de estudo." }, { status: 404 });
    }

    // 2. Fetch extracted content for this block's pages
    const extractedContent = await prisma.extractedContent.findMany({
      where: {
        materialId: block.materialId,
        pageNumber: {
          gte: block.pageStart,
          lte: block.pageEnd
        }
      },
      orderBy: { pageNumber: "asc" }
    });

    // 3. Concatenate text
    const fullText = extractedContent.map(c => c.text).join("\n\n");
    
    if (!fullText || fullText.trim().length < 50) {
      return NextResponse.json({ 
        error: "Este bloco não possui texto extraído suficiente (mínimo 50 caracteres) para gerar flashcards de qualidade." 
      }, { status: 400 });
    }

    // 4. Read user's preferred difficulty from DB (defaults to NORMAL_PLUS)
    let difficulty: FlashcardDifficulty = "NORMAL_PLUS";
    try {
      const user = await prisma.user.findUnique({
        where: { id: mockUserId },
        select: { flashcardDifficulty: true }
      });
      const dbDifficulty = user?.flashcardDifficulty;
      if (dbDifficulty === "EASY" || dbDifficulty === "NORMAL_PLUS" || dbDifficulty === "HARD") {
        difficulty = dbDifficulty;
      }
    } catch {
      // If reading fails, proceed with default
    }

    // 5. Generate flashcards with Gemini using user's preferred difficulty
    const generatedCards = await generateFlashcards(fullText, difficulty);

    if (!generatedCards || generatedCards.length === 0) {
      return NextResponse.json({
        message: "Nenhum conceito importante foi identificado para transformar em flashcards neste trecho.",
        count: 0,
        flashcards: []
      });
    }

    // 6. Save to database with full traceability
    const limitedCards = generatedCards.slice(0, 8);
    const savedCards = await prisma.$transaction(
      limitedCards.map(card => 
        (prisma as any).flashcard.create({
          data: {
            userId: mockUserId,
            subjectId: block.subjectId,
            materialId: block.materialId,
            studyBlockId: block.id,
            question: card.question,
            answer: card.answer,
            type: card.type,
            difficulty: card.difficulty,
            status: "PENDING_APPROVAL",
            reviewState: "NEW",       
            nextReviewAt: new Date(),      
            approvedAt: null,
            learningStep: 0,
            easeFactor: 2.5,
            intervalDays: 0,
            repetitionCount: 0,
            lapseCount: 0,
            sourcePageStart: block.pageStart,
            sourcePageEnd: block.pageEnd
          }
        })
      )
    );

    return NextResponse.json({
      message: `${savedCards.length} flashcards criados com sucesso. Prontos para revisão.`,
      count: savedCards.length,
      flashcards: savedCards
    });

  } catch (error: unknown) {
    console.error("Flashcard generation error:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: "Tivemos um problema ao criar seus flashcards. Por favor, tente novamente em instantes.", details: err.message },
      { status: 500 }
    );
  }
}
