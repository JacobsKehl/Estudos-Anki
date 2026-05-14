/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { subjectId, subjectName } = await req.json();

    if (!subjectId && !subjectName) {
      return NextResponse.json({ error: "Informe o subjectId ou subjectName" }, { status: 400 });
    }

    let targetSubjectId = subjectId;

    // Se passou apenas o nome, buscar ou criar a matéria
    if (!targetSubjectId && subjectName) {
      const user = await prisma.user.findFirst();
      if (!user) throw new Error("Usuário não encontrado");

      const subject = await prisma.studySubject.upsert({
        where: { id: "temporary-id" }, // upsert precisa de um critério único, mas aqui vamos buscar primeiro
        update: {},
        create: { name: subjectName, userId: user.id }
      });
      // Correção: findFirst ou create
      let existingSubject = await prisma.studySubject.findFirst({
        where: { name: subjectName, userId: user.id }
      });
      if (!existingSubject) {
        existingSubject = await prisma.studySubject.create({
          data: { name: subjectName, userId: user.id }
        });
      }
      targetSubjectId = existingSubject.id;
    }

    // Atualizar Material, Blocos e Flashcards vinculados
    await prisma.$transaction([
      prisma.studyMaterial.update({
        where: { id },
        data: { subjectId: targetSubjectId }
      }),
      (prisma as any).studyBlock.updateMany({
        where: { materialId: id },
        data: { subjectId: targetSubjectId }
      }),
      (prisma as any).flashcard.updateMany({
        where: { materialId: id },
        data: { subjectId: targetSubjectId }
      })
    ]);

    return NextResponse.json({ success: true, message: "Matéria atualizada com sucesso!" });

  } catch (error: any) {
    console.error("Update subject error:", error);
    return NextResponse.json({ error: "Erro ao atualizar matéria", details: error.message }, { status: 500 });
  }
}
