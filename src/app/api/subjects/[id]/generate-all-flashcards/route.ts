/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateFlashcards } from "@/lib/ai/flashcards";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: subjectId } = await params;
  const mockUserId = "cm39k012x0001k93jqwerty12";

  try {
    // 1. Fetch all blocks for this subject that don't have many flashcards yet
    // Or just all blocks. Let's get all blocks first.
    const blocks = await (prisma as any).studyBlock.findMany({
      where: { subjectId },
      include: {
        _count: {
          select: { flashcards: true }
        }
      }
    });

    if (blocks.length === 0) {
      return NextResponse.json({ error: "Não há blocos de estudo nesta matéria para gerar flashcards." }, { status: 400 });
    }

    let totalSaved = 0;
    const results = [];

    // Process blocks in sequence to avoid hitting API rate limits too hard
    for (const block of blocks) {
      // Fetch text
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

      const fullText = extractedContent.map(c => c.text).join("\n\n");
      
      if (!fullText || fullText.trim().length < 50) continue;

      try {
        const generatedCards = await generateFlashcards(fullText);
        if (generatedCards && generatedCards.length > 0) {
          const saved = await prisma.$transaction(
            generatedCards.map((card: any) => 
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
          totalSaved += saved.length;
          results.push({ blockId: block.id, count: saved.length });
        }
      } catch (err) {
        console.error(`Error generating cards for block ${block.id}:`, err);
        // Continue to next block instead of failing entirely
      }
    }

    if (totalSaved === 0) {
      return NextResponse.json({ 
        message: "Nenhum novo flashcard foi gerado. Talvez os blocos já possuam cards suficientes ou texto insuficiente.",
        count: 0
      });
    }

    return NextResponse.json({
      message: `${totalSaved} flashcards gerados com sucesso para todos os blocos!`,
      count: totalSaved,
      results
    });

  } catch (error: any) {
    console.error("Batch flashcard generation error:", error);
    return NextResponse.json({ error: "Erro ao gerar flashcards em massa.", details: error.message }, { status: 500 });
  }
}
