/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { generateFlashcards } from "@/lib/ai/flashcards";
import type { FlashcardDifficulty } from "@/lib/ai/prompts/flashcard-generation";

// Text normalisation helper
function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "") // remove pontuação
    .replace(/\s+/g, " ") // normaliza espaços múltiplos
    .trim();
}

// Sorensen-Dice coefficient similarity helper
function getSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeText(s1);
  const norm2 = normalizeText(s2);

  if (norm1 === norm2) return 1.0;
  if (norm1.length < 2 || norm2.length < 2) return 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigrams1 = getBigrams(norm1);
  const bigrams2 = getBigrams(norm2);

  let intersection = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) {
      intersection++;
    }
  }

  return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
}

// Check if two flashcards are duplicate
function isDuplicate(q1: string, a1: string, q2: string, a2: string): boolean {
  const normQ1 = normalizeText(q1);
  const normQ2 = normalizeText(q2);
  const normA1 = normalizeText(a1);
  const normA2 = normalizeText(a2);

  // 1. Exato match após normalização
  if (normQ1 === normQ2 && normA1 === normA2) return true;

  // 2. Similaridade de pergunta ou resposta muito alta
  const qSim = getSimilarity(q1, q2);
  const aSim = getSimilarity(a1, a2);

  // Se a pergunta for >= 85% similar, ou pergunta E resposta forem >= 75% similares
  if (qSim >= 0.85 || (qSim >= 0.75 && aSim >= 0.75)) {
    return true;
  }

  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Autenticação segura do usuário
  const userId = await getMockUserId();
  if (!userId) {
    return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  }

  try {
    // 1. Obter o bloco de estudos e validar ownership + prioridades
    const block = await prisma.studyBlock.findFirst({
      where: { id, userId },
      include: {
        material: true,
        subject: true
      }
    });

    if (!block) {
      return NextResponse.json({ error: "Bloco de estudo não encontrado ou pertence a outro usuário." }, { status: 404 });
    }

    // 2. Validar matéria excluída
    if (block.subject?.studyPriority === "EXCLUDED") {
      return NextResponse.json({ 
        error: "Não é possível gerar flashcards para matérias excluídas (EXCLUDED)." 
      }, { status: 400 });
    }

    // 3. Validar material de apoio indevido
    if (block.material?.materialRole === "SUPPORT_MATERIAL") {
      return NextResponse.json({ 
        error: "Não é possível gerar flashcards adicionais para materiais de apoio (SUPPORT_MATERIAL)." 
      }, { status: 400 });
    }

    // 4. Buscar flashcards existentes desse bloco para exclusão e deduplicação
    const existingCards = await prisma.flashcard.findMany({
      where: { studyBlockId: id }
    });

    // Validar se já atingiu o limite máximo de 18 cards por bloco
    if (existingCards.length >= 18) {
      return NextResponse.json({ 
        error: "Este bloco já atingiu o limite máximo de 18 flashcards. Geração bloqueada." 
      }, { status: 400 });
    }

    // 5. Obter páginas e conteúdo do bloco
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
    if (!fullText || fullText.trim().length < 50) {
      return NextResponse.json({ 
        error: "Este bloco não possui texto extraído suficiente (mínimo 50 caracteres) para gerar flashcards adicionais." 
      }, { status: 400 });
    }

    // 6. Ler preferências de dificuldade e objetivo de prova do usuário
    let difficulty: FlashcardDifficulty = "NORMAL_PLUS";
    let examGoal: string | null = null;
    let focusArea: string | null = null;
    try {
      const userPrefs = await prisma.userPreferences.findUnique({
        where: { userId },
        select: { 
          flashcardDifficulty: true,
          examGoal: true,
          focusArea: true
        }
      });
      const dbDifficulty = userPrefs?.flashcardDifficulty;
      if (dbDifficulty === "EASY" || dbDifficulty === "NORMAL_PLUS" || dbDifficulty === "HARD") {
        difficulty = dbDifficulty;
      }
      examGoal = userPrefs?.examGoal || null;
      focusArea = userPrefs?.focusArea || null;
    } catch {
      // Ignora erro e usa os defaults
    }

    // Obter lista de perguntas já existentes para exclusão no prompt
    const existingQuestionsList = existingCards.map(c => c.question);

    // 7. Chamar o serviço de IA fornecendo a lista de perguntas existentes
    const generatedCards = await generateFlashcards({
      text: fullText,
      difficulty,
      subjectName: block.subject?.name,
      blockTitle: block.title,
      materialTitle: block.material?.fileName || "Material",
      examGoal,
      focusArea,
      existingQuestions: existingQuestionsList
    });

    if (!generatedCards || generatedCards.length === 0) {
      return NextResponse.json({
        message: "Não encontramos novos cards relevantes sem repetir os já existentes.",
        count: 0,
        flashcards: []
      });
    }

    // 8. Aplicar filtro de deduplicação no backend comparando com existentes e candidatos entre si
    const validNewCards: typeof generatedCards = [];
    const maxNewAllowed = Math.min(5, 18 - existingCards.length);

    for (const card of generatedCards) {
      if (validNewCards.length >= maxNewAllowed) break;

      // Comparar contra cartões existentes
      const isDuplicatedWithExisting = existingCards.some(ec => 
        isDuplicate(card.question, card.answer, ec.question, ec.answer)
      );

      if (isDuplicatedWithExisting) continue;

      // Comparar contra cartões já aceitos nesta mesma leva
      const isDuplicatedWithNew = validNewCards.some(nc => 
        isDuplicate(card.question, card.answer, nc.question, nc.answer)
      );

      if (isDuplicatedWithNew) continue;

      validNewCards.push(card);
    }

    if (validNewCards.length === 0) {
      return NextResponse.json({
        message: "Não encontramos novos cards relevantes sem repetir os já existentes.",
        count: 0,
        flashcards: []
      });
    }

    // 9. Salvar no banco de dados como cards novos (NEW)
    const savedCards = await prisma.$transaction(
      validNewCards.map(card => 
        (prisma as any).flashcard.create({
          data: {
            userId,
            subjectId: block.subjectId,
            materialId: block.materialId,
            studyBlockId: block.id,
            question: card.question,
            answer: card.answer,
            type: card.type || "QUESTION_ANSWER",
            difficulty: card.difficulty || "MEDIUM",
            status: "APPROVED",
            reviewState: "NEW",       
            nextReviewAt: new Date(),      
            approvedAt: new Date(),
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
      message: `${savedCards.length} flashcards adicionais criados com sucesso.`,
      count: savedCards.length,
      flashcards: savedCards
    });

  } catch (error: unknown) {
    console.error("[GENERATE_MORE] Erro:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: "Erro interno no servidor ao gerar cards adicionais.", details: err.message },
      { status: 500 }
    );
  }
}
