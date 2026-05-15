import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      subjectId, 
      materialId, 
      title, 
      description, 
      pageStart, 
      pageEnd, 
      estimatedStudyMinutes 
    } = body;
    
    // For MVP, we use the mock user.
    const userId = await getMockUserId();

    if (!subjectId || !materialId || !title || typeof pageStart !== 'number' || typeof pageEnd !== 'number') {
      return NextResponse.json({ error: "Parece que faltam algumas informações. Preencha todos os campos para criar o bloco." }, { status: 400 });
    }

    if (pageStart > pageEnd) {
      return NextResponse.json({ error: "A página inicial deve vir antes da final. Dê uma conferidinha no intervalo!" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = await (prisma as any).studyBlock.create({
      data: {
        userId,
        subjectId: subjectId as string,
        materialId: materialId as string,
        title: title as string,
        description: description || null,
        pageStart,
        pageEnd,
        estimatedStudyMinutes: estimatedStudyMinutes || null,
        status: "NOT_STARTED",
      }
    });

    return NextResponse.json(block, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Tivemos um problema ao criar seu bloco de estudo. Por favor, tente novamente em instantes.", details: err.message },
      { status: 500 }
    );
  }
}
