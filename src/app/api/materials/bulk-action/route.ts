import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { ids, mode } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Lista de IDs inválida." }, { status: 400 });
    }

    if (!mode) {
      return NextResponse.json({ error: "Modo de ação não especificado." }, { status: 400 });
    }

    const baseUrl = req.nextUrl.origin;
    
    let processedCount = 0;
    let blocksCreated = 0;
    let flashcardsCount = 0;
    let errorCount = 0;
    const failedMaterials: { id: string; title: string; error: string }[] = [];

    // Buscar os títulos de todos os materiais em lote para reportar nomes amigáveis em caso de erro
    const materials = await prisma.studyMaterial.findMany({
      where: { id: { in: ids } },
      select: { id: true, fileName: true }
    });

    for (const id of ids) {
      const material = materials.find(m => m.id === id);
      const title = material?.fileName || "Material Desconhecido";

      try {
        const res = await fetch(`${baseUrl}/api/materials/${id}/organize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          processedCount++;
          blocksCreated += data.blocksCount || 0;
          flashcardsCount += data.flashcardsCount || 0;
        } else {
          errorCount++;
          failedMaterials.push({
            id,
            title,
            error: data.error || "Erro desconhecido ao processar arquivo"
          });
        }
      } catch (err: any) {
        errorCount++;
        failedMaterials.push({
          id,
          title,
          error: err.message || "Erro de rede/timeout ao processar material"
        });
      }
    }

    // Estimar quantidade de matérias vinculadas (matérias distintas das IDs selecionadas no banco)
    const distinctSubjects = await prisma.studyMaterial.groupBy({
      by: ['subjectId'],
      where: { id: { in: ids }, subjectId: { not: null } }
    });

    return NextResponse.json({
      message: "Processamento em lote concluído.",
      processedCount,
      subjectsCreatedOrLinked: distinctSubjects.length,
      blocksCreated,
      flashcardsCount,
      errorCount,
      failedMaterials
    });

  } catch (error: any) {
    console.error("[BULK ACTION ERROR]", error);
    return NextResponse.json(
      { error: "Erro crítico ao executar ação em lote.", details: error.message },
      { status: 500 }
    );
  }
}
