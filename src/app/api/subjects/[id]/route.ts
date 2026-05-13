/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const subject = await prisma.studySubject.findUnique({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      include: {
        materials: {
          orderBy: { createdAt: "desc" }
        },
        studyBlocks: {
          orderBy: { orderIndex: "asc" }
        },
      } as any
    });

    if (!subject) {
      return NextResponse.json({ error: "Matéria não encontrada" }, { status: 404 });
    }

    return NextResponse.json(subject);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Erro ao buscar detalhes da matéria", details: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { name, description, priority, progress } = body;

    const updated = await prisma.studySubject.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(priority !== undefined && { priority }),
        ...(progress !== undefined && { progress }),
      }
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Erro ao atualizar matéria", details: err.message },
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
    // Need to clean up relations before deleting subject
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).studyBlock.deleteMany({ where: { subjectId: id } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.extractedContent.deleteMany({ where: { subjectId: id } } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.studyMaterial.deleteMany({ where: { subjectId: id } } as any);

    await prisma.studySubject.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Erro ao remover matéria", details: err.message },
      { status: 500 }
    );
  }
}
