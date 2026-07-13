import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import {
  generatePreviewToken,
} from "@/lib/security/hybrid-preview-token";
import {
  validateHybridInput,
  DEFAULT_BATCH_CONFIG,
  type HybridBlockOutput,
  type HybridInputMaterial,
} from "@/lib/ai/hybrid-engine";
import { getHybridProvider } from "@/lib/ai/providers/hybrid-registry";

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

  // ── Injeção de dependência do motor de IA ────────────────────────────────
  const provider = getHybridProvider();
  if (!provider) {
    return NextResponse.json(
      {
        error: "O motor híbrido ainda não está configurado.",
        code: "HYBRID_ENGINE_NOT_CONFIGURED",
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

    const {
      subjectId,
      generationRunId,
      cfcMaterialId,
      estrategiaMaterialIds,
      targetTheme,
      goal,
      availableMinutes,
    } = body as {
      subjectId?: string;
      generationRunId?: string;
      cfcMaterialId?: string;
      estrategiaMaterialIds?: string[];
      targetTheme?: string;
      goal?: string;
      availableMinutes?: number;
    };

    // ── Validação básica de campos ───────────────────────────────────────────
    if (!subjectId || !generationRunId || !cfcMaterialId || !estrategiaMaterialIds?.length || !targetTheme) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes: subjectId, generationRunId, cfcMaterialId, estrategiaMaterialIds, targetTheme." },
        { status: 400 }
      );
    }

    // ── Validar ownership do subject ────────────────────────────────────────
    const subject = await prisma.studySubject.findFirst({
      where: { id: subjectId, userId },
    });
    if (!subject) {
      return NextResponse.json({ error: "Matéria não encontrada ou acesso não autorizado." }, { status: 403 });
    }

    // ── Validar ownership + provider dos materiais ──────────────────────────
    const cfcMaterial = await prisma.studyMaterial.findFirst({
      where: { id: cfcMaterialId, userId },
    });
    if (!cfcMaterial) {
      return NextResponse.json({ error: "Material CFC não encontrado ou acesso não autorizado." }, { status: 403 });
    }
    if (cfcMaterial.provider !== "CFC") {
      return NextResponse.json(
        {
          error: `O material selecionado como CFC não está classificado como 'CFC'. Provider atual: '${cfcMaterial.provider}'. Classifique o material antes de continuar.`,
          code: "INVALID_CFC_PROVIDER",
        },
        { status: 422 }
      );
    }
    if (!cfcMaterial.totalPages || cfcMaterial.totalPages <= 0) {
      return NextResponse.json(
        { error: "Material CFC não possui totalPages definido. Processe o material primeiro.", code: "MATERIAL_NOT_PROCESSED" },
        { status: 422 }
      );
    }

    const estrategiaMaterials = await prisma.studyMaterial.findMany({
      where: { id: { in: estrategiaMaterialIds }, userId },
    });
    if (estrategiaMaterials.length !== estrategiaMaterialIds.length) {
      return NextResponse.json(
        { error: "Um ou mais materiais do Estratégia não foram encontrados ou não pertencem ao usuário." },
        { status: 403 }
      );
    }
    for (const m of estrategiaMaterials) {
      if (m.provider !== "ESTRATEGIA") {
        return NextResponse.json(
          {
            error: `O material '${m.fileName}' não está classificado como 'ESTRATEGIA'. Provider atual: '${m.provider}'.`,
            code: "INVALID_ESTRATEGIA_PROVIDER",
          },
          { status: 422 }
        );
      }
      if (!m.totalPages || m.totalPages <= 0) {
        return NextResponse.json(
          { error: `Material '${m.fileName}' não possui totalPages definido. Processe o material primeiro.`, code: "MATERIAL_NOT_PROCESSED" },
          { status: 422 }
        );
      }
    }

    // ── Buscar textos extraídos do banco de dados ────────────────────────────
    const cfcPagesDb = await prisma.extractedContent.findMany({
      where: { materialId: cfcMaterialId, userId },
      orderBy: { pageNumber: "asc" },
      select: { pageNumber: true, text: true },
    });

    if (cfcPagesDb.length === 0) {
      return NextResponse.json(
        { error: "Texto extraído do material CFC não encontrado no banco de dados. Processe o material primeiro.", code: "MATERIAL_NOT_PROCESSED" },
        { status: 422 }
      );
    }

    const estPagesDb = await prisma.extractedContent.findMany({
      where: { materialId: { in: estrategiaMaterialIds }, userId },
      orderBy: { pageNumber: "asc" },
      select: { materialId: true, pageNumber: true, text: true },
    });

    if (estPagesDb.length === 0) {
      return NextResponse.json(
        { error: "Texto extraído dos materiais do Estratégia não encontrado no banco de dados. Processe os materiais primeiro.", code: "MATERIAL_NOT_PROCESSED" },
        { status: 422 }
      );
    }

    // ── Montar inputs tipados para a engine ──────────────────────────────────
    const cfcMaterialInput: HybridInputMaterial = {
      id: cfcMaterial.id,
      fileName: cfcMaterial.fileName,
      provider: "CFC",
      totalPages: cfcMaterial.totalPages,
      textByPage: cfcPagesDb.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
    };

    const estrategiaMaterialsInput: HybridInputMaterial[] = estrategiaMaterials.map((m) => {
      const pagesForM = estPagesDb.filter((p) => p.materialId === m.id);
      return {
        id: m.id,
        fileName: m.fileName,
        provider: "ESTRATEGIA",
        totalPages: m.totalPages!,
        textByPage: pagesForM.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
      };
    });

    const engineInput = {
      generationRunId,
      subject: subject.name,
      targetTheme,
      cfcMaterial: cfcMaterialInput,
      estrategiaMaterials: estrategiaMaterialsInput,
      examProfile: "FCC" as const,
      goal: goal || "",
      availableMinutes: availableMinutes || 60,
      aiConfig: {
        provider: "gemini",
        model: "gemini-2.5-flash",
        promptVersion: "v1.0.0",
      },
    };

    const inputErrors = validateHybridInput(engineInput);
    if (inputErrors.length > 0) {
      return NextResponse.json(
        { error: `Entrada híbrida inválida: ${inputErrors.map((e) => e.message).join("; ")}`, code: "INVALID_HYBRID_INPUT" },
        { status: 400 }
      );
    }

    // ── Rodar pipeline com o provider injetado ──────────────────────────────
    // Etapa A: Mapeamento de páginas do Estratégia
    const estMappedPages: { pageNumber: number; topics: string[]; summary: string }[] = [];
    for (const estMat of estrategiaMaterialsInput) {
      const mapped = await provider.mapPages({
        materialId: estMat.id,
        pages: estMat.textByPage,
        batchConfig: DEFAULT_BATCH_CONFIG,
      });
      estMappedPages.push(...mapped);
    }

    // Etapa A (CFC): Obter tópicos do CFC
    const cfcMapped = await provider.mapPages({
      materialId: cfcMaterialInput.id,
      pages: cfcMaterialInput.textByPage,
      batchConfig: DEFAULT_BATCH_CONFIG,
    });
    const cfcAnchorPoints = cfcMapped.flatMap((m) => m.topics);

    // Etapa B: Candidate Retrieval
    const candidatePages = await provider.retrieveCandidates({
      cfcAnchorPoints,
      estrategiaMappedPages: estMappedPages,
      targetTheme,
      examProfile: "FCC",
    });

    if (candidatePages.length === 0) {
      return NextResponse.json(
        {
          error: "A análise 80/20 não identificou nenhuma página candidata de aprofundamento no material do Estratégia para o tema selecionado.",
          code: "NO_CANDIDATE_PAGES_FOUND",
        },
        { status: 422 }
      );
    }

    // Etapa C: Deep Analysis
    const filteredEstPages = estPagesDb
      .filter((p) => candidatePages.includes(p.pageNumber))
      .map((p) => ({ materialId: p.materialId, pageNumber: p.pageNumber, text: p.text }));

    const analysisResult = await provider.deepAnalysis({
      cfcPages: cfcMaterialInput.textByPage,
      estrategiaPages: filteredEstPages,
      targetTheme,
      examProfile: "FCC",
      goal: goal || "",
      batchConfig: DEFAULT_BATCH_CONFIG,
    });

    // ── Montar o preview de saída real ───────────────────────────────────────
    const now = new Date().toISOString();
    const preview: HybridBlockOutput = {
      generationRunId,
      subject: subject.name,
      title: `${targetTheme} (80/20)`,
      methodology: "HYBRID_8020" as const,
      confidence: analysisResult.confidence,
      warnings: [],
      blockingWarnings: [],
      sources: analysisResult.sources,
      fccFocusPoints: analysisResult.fccFocusPoints,
      flashcardSeeds: analysisResult.flashcardSeeds,
      aiAuditMetadata: {
        provider: "gemini",
        modelUsed: "gemini-2.5-flash",
        promptVersion: "v1.0.0",
        generatedAt: now,
        generationRunId,
        confidence: analysisResult.confidence,
        warnings: [],
        blockingWarnings: [],
        batchConfig: DEFAULT_BATCH_CONFIG,
        analyzedScope: {
          cfcMaterialId,
          cfcPageRanges: [{ pageStart: 1, pageEnd: cfcMaterial.totalPages! }],
          deepeningMaterials: estrategiaMaterials.map((m) => ({
            materialId: m.id,
            pageRanges: [{ pageStart: 1, pageEnd: m.totalPages! }],
          })),
        },
        sourceFingerprintCfc: `cfc-hash-${cfcMaterialId}`,
        sourceFingerprintsDeepening: estrategiaMaterials
          .map((m) => ({ materialId: m.id, fingerprint: `strat-hash-${m.id}` }))
          .sort((a, b) => a.materialId.localeCompare(b.materialId)),
        justification: analysisResult.justification,
      },
    };

    // ── Gerar previewToken assinado ──────────────────────────────────────────
    const previewToken = generatePreviewToken({
      userId,
      subjectId,
      generationRunId,
      preview,
    });

    return NextResponse.json({ preview, previewToken });
  } catch (error: unknown) {
    console.error("[POST /api/hybrid-blocks/preview] error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: `Erro ao gerar preview: ${message}` }, { status: 500 });
  }
}
