import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import {
  validatePreviewToken,
  verifyPreviewIntegrity,
} from "@/lib/security/hybrid-preview-token";
import { createHybridBlock } from "@/lib/services/hybrid-block";

export async function POST(req: NextRequest) {
  // ── Feature flag ─────────────────────────────────────────────────────────
  const featureFlag = process.env.ENABLE_HYBRID_8020;
  if (featureFlag !== "true") {
    return NextResponse.json(
      {
        error: "A metodologia híbrida 80/20 está temporariamente indisponível.",
        code: "HYBRID_FEATURE_DISABLED",
      },
      { status: 503 }
    );
  }

  try {
    const userId = await getMockUserId();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
    }

    const { preview, previewToken, subjectId, availableMinutes } = body as {
      preview?: unknown;
      previewToken?: string;
      subjectId?: string;
      availableMinutes?: number;
    };

    if (!previewToken || !preview || !subjectId) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes: preview, previewToken, subjectId." },
        { status: 400 }
      );
    }

    // ── 1. Validar assinatura e expiração do token ───────────────────────────
    const tokenResult = validatePreviewToken(previewToken);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: `Token de preview inválido: ${tokenResult.reason}`, code: "INVALID_PREVIEW_TOKEN" },
        { status: 401 }
      );
    }
    const { payload: tokenPayload } = tokenResult;

    // ── 2. Validar que o token pertence ao usuário autenticado ───────────────
    if (tokenPayload.userId !== userId) {
      return NextResponse.json(
        { error: "Token não pertence ao usuário autenticado.", code: "TOKEN_USER_MISMATCH" },
        { status: 403 }
      );
    }

    // ── 3. Validar subjectId no token e ownership ────────────────────────────
    if (tokenPayload.subjectId !== subjectId) {
      return NextResponse.json(
        { error: "subjectId não corresponde ao token.", code: "SUBJECT_MISMATCH" },
        { status: 422 }
      );
    }

    const subject = await prisma.studySubject.findFirst({
      where: { id: subjectId, userId },
    });
    if (!subject) {
      return NextResponse.json({ error: "Matéria não encontrada ou acesso não autorizado." }, { status: 403 });
    }

    // ── 4. Verificar integridade do preview (hash completo) ──────────────────
    if (!verifyPreviewIntegrity(tokenPayload, preview)) {
      return NextResponse.json(
        {
          error: "Integridade do preview comprometida: o conteúdo foi modificado após a geração.",
          code: "PREVIEW_HASH_MISMATCH",
        },
        { status: 422 }
      );
    }

    // ── 5. Extrair e revalidar materiais no banco (nunca confiar no cliente) ─
    const previewObj = preview as {
      generationRunId: string;
      blockingWarnings?: string[];
      sources?: { materialId: string; sourceRole: string }[];
    };

    if (previewObj.blockingWarnings && previewObj.blockingWarnings.length > 0) {
      return NextResponse.json(
        {
          error: "Confirmação rejeitada: o preview contém avisos bloqueantes.",
          code: "BLOCKING_WARNINGS_PRESENT",
          blockingWarnings: previewObj.blockingWarnings,
        },
        { status: 422 }
      );
    }

    // Revalidar ownership dos materiais no banco
    const materialIds = (previewObj.sources ?? []).map((s) => s.materialId);
    if (materialIds.length > 0) {
      const dbMaterials = await prisma.studyMaterial.findMany({
        where: { id: { in: materialIds }, userId },
        select: { id: true, provider: true, totalPages: true },
      });

      if (dbMaterials.length !== materialIds.length) {
        return NextResponse.json(
          { error: "Um ou mais materiais não foram encontrados ou não pertencem ao usuário.", code: "MATERIAL_OWNERSHIP_FAILED" },
          { status: 403 }
        );
      }

      // Validar providers dos materiais no banco
      for (const source of previewObj.sources ?? []) {
        const dbMat = dbMaterials.find((m) => m.id === source.materialId);
        if (!dbMat) continue;

        if (source.sourceRole === "ANCHOR_8020" && dbMat.provider !== "CFC") {
          return NextResponse.json(
            { error: `Material de ancoragem '${source.materialId}' não é provider CFC no banco. Atual: '${dbMat.provider}'.`, code: "PROVIDER_MISMATCH_ON_CONFIRM" },
            { status: 422 }
          );
        }

        if (source.sourceRole === "DEEPENING" && dbMat.provider !== "ESTRATEGIA") {
          return NextResponse.json(
            { error: `Material de aprofundamento '${source.materialId}' não é provider ESTRATEGIA no banco. Atual: '${dbMat.provider}'.`, code: "PROVIDER_MISMATCH_ON_CONFIRM" },
            { status: 422 }
          );
        }

        if (!dbMat.totalPages || dbMat.totalPages <= 0) {
          return NextResponse.json(
            { error: `Material '${source.materialId}' não possui totalPages no banco.`, code: "MATERIAL_NOT_PROCESSED" },
            { status: 422 }
          );
        }
      }
    }

    // ── 6. Persistir o bloco (com idempotência vinculada ao userId) ──────────
    // Usando prisma como PrismaLike — o cast é necessário por limitações de tipagem
    // com o cliente Prisma injetado. Em produção, usar o tipo gerado.
    const result = await createHybridBlock(
      prisma as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      {
        userId,
        subjectId,
        output: preview as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        availableMinutes: availableMinutes ?? 60,
      }
    );

    return NextResponse.json({
      studyBlockId: result.studyBlockId,
      estimatedStudyMinutes: result.estimatedStudyMinutes,
    });
  } catch (error: unknown) {
    console.error("[POST /api/hybrid-blocks/confirm] error:", error);

    // Violação de unique constraint do generationRunId em concorrência
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "Conflito: um bloco com este ID de geração já foi criado.",
          code: "GENERATION_RUN_CONFLICT",
        },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: `Erro ao confirmar bloco híbrido: ${message}` }, { status: 500 });
  }
}
