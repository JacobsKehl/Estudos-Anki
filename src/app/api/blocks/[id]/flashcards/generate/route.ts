/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateFlashcards } from "@/lib/ai/flashcards";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mockUserId = "cm39k012x0001k93jqwerty12";

  try {
    // 1. Fetch the study block
    const block = await (prisma as any).studyBlock.findUnique({
      where: { id },
      include: {
        material: true,
        subject: true
      }
    });

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

    // 4. Generate flashcards with Gemini
    const generatedCards = await generateFlashcards(fullText);

    if (!generatedCards || generatedCards.length === 0) {
      return NextResponse.json({ 
        error: "A IA não conseguiu identificar conceitos importantes para transformar em flashcards neste trecho." 
      }, { status: 400 });
    }

    // 5. Save to database as PENDING_APPROVAL with full traceability
    const savedCards = await prisma.$transaction(
      generatedCards.map(card => 
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
            sourcePageStart: block.pageStart,
            sourcePageEnd: block.pageEnd
          }
        })
      )
    );

    return NextResponse.json({
      message: `${savedCards.length} flashcards gerados com sucesso. Revise-os na área de curadoria.`,
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
