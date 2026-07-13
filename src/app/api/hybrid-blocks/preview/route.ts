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
  type HybridMappedPage,
  type HybridCandidatePage,
} from "@/lib/ai/hybrid-engine";
import { getHybridProvider } from "@/lib/ai/providers/hybrid-registry";
import { canonicalHash } from "@/lib/security/canonical-json";

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

    const providerMetadata = provider.getMetadata();
    if (
      !providerMetadata ||
      typeof providerMetadata.provider !== "string" ||
      !providerMetadata.provider.trim() ||
      typeof providerMetadata.model !== "string" ||
      !providerMetadata.model.trim() ||
      typeof providerMetadata.promptVersion !== "string" ||
      !providerMetadata.promptVersion.trim()
    ) {
      return NextResponse.json(
        {
          error: "Metadados do provider de IA inválidos ou incompletos.",
          code: "INVALID_PROVIDER_METADATA",
        },
        { status: 503 }
      );
    }

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
        provider: providerMetadata.provider,
        model: providerMetadata.model,
        promptVersion: providerMetadata.promptVersion,
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
    const estMappedPages: HybridMappedPage[] = [];
    for (const estMat of estrategiaMaterialsInput) {
      const mapped = await provider.mapPages({
        materialId: estMat.id,
        pages: estMat.textByPage,
        batchConfig: DEFAULT_BATCH_CONFIG,
      });
      estMappedPages.push(
        ...mapped.map((p) => ({
          materialId: estMat.id,
          pageNumber: p.pageNumber,
          topics: p.topics,
          summary: p.summary,
        }))
      );
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

    // ── Validação rigorosa das referências candidatas ────────────────────────
    const validEstrategiaMaterialIds = estrategiaMaterials.map((m) => m.id);
    const seenCandidates = new Set<string>();
    const normalizedCandidates: HybridCandidatePage[] = [];

    if (!Array.isArray(candidatePages) || candidatePages.length === 0) {
      return NextResponse.json(
        {
          error: "A análise 80/20 não identificou nenhuma página candidata de aprofundamento no material do Estratégia para o tema selecionado.",
          code: "NO_CANDIDATE_PAGES_FOUND",
        },
        { status: 422 }
      );
    }

    for (const c of candidatePages) {
      // 1. Validar estrutura básica do candidato
      if (
        !c ||
        typeof c.materialId !== "string" ||
        typeof c.pageNumber !== "number" ||
        !Number.isInteger(c.pageNumber) ||
        c.pageNumber <= 0
      ) {
        return NextResponse.json(
          { error: "O provider retornou referências candidatas malformadas.", code: "INVALID_CANDIDATE_REFERENCES" },
          { status: 422 }
        );
      }

      // 2. Validar se o materialId pertence aos materiais Estratégia selecionados
      if (!validEstrategiaMaterialIds.includes(c.materialId)) {
        return NextResponse.json(
          { error: `O provider retornou um materialId desconhecido: '${c.materialId}'.`, code: "INVALID_CANDIDATE_REFERENCES" },
          { status: 422 }
        );
      }

      // 3. Validar se a combinação materialId + pageNumber existe no banco (estPagesDb)
      const existsInDb = estPagesDb.some(
        (p) => p.materialId === c.materialId && p.pageNumber === c.pageNumber
      );
      if (!existsInDb) {
        return NextResponse.json(
          { error: `A página candidata ${c.pageNumber} do material '${c.materialId}' não existe no banco de dados.`, code: "INVALID_CANDIDATE_REFERENCES" },
          { status: 422 }
        );
      }

      // 4. Normalizar duplicatas
      const key = `${c.materialId}:${c.pageNumber}`;
      if (!seenCandidates.has(key)) {
        seenCandidates.add(key);
        normalizedCandidates.push({
          materialId: c.materialId,
          pageNumber: c.pageNumber,
        });
      }
    }

    if (normalizedCandidates.length === 0) {
      return NextResponse.json(
        {
          error: "Nenhuma página candidata válida de aprofundamento foi identificada após normalização.",
          code: "NO_CANDIDATE_PAGES_FOUND",
        },
        { status: 422 }
      );
    }

    // 5. Ordenar deterministicamente por materialId e pageNumber
    normalizedCandidates.sort((a, b) => {
      const cmp = a.materialId.localeCompare(b.materialId);
      if (cmp !== 0) return cmp;
      return a.pageNumber - b.pageNumber;
    });

    // Etapa C: Deep Analysis (usando exatamente a lista normalizada e ordenada para garantir ordem determinística)
    const filteredEstPages = normalizedCandidates.map((c) => {
      const dbPage = estPagesDb.find(
        (p) => p.materialId === c.materialId && p.pageNumber === c.pageNumber
      )!;
      return {
        materialId: dbPage.materialId,
        pageNumber: dbPage.pageNumber,
        text: dbPage.text,
      };
    });

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

    // Obter lista ordenada e única de páginas analisadas por material
    const cfcFingerprintInput = cfcMaterialInput.textByPage
      .map((p) => ({
        materialId: cfcMaterialId,
        pageNumber: p.pageNumber,
        text: p.text,
      }))
      .sort((a, b) => a.pageNumber - b.pageNumber);

    const cfcFingerprint = canonicalHash(cfcFingerprintInput);

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
        provider: providerMetadata.provider,
        modelUsed: providerMetadata.model,
        promptVersion: providerMetadata.promptVersion,
        generatedAt: now,
        generationRunId,
        confidence: analysisResult.confidence,
        warnings: [],
        blockingWarnings: [],
        batchConfig: DEFAULT_BATCH_CONFIG,
        analyzedScope: {
          cfcMaterialId,
          cfcPageNumbers: cfcMaterialInput.textByPage.map((p) => p.pageNumber).sort((a, b) => a - b),
          deepeningMaterials: estrategiaMaterials.map((m) => {
            const pageNums = filteredEstPages
              .filter((p) => p.materialId === m.id)
              .map((p) => p.pageNumber)
              .sort((a, b) => a - b);
            return {
              materialId: m.id,
              pageNumbers: pageNums,
            };
          }),
        },
        sourceFingerprintCfc: cfcFingerprint,
        sourceFingerprintsDeepening: estrategiaMaterials
          .map((m) => {
            const mPages = filteredEstPages
              .filter((p) => p.materialId === m.id)
              .map((p) => ({
                materialId: m.id,
                pageNumber: p.pageNumber,
                text: p.text,
              }))
              .sort((a, b) => a.pageNumber - b.pageNumber);
            return {
              materialId: m.id,
              fingerprint: canonicalHash(mPages),
            };
          })
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
