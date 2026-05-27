import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    const { ids, mode } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Lista de IDs inválida." }, { status: 400 });
    }

    if (!mode) {
      return NextResponse.json({ error: "Modo de ação não especificado." }, { status: 400 });
    }

    const baseUrl = req.nextUrl.origin;
    const cookieHeader = req.headers.get("cookie") || "";
    
    let processedCount = 0;
    let blocksCreated = 0;
    let flashcardsCount = 0;
    let errorCount = 0;
    const failedMaterials: { id: string; title: string; error: string }[] = [];

    // Buscar apenas materiais que pertencem ao usuário autenticado (Anti-IDOR)
    const materials = await prisma.studyMaterial.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, fileName: true }
    });

    const authorizedIds = materials.map(m => m.id);

    for (const id of ids) {
      const material = materials.find(m => m.id === id);
      if (!material) {
        errorCount++;
        failedMaterials.push({
          id,
          title: "Material não autorizado",
          error: "Material não encontrado ou acesso não autorizado."
        });
        continue;
      }

      const title = material.fileName || "Material Desconhecido";

      try {
        // Encaminhar o cabeçalho 'Cookie' para que a rota interna saiba que o usuário está autenticado
        const res = await fetch(`${baseUrl}/api/materials/${id}/organize`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Cookie": cookieHeader
          },
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
            error: data.error || "Erro ao processar arquivo"
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

    // Estimar quantidade de matérias vinculadas (matérias distintas das IDs selecionadas no banco pertencentes ao usuário)
    const distinctSubjects = await prisma.studyMaterial.groupBy({
      by: ['subjectId'],
      where: { id: { in: authorizedIds }, userId, subjectId: { not: null } }
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
      { error: "Erro crítico ao executar ação em lote." },
      { status: 500 }
    );
  }
}
