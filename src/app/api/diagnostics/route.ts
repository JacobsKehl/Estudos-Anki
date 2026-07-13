import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export const dynamic = "force-dynamic";

/**
 * Auxiliar para obter o usuário admin autenticado.
 * Lança um erro caso o usuário não seja autenticado ou não tenha o e-mail cadastrado como admin.
 */
async function getAdminUser() {
  const userId = await getMockUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  const adminEmail = process.env.ADMIN_EMAIL || "dev@kehl.study";
  if (!user.email || user.email !== adminEmail) {
    throw new Error("Acesso negado: Apenas administradores autorizados.");
  }

  return user;
}

export async function GET(_req?: NextRequest) {
  void _req;
  // Retorna 404 se diagnósticos estiverem desabilitados, para não expor a existência da rota em produção
  if (process.env.ENABLE_DIAGNOSTICS !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const adminUser = await getAdminUser();
    const userId = adminUser.id;

    // 1. Detect Duplicate Study Blocks
    // Fetch all study blocks for this user
    const blocks = await prisma.studyBlock.findMany({
      where: { userId },
      select: {
        id: true,
        materialId: true,
        pageStart: true,
        pageEnd: true,
        title: true,
        createdAt: true,
      },
    });

    const blockGroups: { [key: string]: typeof blocks } = {};
    for (const b of blocks) {
      const key = `${b.materialId}_${b.pageStart}_${b.pageEnd}`;
      if (!blockGroups[key]) {
        blockGroups[key] = [];
      }
      blockGroups[key].push(b);
    }

    const duplicates = Object.entries(blockGroups)
      .filter(([, group]) => group.length > 1)
      .map(([key, group]) => ({
        key,
        title: group[0].title,
        pageStart: group[0].pageStart,
        pageEnd: group[0].pageEnd,
        count: group.length,
        blockIds: group.map(b => b.id),
      }));

    // 2. Detect Orphaned Flashcards
    // Fetch all flashcards with their block and material IDs
    const cards = await prisma.flashcard.findMany({
      where: { userId },
      select: {
        id: true,
        question: true,
        studyBlockId: true,
        materialId: true,
      },
    });

    // Fetch existing block and material IDs to check existence
    const existingBlockIds = new Set(
      (
        await prisma.studyBlock.findMany({
          where: { userId },
          select: { id: true },
        })
      ).map(b => b.id)
    );

    const existingMaterialIds = new Set(
      (
        await prisma.studyMaterial.findMany({
          where: { userId },
          select: { id: true },
        })
      ).map(m => m.id)
    );

    const orphanedCards = cards.filter(card => {
      const hasInvalidBlock = card.studyBlockId && !existingBlockIds.has(card.studyBlockId);
      const hasInvalidMaterial = card.materialId && !existingMaterialIds.has(card.materialId);
      return hasInvalidBlock || hasInvalidMaterial;
    }).map(c => ({
      id: c.id,
      question: c.question.substring(0, 60) + (c.question.length > 60 ? "..." : ""),
      studyBlockId: c.studyBlockId,
      materialId: c.materialId,
      reason: c.studyBlockId && !existingBlockIds.has(c.studyBlockId) ? "Missing Block" : "Missing Material",
    }));

    // 3. Detect Hybrid Block Integrity Issues
    const hybridBlocks = await prisma.studyBlock.findMany({
      where: { userId, methodology: "HYBRID_8020" },
      include: {
        sources: {
          include: {
            material: true,
            segments: true
          }
        }
      }
    });

    const hybridIssues = [];
    for (const hb of hybridBlocks) {
      // 1. NO_SOURCES
      if (hb.sources.length === 0) {
        hybridIssues.push({
          blockId: hb.id,
          title: hb.title,
          issue: "NO_SOURCES",
          message: "Bloco híbrido não possui nenhum material de origem (sources) associado."
        });
        continue;
      }

      // 2. MISSING_ANCHOR / MULTIPLE_ANCHORS
      const anchors = hb.sources.filter((s: any) => s.sourceRole === "ANCHOR_8020");
      if (anchors.length === 0) {
        hybridIssues.push({
          blockId: hb.id,
          title: hb.title,
          issue: "MISSING_ANCHOR",
          message: "Bloco híbrido não possui material de ancoragem (ANCHOR_8020/CFC) associado."
        });
      } else if (anchors.length > 1) {
        hybridIssues.push({
          blockId: hb.id,
          title: hb.title,
          issue: "MULTIPLE_ANCHORS",
          message: `Bloco híbrido possui múltiplos materiais de ancoragem: ${anchors.length}.`
        });
      }

      // 3. MISSING_DEEPENING
      const deepenings = hb.sources.filter((s: any) => s.sourceRole === "DEEPENING");
      if (deepenings.length === 0) {
        hybridIssues.push({
          blockId: hb.id,
          title: hb.title,
          issue: "MISSING_DEEPENING",
          message: "Bloco híbrido não possui material de aprofundamento (DEEPENING/ESTRATEGIA) associado."
        });
      }

      // 4. MISSING_CANONICAL_DEEPENING / MULTIPLE_CANONICAL_DEEPENINGS
      const canonicalDeepenings = deepenings.filter((s: any) => s.isCanonical === true);
      if (deepenings.length > 0 && canonicalDeepenings.length === 0) {
        hybridIssues.push({
          blockId: hb.id,
          title: hb.title,
          issue: "MISSING_CANONICAL_DEEPENING",
          message: "Bloco híbrido possui aprofundamento, mas nenhum deles está marcado como canônico."
        });
      } else if (canonicalDeepenings.length > 1) {
        hybridIssues.push({
          blockId: hb.id,
          title: hb.title,
          issue: "MULTIPLE_CANONICAL_DEEPENINGS",
          message: `Bloco híbrido possui múltiplos aprofundamentos canônicos: ${canonicalDeepenings.length}.`
        });
      }

      // 5. ANCHOR_MARKED_CANONICAL
      const canonicalAnchors = anchors.filter((s: any) => s.isCanonical === true);
      if (canonicalAnchors.length > 0) {
        hybridIssues.push({
          blockId: hb.id,
          title: hb.title,
          issue: "ANCHOR_MARKED_CANONICAL",
          message: "A fonte de ancoragem (CFC) está marcada incorretamente como canônica (isCanonical = true)."
        });
      }

      // 6. DUPLICATE_SOURCE_ROLE_MATERIAL
      const sourceKeyCounts: { [key: string]: number } = {};
      for (const s of hb.sources) {
        const key = `${s.materialId}_${s.sourceRole}`;
        sourceKeyCounts[key] = (sourceKeyCounts[key] || 0) + 1;
        if (sourceKeyCounts[key] > 1) {
          hybridIssues.push({
            blockId: hb.id,
            title: hb.title,
            issue: "DUPLICATE_SOURCE_ROLE_MATERIAL",
            message: `A fonte do material ID ${s.materialId} com o papel ${s.sourceRole} está duplicada no mesmo bloco.`
          });
        }
      }

      // Varredura de integridade física e de segmentos
      for (const s of hb.sources) {
        if (!s.material) {
          hybridIssues.push({
            blockId: hb.id,
            title: hb.title,
            issue: "ORPHANED_SOURCE",
            message: `A fonte do material ID ${s.materialId} está órfã (material não existe).`
          });
        }

        // NO_SEGMENTS
        if (s.segments.length === 0) {
          hybridIssues.push({
            blockId: hb.id,
            title: hb.title,
            issue: "NO_SEGMENTS",
            message: `A fonte ${s.material?.fileName || s.materialId} não possui segmentos de páginas configurados.`
          });
          continue;
        }

        // INVALID_SEGMENT_RANGE & OVERLAPPING_CONTRADICTORY_SEGMENTS
        const pageDispositions: { [page: number]: Set<string> } = {};

        for (const seg of s.segments) {
          if (seg.pageStart > seg.pageEnd || seg.pageStart < 1 || seg.pageEnd < 1) {
            hybridIssues.push({
              blockId: hb.id,
              title: hb.title,
              issue: "INVALID_SEGMENT_RANGE",
              message: `Intervalo de páginas inválido: pág. ${seg.pageStart} a ${seg.pageEnd} na fonte ${s.material?.fileName || s.materialId}.`
            });
          }

          const start = Math.min(seg.pageStart, seg.pageEnd);
          const end = Math.max(seg.pageStart, seg.pageEnd);
          for (let p = start; p <= end; p++) {
            if (!pageDispositions[p]) {
              pageDispositions[p] = new Set<string>();
            }
            pageDispositions[p].add(seg.disposition);
          }
        }

        const contradictoryPages = Object.entries(pageDispositions)
          .filter(([, disps]) => disps.size > 1)
          .map(([page]) => parseInt(page));

        if (contradictoryPages.length > 0) {
          hybridIssues.push({
            blockId: hb.id,
            title: hb.title,
            issue: "OVERLAPPING_CONTRADICTORY_SEGMENTS",
            message: `A fonte ${s.material?.fileName || s.materialId} possui segmentos sobrepostos e contraditórios nas páginas: ${contradictoryPages.join(", ")}.`
          });
        }
      }

      // 7. Envelopes legados / LEGACY_MATERIAL_MISMATCH, LEGACY_PAGE_START_MISMATCH, LEGACY_PAGE_END_MISMATCH
      if (canonicalDeepenings.length === 1 && hb.materialId !== canonicalDeepenings[0].materialId) {
        hybridIssues.push({
          blockId: hb.id,
          title: hb.title,
          issue: "LEGACY_MATERIAL_MISMATCH",
          message: `O materialId legado do bloco (${hb.materialId}) não condiz com o material de aprofundamento canônico (${canonicalDeepenings[0].materialId}).`
        });
      }

      if (canonicalDeepenings.length === 1) {
        const canonicalDeep = canonicalDeepenings[0];
        const readSegments = canonicalDeep.segments.filter((seg: any) => seg.disposition === "READ");
        if (readSegments.length > 0) {
          const expectedPageStart = Math.min(...readSegments.map((seg: any) => seg.pageStart));
          const expectedPageEnd = Math.max(...readSegments.map((seg: any) => seg.pageEnd));

          if (hb.pageStart !== expectedPageStart) {
            hybridIssues.push({
              blockId: hb.id,
              title: hb.title,
              issue: "LEGACY_PAGE_START_MISMATCH",
              message: `O pageStart legado do bloco (${hb.pageStart}) diverge do menor READ canônico (${expectedPageStart}).`
            });
          }

          if (hb.pageEnd !== expectedPageEnd) {
            hybridIssues.push({
              blockId: hb.id,
              title: hb.title,
              issue: "LEGACY_PAGE_END_MISMATCH",
              message: `O pageEnd legado do bloco (${hb.pageEnd}) diverge do maior READ canônico (${expectedPageEnd}).`
            });
          }
        }
      }
    }

    return NextResponse.json({
      summary: {
        duplicateBlockGroups: duplicates.length,
        totalDuplicateBlocks: duplicates.reduce((acc, curr) => acc + curr.count - 1, 0),
        orphanedFlashcards: orphanedCards.length,
        hybridBlockIssues: hybridIssues.length,
      },
      details: {
        duplicates,
        orphanedCards,
        hybridIssues,
      },
    });
  } catch (error: any) {
    console.error("[DIAGNOSTICS GET]", error);
    const isAccessDenied = error.message && error.message.includes("Acesso negado");
    return NextResponse.json(
      { error: isAccessDenied ? error.message : "Erro ao executar diagnóstico." },
      { status: isAccessDenied ? 403 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Retorna 404 se diagnósticos estiverem desabilitados, para não expor a existência da rota em produção
  if (process.env.ENABLE_DIAGNOSTICS !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const adminUser = await getAdminUser();
    const userId = adminUser.id;

    const body = await req.json().catch(() => ({}));
    
    // Confirmação textual forte obrigatória para ações destrutivas/modificações no banco
    if (body.confirm !== "RUN_DIAGNOSTICS_FIX") {
      return NextResponse.json(
        { error: "Ação destrutiva exige confirmação textual explícita 'RUN_DIAGNOSTICS_FIX' no corpo da requisição." },
        { status: 400 }
      );
    }

    const action = body.action || "fix_all"; // fix_duplicates | fix_orphans | fix_all

    let fixedDuplicatesCount = 0;
    let deletedOrphansCount = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Fix Duplicates
      if (action === "fix_duplicates" || action === "fix_all") {
        const blocks = await tx.studyBlock.findMany({
          where: { userId },
          select: {
            id: true,
            materialId: true,
            pageStart: true,
            pageEnd: true,
            createdAt: true,
          },
        });

        const blockGroups: { [key: string]: typeof blocks } = {};
        for (const b of blocks) {
          const key = `${b.materialId}_${b.pageStart}_${b.pageEnd}`;
          if (!blockGroups[key]) {
            blockGroups[key] = [];
          }
          blockGroups[key].push(b);
        }

        const duplicateGroups = Object.values(blockGroups).filter(g => g.length > 1);

        for (const group of duplicateGroups) {
          // Sort by createdAt ascending (earliest first)
          group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          const [keptBlock, ...duplicatesToRemove] = group;
          const duplicateIds = duplicatesToRemove.map(b => b.id);

          // Update flashcards pointing to duplicate blocks to point to the kept block
          await tx.flashcard.updateMany({
            where: {
              studyBlockId: { in: duplicateIds },
            },
            data: {
              studyBlockId: keptBlock.id,
            },
          });

          // Update schedule items pointing to duplicate blocks to point to the kept block
          await tx.studyScheduleItem.updateMany({
            where: {
              studyBlockId: { in: duplicateIds },
            },
            data: {
              studyBlockId: keptBlock.id,
            },
          });

          // Update support material relationships if any
          await tx.studyBlockSupport.updateMany({
            where: {
              studyBlockId: { in: duplicateIds },
            },
            data: {
              studyBlockId: keptBlock.id,
            },
          });

          // Delete the duplicate blocks
          await tx.studyBlock.deleteMany({
            where: {
              id: { in: duplicateIds },
            },
          });

          fixedDuplicatesCount += duplicateIds.length;
        }
      }

      // 2. Fix Orphaned Flashcards
      if (action === "fix_orphans" || action === "fix_all") {
        const cards = await tx.flashcard.findMany({
          where: { userId },
          select: {
            id: true,
            studyBlockId: true,
            materialId: true,
          },
        });

        const existingBlocks = await tx.studyBlock.findMany({
          where: { userId },
          select: { id: true },
        });
        const existingBlockIds = new Set(existingBlocks.map(b => b.id));

        const existingMaterials = await tx.studyMaterial.findMany({
          where: { userId },
          select: { id: true },
        });
        const existingMaterialIds = new Set(existingMaterials.map(m => m.id));

        const cardsToDelete = cards.filter(card => {
          const hasInvalidBlock = card.studyBlockId && !existingBlockIds.has(card.studyBlockId);
          const hasInvalidMaterial = card.materialId && !existingMaterialIds.has(card.materialId);
          return hasInvalidBlock || hasInvalidMaterial;
        });

        if (cardsToDelete.length > 0) {
          const idsToDelete = cardsToDelete.map(c => c.id);
          await tx.flashcard.deleteMany({
            where: {
              id: { in: idsToDelete },
            },
          });
          deletedOrphansCount = idsToDelete.length;
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: "Correção de dados executada com sucesso.",
      fixedDuplicates: fixedDuplicatesCount,
      deletedOrphans: deletedOrphansCount,
    });
  } catch (error: any) {
    console.error("[DIAGNOSTICS POST]", error);
    const isAccessDenied = error.message && error.message.includes("Acesso negado");
    return NextResponse.json(
      { error: isAccessDenied ? error.message : "Erro ao executar correção de dados." },
      { status: isAccessDenied ? 403 : 500 }
    );
  }
}
