import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Lista de IDs inválida." }, { status: 400 });
    }

    // 1. Buscar os materiais para pegar os caminhos dos arquivos do storage
    const materials = await prisma.studyMaterial.findMany({
      where: { id: { in: ids } },
      select: { id: true, sourcePath: true, sourceType: true }
    });

    if (materials.length === 0) {
      return NextResponse.json({ error: "Nenhum material encontrado." }, { status: 404 });
    }

    // 2. Coletar caminhos do storage e remover do Supabase
    const cloudPaths = materials
      .filter(m => m.sourcePath && m.sourceType === "CLOUD_UPLOAD")
      .map(m => m.sourcePath!);

    if (cloudPaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('materials')
        .remove(cloudPaths);
      
      if (storageError) {
        console.error("Erro ao deletar arquivos em lote do storage:", storageError);
      }
    }

    // 3. Deletar do Banco de Dados com transação atômica em cascata manual
    await prisma.$transaction([
      // Deletar flashcards vinculados aos materiais
      prisma.flashcard.deleteMany({
        where: { materialId: { in: ids } },
      }),
      // Deletar conteúdo extraído
      prisma.extractedContent.deleteMany({
        where: { materialId: { in: ids } },
      }),
      // Deletar blocos de estudo
      prisma.studyBlock.deleteMany({
        where: { materialId: { in: ids } },
      }),
      // Deletar itens do cronograma
      prisma.studyScheduleItem.deleteMany({
        where: { materialId: { in: ids } },
      }),
      // Finalmente deletar os materiais
      prisma.studyMaterial.deleteMany({
        where: { id: { in: ids } },
      }),
    ]);

    return NextResponse.json({ message: `${materials.length} materiais excluídos com sucesso.` });
  } catch (error: any) {
    console.error("Bulk delete error:", error);
    return NextResponse.json(
      { error: "Erro ao excluir materiais em lote.", details: error.message },
      { status: 500 }
    );
  }
}
