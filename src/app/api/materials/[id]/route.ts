import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { getMockUserId } from "@/lib/auth-mock";

// Valores válidos para o campo provider (StudyMaterialProvider enum)
const VALID_PROVIDERS = ["CFC", "ESTRATEGIA", "OTHER"] as const;
type ValidProvider = (typeof VALID_PROVIDERS)[number];

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

/**
 * PATCH /api/materials/[id]
 *
 * Permite atualizar o campo `provider` de um material.
 *
 * Regras:
 *   - Somente o proprietário pode alterar.
 *   - Apenas `provider` é aceito no body (outros campos ignorados).
 *   - `materialRole` nunca é alterado por este endpoint.
 *   - Se o material já estiver vinculado a um StudyBlockSource, retorna 409
 *     (o provider não pode mudar enquanto um bloco híbrido existir).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const userId = await getMockUserId();

    // 1. Autenticar e confirmar ownership
    const material = await prisma.studyMaterial.findFirst({
      where: { id, userId },
    });

    if (!material) {
      return NextResponse.json(
        { error: "Material não encontrado ou acesso não autorizado." },
        { status: 404 }
      );
    }

    // 2. Validar payload
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
    }

    if (typeof body !== "object" || body === null || !("provider" in body)) {
      return NextResponse.json(
        { error: "Campo 'provider' é obrigatório no body." },
        { status: 400 }
      );
    }

    const { provider } = body as { provider: unknown };

    if (!VALID_PROVIDERS.includes(provider as ValidProvider)) {
      return NextResponse.json(
        {
          error: `Valor inválido para provider: '${String(provider)}'. Valores aceitos: ${VALID_PROVIDERS.join(", ")}`,
          code: "INVALID_PROVIDER_VALUE",
        },
        { status: 400 }
      );
    }

    // 3. Atualizar somente `provider` — materialRole nunca é alterado
    const updated = await prisma.studyMaterial.update({
      where: { id },
      data: { provider: provider as ValidProvider },
      select: {
        id: true,
        provider: true,
        materialRole: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("[PATCH /api/materials/[id]] error:", error);
    return NextResponse.json({ error: "Erro ao atualizar material." }, { status: 500 });
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

    // 2. Verificar vínculo com blocos de estudo ANTES de qualquer exclusão
    const linkedBlocksCount = await prisma.studyBlock.count({
      where: {
        materialId: id,
        userId,
      },
    });

    if (linkedBlocksCount > 0) {
      return NextResponse.json(
        {
          error: `Este material está vinculado a ${linkedBlocksCount} bloco(s) de estudo e não pode ser excluído. Exclua os blocos vinculados primeiro.`,
          code: "MATERIAL_USED_BY_BLOCK",
          linkedCount: linkedBlocksCount,
        },
        { status: 409 }
      );
    }

    // 3. Delete file from storage if it exists (Cloud only for Web)
    if (material.sourcePath && material.sourceType === "CLOUD_UPLOAD") {
      const { error: storageError } = await supabase.storage
        .from('materials')
        .remove([material.sourcePath]);
      
      if (storageError) {
        console.error("Erro ao deletar do storage:", storageError);
      }
    }

    // 4. Delete from DB with manual cascading restricting to user session
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

    // Capturar violação de FK do Restrict (caso a checagem acima seja contornada)
    // Código Prisma P2003 = violação de constraint de chave estrangeira
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2003"
    ) {
      return NextResponse.json(
        {
          error: "Este material possui vínculos no sistema e não pode ser excluído.",
          code: "MATERIAL_IN_USE",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Erro ao excluir material." },
      { status: 500 }
    );
  }
}
