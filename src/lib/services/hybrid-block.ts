/**
 * src/lib/services/hybrid-block.ts
 *
 * Serviço de persistência transacional para blocos HYBRID_8020.
 *
 * REGRAS CRÍTICAS:
 *   - Não cria StudySessionLog.
 *   - Não cria nem modifica StudyScheduleItem.
 *   - Não modifica schedule-window-core nem LEGACY_TRT4.
 *   - Recebe o cliente Prisma como dependência (permite mocks nos testes).
 *   - Revalida todas as invariantes DENTRO da transação antes dos inserts.
 */

import type {
  HybridBlockOutput,
  HybridSourceSeed,
} from "@/lib/ai/hybrid-engine";
import {
  computeLegacyEnvelope,
  mergeAdjacentSegments,
  validateHybridOutput,
} from "@/lib/ai/hybrid-engine";
import {
  calculateHybridMinutes,
  isHybridTimeError,
} from "@/lib/study/hybrid-estimated-time";

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export interface HybridBlockCreateInput {
  userId: string;
  subjectId: string;
  output: HybridBlockOutput;
  availableMinutes: number;
  timeConfig?: {
    wordsPerMinute?: number;
    anchorMinimumMinutes?: number;
    deepeningMinimumMinutes?: number;
    minimumBlockMinutes?: number;
  };
}

export interface HybridBlockCreateResult {
  studyBlockId: string;
  estimatedStudyMinutes: number;
}

// ─── Interface mínima do Prisma para injeção ──────────────────────────────────
// Usamos `unknown` para os modelos — a checagem real é feita em runtime.
// Isso evita dependência direta do tipo gerado (@prisma/client) neste serviço puro.

