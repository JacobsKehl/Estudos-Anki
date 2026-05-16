import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const material = await prisma.studyMaterial.findUnique({
      where: { id },
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado." }, { status: 404 });
    }

    return NextResponse.json(material);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Find the material to get the file path
    const material = await prisma.studyMaterial.findUnique({
      where: { id },
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado." }, { status: 404 });
    }

    // 2. Delete file from disk or storage if it exists
    if (material.sourcePath) {
      if (material.sourceType === "LOCAL_INBOX") {
        try {
          const fullPath = path.join(process.cwd(), material.sourcePath);
          await unlink(fullPath);
        } catch (err) {
          console.error("Failed to delete file from disk:", err);
        }
      } else if (material.sourceType === "CLOUD_UPLOAD") {
        const { error: storageError } = await supabase.storage
          .from('materials')
          .remove([material.sourcePath]);
        
        if (storageError) {
          console.error("Erro ao deletar do storage:", storageError);
        }
      }
    } else if (material.filePath) {
      // Legacy support for filePath
      try {
        const fullPath = path.join(process.cwd(), material.filePath);
        await unlink(fullPath);
      } catch (err) {
        console.error("Failed to delete legacy file from disk:", err);
      }
    }

    // 3. Delete from DB with manual cascading
    await prisma.$transaction([
      // Delete extracted content
      prisma.extractedContent.deleteMany({
        where: { materialId: id },
      }),
      // Delete study blocks
      prisma.studyBlock.deleteMany({
        where: { materialId: id },
      }),
      // Delete schedule items
      prisma.studyScheduleItem.deleteMany({
        where: { materialId: id },
      }),
      // Finally delete the material itself
      prisma.studyMaterial.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json({ message: "Material excluído com sucesso." });
  } catch (error: unknown) {
    console.error("Delete error:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: "Erro ao excluir material.", details: err.message },
      { status: 500 }
    );
  }
}
