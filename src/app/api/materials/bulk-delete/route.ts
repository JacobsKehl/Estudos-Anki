import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { getMockUserId } from "@/lib/auth-mock";

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Lista de IDs inválida." }, { status: 400 });
    }

    // 1. Buscar apenas os materiais que pertencem ao usuário autenticado (Anti-IDOR)
    const materials = await prisma.studyMaterial.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, sourcePath: true, sourceType: true }
    });

    if (materials.length === 0) {
      return NextResponse.json({ error: "Nenhum material encontrado ou acesso não autorizado." }, { status: 404 });
    }

    const authorizedIds = materials.map(m => m.id);

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

    // 3. Deletar do Banco de Dados com transação atômica em cascata manual (restringindo a userId)
    await prisma.$transaction([
      // Deletar flashcards vinculados aos materiais autorizados do usuário
      prisma.flashcard.deleteMany({
        where: { materialId: { in: authorizedIds }, userId },
      }),
      // Deletar conteúdo extraído
      prisma.extractedContent.deleteMany({
        where: { materialId: { in: authorizedIds }, userId },
      }),
      // Deletar blocos de estudo
      prisma.studyBlock.deleteMany({
        where: { materialId: { in: authorizedIds }, userId },
      }),
      // Deletar itens do cronograma
      prisma.studyScheduleItem.deleteMany({
        where: { materialId: { in: authorizedIds }, userId },
      }),
      // Finalmente deletar os materiais autorizados
      prisma.studyMaterial.deleteMany({
        where: { id: { in: authorizedIds }, userId },
      }),
    ]);

    return NextResponse.json({ message: `${materials.length} materiais excluídos com sucesso.` });
  } catch (error: any) {
    console.error("Bulk delete error:", error);
    return NextResponse.json(
      { error: "Erro ao excluir materiais em lote." },
      { status: 500 }
    );
  }
}
