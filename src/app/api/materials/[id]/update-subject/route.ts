/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const userId = await getMockUserId();

    // Validar propriedade do material
    const material = await prisma.studyMaterial.findFirst({
      where: { id, userId }
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado ou acesso não autorizado." }, { status: 404 });
    }

    const { subjectId, subjectName } = await req.json();

    if (!subjectId && !subjectName) {
      return NextResponse.json({ error: "Informe o subjectId ou subjectName" }, { status: 400 });
    }

    let targetSubjectId = subjectId;

    // Se passou apenas o nome, buscar ou criar a matéria vinculada ao usuário
    if (!targetSubjectId && subjectName) {
      let existingSubject = await prisma.studySubject.findFirst({
        where: { name: subjectName, userId }
      });
      
      if (!existingSubject) {
        existingSubject = await prisma.studySubject.create({
          data: { name: subjectName, userId }
        });
      }
      
      targetSubjectId = existingSubject.id;
    }

    // Atualizar Material, Blocos e Flashcards vinculados (apenas se pertencem ao material do usuário)
    await prisma.$transaction([
      prisma.studyMaterial.update({
        where: { id },
        data: { subjectId: targetSubjectId }
      }),
      (prisma as any).studyBlock.updateMany({
        where: { materialId: id, userId },
        data: { subjectId: targetSubjectId }
      }),
      (prisma as any).flashcard.updateMany({
        where: { materialId: id, userId },
        data: { subjectId: targetSubjectId }
      })
    ]);

    return NextResponse.json({ success: true, message: "Matéria atualizada com sucesso!" });

  } catch (error: any) {
    console.error("Update subject error:", error);
    return NextResponse.json({ error: "Erro ao atualizar matéria", details: error.message }, { status: 500 });
  }
}
