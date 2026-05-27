import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { getMockUserId } from "@/lib/auth-mock";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const userId = await getMockUserId();

    // Validar propriedade do material (ownership)
    const material = await prisma.studyMaterial.findFirst({
      where: { id, userId },
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado ou acesso não autorizado." }, { status: 404 });
    }

    return NextResponse.json(material);
  } catch (error: any) {
    console.error("[GET /api/materials/[id]] error:", error);
    return NextResponse.json({ error: "Erro ao buscar material." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const userId = await getMockUserId();

    // 1. Validar propriedade do material (ownership)
    const material = await prisma.studyMaterial.findFirst({
      where: { id, userId },
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado ou acesso não autorizado." }, { status: 404 });
    }

    // 2. Delete file from storage if it exists (Cloud only for Web)
    if (material.sourcePath && material.sourceType === "CLOUD_UPLOAD") {
      const { error: storageError } = await supabase.storage
        .from('materials')
        .remove([material.sourcePath]);
      
      if (storageError) {
        console.error("Erro ao deletar do storage:", storageError);
      }
    }

    // 3. Delete from DB with manual cascading restricting to user session
    await prisma.$transaction([
      // Delete extracted content
      prisma.extractedContent.deleteMany({
        where: { materialId: id, userId },
      }),
      // Delete study blocks
      prisma.studyBlock.deleteMany({
        where: { materialId: id, userId },
      }),
      // Delete schedule items
      prisma.studyScheduleItem.deleteMany({
        where: { materialId: id, userId },
      }),
      // Finalmente deletar o material (validado)
      prisma.studyMaterial.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json({ message: "Material excluído com sucesso." });
  } catch (error: unknown) {
    console.error("[DELETE /api/materials/[id]] error:", error);
    return NextResponse.json(
      { error: "Erro ao excluir material." },
      { status: 500 }
    );
  }
}