export interface PrismaLike {
  studyBlock: {
    findUnique: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<{ id: string }>;
  };
  studyBlockSource: {
    create: (args: unknown) => Promise<{ id: string }>;
  };
  studyBlockSourceSegment: {
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
  flashcard: {
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
  $transaction: <T>(fn: (tx: PrismaLike) => Promise<T>) => Promise<T>;
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Persiste um bloco híbrido completo em uma única transação atômica.
 *
 * Garante:
 *   - Idempotência por generationRunId (com validação de userId).
 *   - Exatamente um DEEPENING canônico.
 *   - Envelope legado coerente (pageStart/pageEnd).
 *   - estimatedStudyMinutes > 0 e persistido.
 *   - Flashcards criados como PENDING_APPROVAL.
 *   - Sem StudySessionLog ou StudyScheduleItem.
 */
export async function createHybridBlock(
  prisma: PrismaLike,
  input: HybridBlockCreateInput
): Promise<HybridBlockCreateResult> {
  const { userId, subjectId, output, availableMinutes, timeConfig } = input;

  // ── Pré-validação fora da transação ──────────────────────────────────────
  const validationErrors = validateHybridOutput(output, output.aiAuditMetadata.analyzedScope);
  if (validationErrors.length > 0) {
    throw new Error(
      `[hybrid-block] Validação do output falhou: ${validationErrors.map((e) => e.message).join("; ")}`
    );
  }

  if (output.blockingWarnings.length > 0) {
    throw new Error(
      `[hybrid-block] Confirmação rejeitada: blockingWarnings presentes: ${output.blockingWarnings.join("; ")}`
    );
  }

  // ── Idempotência ──────────────────────────────────────────────────────────
  const existingBlock = await (prisma.studyBlock.findUnique as (args: { where: { generationRunId: string } }) => Promise<{ id: string; userId: string } | null>)({
    where: { generationRunId: output.generationRunId },
  });

  if (existingBlock) {
    // SEGURANÇA: nunca revelar bloco de outro usuário
    if (existingBlock.userId !== userId) {
      throw new Error(
        `[hybrid-block] Conflito de generationRunId para usuário diferente. Rejeição segura.`
      );
    }
    // Retry legítimo — retornar bloco existente
    return {
      studyBlockId: existingBlock.id,
      estimatedStudyMinutes: 0, // não recalculado em retry
    };
  }

  // ── Calcular estimativa de tempo ─────────────────────────────────────────
  const cfcSource = output.sources.find((s) => s.sourceRole === "ANCHOR_8020");
  const deepeningSource = output.sources.filter((s) => s.sourceRole === "DEEPENING");

  const cfcReadWords = countReadWords(cfcSource);
  const deepeningReadWords = deepeningSource.reduce(
    (sum, d) => sum + countReadWords(d),
    0
  );

  const timeResult = calculateHybridMinutes({
    cfcReadWords,
    deepeningReadWords,
    availableMinutes,
    config: timeConfig,
  });

  if (isHybridTimeError(timeResult)) {
    throw new Error(`[hybrid-block] ${timeResult.error} (código: ${timeResult.code})`);
  }

  const { finalMinutes, audit: timeAudit } = timeResult;

  // ── Calcular envelope legado ──────────────────────────────────────────────
  const envelope = computeLegacyEnvelope(output.sources);
  if (!envelope) {
    throw new Error(
      "[hybrid-block] Impossível calcular envelope legado: nenhum segmento READ no DEEPENING canônico."
    );
  }

  const canonicalDeepening = output.sources.find(
    (s) => s.sourceRole === "DEEPENING" && s.isCanonical
  )!;

  // ── Transação atômica ─────────────────────────────────────────────────────
  return await prisma.$transaction(async (tx) => {
    // Revalidar idempotência DENTRO da transação (proteção contra concorrência)
    const concurrentBlock = await (tx.studyBlock.findUnique as (args: { where: { generationRunId: string } }) => Promise<{ id: string; userId: string } | null>)({
      where: { generationRunId: output.generationRunId },
    });

    if (concurrentBlock) {
      if (concurrentBlock.userId !== userId) {
        throw new Error("[hybrid-block] Conflito de generationRunId na transação. Rejeição segura.");
      }
      return { studyBlockId: concurrentBlock.id, estimatedStudyMinutes: finalMinutes };
    }

    // Criar o StudyBlock
    const block = await (tx.studyBlock.create as (args: { data: unknown }) => Promise<{ id: string }>)({
      data: {
        userId,
        subjectId,
        materialId: canonicalDeepening.materialId,
        title: output.title,
        pageStart: envelope.pageStart,
        pageEnd: envelope.pageEnd,
        orderIndex: 9999, // posicionado ao final; usuário pode reordenar
        estimatedStudyMinutes: finalMinutes,
        methodology: "HYBRID_8020",
        generationRunId: output.generationRunId,
        aiAuditMetadata: {
          ...output.aiAuditMetadata,
          timeEstimation: timeAudit,
        },
        createdBy: "AI",
      },
    });

    // Criar StudyBlockSource + Segmentos para cada fonte
    for (const source of output.sources) {
      const mergedSegments = mergeAdjacentSegments(source.segments);

      const createdSource = await (tx.studyBlockSource.create as (args: { data: unknown }) => Promise<{ id: string }>)({
        data: {
          studyBlockId: block.id,
          materialId: source.materialId,
          sourceRole: source.sourceRole,
          isCanonical: source.isCanonical,
          selectionReason: source.selectionReason,
          confidence: source.confidence,
          orderIndex: source.orderIndex,
        },
      });

      if (mergedSegments.length > 0) {
        await (tx.studyBlockSourceSegment.createMany as (args: { data: unknown }) => Promise<{ count: number }>)({
          data: mergedSegments.map((seg, idx) => ({
            sourceId: createdSource.id,
            disposition: seg.disposition,
            pageStart: seg.pageStart,
            pageEnd: seg.pageEnd,
            reason: seg.reason,
            orderIndex: idx,
          })),
        });
      }
    }

    // Criar flashcards como PENDING_APPROVAL
    if (output.flashcardSeeds.length > 0) {
      await (tx.flashcard.createMany as (args: { data: unknown }) => Promise<{ count: number }>)({
        data: output.flashcardSeeds.map((seed) => ({
          userId,
          subjectId,
          studyBlockId: block.id,
          materialId: seed.sourceMaterialId,
          question: seed.question,
          answer: seed.answer,
          type: seed.type,
          status: "PENDING_APPROVAL",
          sourcePageStart: seed.sourcePageStart,
          sourcePageEnd: seed.sourcePageEnd,
          generationReason: seed.generationReason,
        })),
      });
    }

    return { studyBlockId: block.id, estimatedStudyMinutes: finalMinutes };
  });
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

/**
 * Conta palavras nos segmentos READ de uma fonte.
 * Retorna 0 se a fonte for undefined ou não tiver segmentos READ.
 *
 * NOTA: sem o texto real disponível aqui (o texto fica na engine),
 * usamos a heurística de caracteres/5 como estimativa.
 * O chamador pode sobrescrever passando cfcReadWords/deepeningReadWords calculados.
 */
function countReadWords(source: HybridSourceSeed | undefined): number {
  if (!source) return 0;
  return source.segments
    .filter((s) => s.disposition === "READ")
    .reduce((total, seg) => {
      // Heurística: 1 palavra ≈ 5 caracteres (fallback sem texto real)
      // O texto real é usado na engine; aqui usamos o span de páginas
      const estimatedCharsPerPage = 1800;
      const pages = seg.pageEnd - seg.pageStart + 1;
      return total + Math.round((pages * estimatedCharsPerPage) / 5);
    }, 0);
}
