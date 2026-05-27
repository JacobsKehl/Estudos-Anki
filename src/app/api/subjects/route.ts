/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export async function GET() {
  try {
    const userId = await getMockUserId();

    const subjects = await prisma.studySubject.findMany({
      where: { userId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      include: {
        _count: {
          select: {
            materials: true,
            studyBlocks: true,
          }
        }
      } as any,
      orderBy: { priority: "desc" }
    });

    return NextResponse.json(subjects);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[GET /api/subjects] error:", err);
    return NextResponse.json(
      { error: "Não foi possível processar a solicitação." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, priority, examWeight } = body;
    
    const userId = await getMockUserId();

    if (!name) {
      return NextResponse.json({ error: "O nome da matéria é obrigatório" }, { status: 400 });
    }

    const subject = await prisma.studySubject.create({
      data: {
        name,
        description,
        priority: priority || 1,
        examWeight: examWeight || 1.0,
        userId,
      }
    });

    return NextResponse.json(subject, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[POST /api/subjects] error:", err);
    return NextResponse.json(
      { error: "Não foi possível processar a solicitação." },
      { status: 500 }
    );
  }
}
