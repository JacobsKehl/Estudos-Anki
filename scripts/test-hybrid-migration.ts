/**
 * scripts/test-hybrid-migration.ts
 *
 * Script de validação da migration híbrida 80/20.
 * Executado exclusivamente no CI (GitHub Actions) contra um banco descartável.
 * Valida a modelagem, defaults, unicidade, cascading e restrições.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=== Iniciando testes de integridade da migration híbrida ===");

  // 1. Criar massa base
  const user = await prisma.user.create({
    data: {
      email: "test-migration@kehl.study",
      name: "User Test Migration",
      passwordHash: "dummy",
    },
  });

  const subject = await prisma.studySubject.create({
    data: {
      name: "Direito Híbrido Test",
      userId: user.id,
    },
  });

  // 2. Testar default de StudyMaterial.provider (deve ser OTHER)
  console.log("Testando default de StudyMaterial.provider...");
  const materialDefault = await prisma.studyMaterial.create({
    data: {
      fileName: "default.pdf",
      originalFileName: "Material Default",
      organizationStatus: "NOT_ORGANIZED",
      totalPages: 10,
      userId: user.id,
      subjectId: subject.id,
    },
  });
  if (materialDefault.provider !== "OTHER") {
    throw new Error(`Default de StudyMaterial.provider esperado 'OTHER', obtido: ${materialDefault.provider}`);
  }
  console.log("✅ Default de StudyMaterial.provider é OTHER.");

  // 3. Testar todos os valores do enum StudyMaterialProvider
  console.log("Testando valores do enum StudyMaterialProvider...");
  const providerEnumValues = ["CFC", "ESTRATEGIA", "OTHER"] as const;
  for (const prov of providerEnumValues) {
    const mat = await prisma.studyMaterial.create({
      data: {
        fileName: `file-${prov}.pdf`,
        originalFileName: `Material ${prov}`,
        organizationStatus: "NOT_ORGANIZED",
        totalPages: 10,
        userId: user.id,
        subjectId: subject.id,
        provider: prov,
      },
    });
    if (mat.provider !== prov) {
      throw new Error(`Provedor esperado '${prov}', obtido: ${mat.provider}`);
    }
  }
  console.log("✅ Todos os valores de StudyMaterialProvider aceitos.");

  // 4. Testar default de StudyBlock.methodology (deve ser LINEAR)
  console.log("Testando default de StudyBlock.methodology...");
  const blockDefault = await prisma.studyBlock.create({
    data: {
      title: "Bloco Default",
      methodology: undefined, // força default
      userId: user.id,
      subjectId: subject.id,
      materialId: materialDefault.id,
      pageStart: 1,
      pageEnd: 5,
      estimatedStudyMinutes: 45,
    },
  });
  if (blockDefault.methodology !== "LINEAR") {
    throw new Error(`Default de StudyBlock.methodology esperado 'LINEAR', obtido: ${blockDefault.methodology}`);
  }
  console.log("✅ Default de StudyBlock.methodology é LINEAR.");

  // 5. Testar múltiplos generationRunId NULL no StudyBlock
  console.log("Testando múltiplos generationRunId NULL...");
  const blockNull1 = await prisma.studyBlock.create({
    data: {
      title: "Bloco Null 1",
      generationRunId: null,
      userId: user.id,
      subjectId: subject.id,
      materialId: materialDefault.id,
      pageStart: 1,
      pageEnd: 5,
      estimatedStudyMinutes: 45,
    },
  });
  const blockNull2 = await prisma.studyBlock.create({
    data: {
      title: "Bloco Null 2",
      generationRunId: null,
      userId: user.id,
      subjectId: subject.id,
      materialId: materialDefault.id,
      pageStart: 1,
      pageEnd: 5,
      estimatedStudyMinutes: 45,
    },
  });
  console.log("✅ Múltiplos generationRunId NULL permitidos e coexistem.");

  // 6. Testar rejeição de generationRunId duplicado não nulo
  console.log("Testando exclusividade de generationRunId...");
  const runId = "unique-run-id-123";
  await prisma.studyBlock.create({
    data: {
      title: "Bloco Híbrido 1",
      generationRunId: runId,
      userId: user.id,
      subjectId: subject.id,
      materialId: materialDefault.id,
      pageStart: 1,
      pageEnd: 5,
      estimatedStudyMinutes: 45,
    },
  });

  try {
    await prisma.studyBlock.create({
      data: {
        title: "Bloco Híbrido Duplicado",
        generationRunId: runId,
        userId: user.id,
        subjectId: subject.id,
        materialId: materialDefault.id,
        pageStart: 1,
        pageEnd: 5,
        estimatedStudyMinutes: 45,
      },
    });
    throw new Error("Erro: O banco de dados aceitou generationRunId duplicado não nulo!");
  } catch (err: any) {
    if (err.message && err.message.includes(" O banco de dados aceitou")) {
      throw err;
    }
    console.log("✅ Geração de erro esperado para generationRunId duplicado.");
  }

  // 7. Testar aiAuditMetadata nullable e preenchido
  console.log("Testando aiAuditMetadata...");
  const blockWithMetadata = await prisma.studyBlock.create({
    data: {
      title: "Bloco com Metadata",
      userId: user.id,
      subjectId: subject.id,
      materialId: materialDefault.id,
      pageStart: 1,
      pageEnd: 5,
      estimatedStudyMinutes: 45,
      aiAuditMetadata: { timeEstimation: { availableMinutes: 120 } } as any,
    },
  });
  if (!blockWithMetadata.aiAuditMetadata || (blockWithMetadata.aiAuditMetadata as any).timeEstimation.availableMinutes !== 120) {
    throw new Error("Erro ao persistir ou recuperar aiAuditMetadata.");
  }
  console.log("✅ aiAuditMetadata nullable e preenchido funciona.");

  // 8. Testar generationReason nullable e preenchido no Flashcard
  console.log("Testando generationReason no Flashcard...");
  const flashcardNull = await prisma.flashcard.create({
    data: {
      question: "Frente Null",
      answer: "Verso Null",
      userId: user.id,
      subjectId: subject.id,
      studyBlockId: blockDefault.id,
      generationReason: null,
    },
  });
  const flashcardVal = await prisma.flashcard.create({
    data: {
      question: "Frente Val",
      answer: "Verso Val",
      userId: user.id,
      subjectId: subject.id,
      studyBlockId: blockDefault.id,
      generationReason: "8020_ANCHOR",
    },
  });
  if (flashcardVal.generationReason !== "8020_ANCHOR") {
    throw new Error("generationReason do Flashcard não persistido.");
  }
  console.log("✅ generationReason no Flashcard aceita nulo e preenchido.");

  // 9. Testar enums do StudyBlockSource e StudyBlockSourceSegment
  console.log("Testando enums e criação de fontes/segmentos...");
  const sourceRoles = ["ANCHOR_8020", "DEEPENING", "QUESTIONS", "LAW_TEXT", "SUPPORT"] as const;
  const segmentDispositions = ["READ", "CONSULT", "SKIP"] as const;

  const hybridBlock = await prisma.studyBlock.create({
    data: {
      title: "Bloco Híbrido Test",
      methodology: "HYBRID_8020",
      userId: user.id,
      subjectId: subject.id,
      materialId: materialDefault.id,
      pageStart: 1,
      pageEnd: 10,
      estimatedStudyMinutes: 90,
    },
  });

  const source = await prisma.studyBlockSource.create({
    data: {
      studyBlockId: hybridBlock.id,
      materialId: materialDefault.id,
      sourceRole: "ANCHOR_8020",
      isCanonical: true,
      selectionReason: "Main text",
      confidence: 0.95,
    },
  });

  const segment = await prisma.studyBlockSourceSegment.create({
    data: {
      sourceId: source.id,
      disposition: "READ",
      pageStart: 1,
      pageEnd: 5,
      reason: "Anchor text segment",
    },
  });

  if (source.sourceRole !== "ANCHOR_8020" || segment.disposition !== "READ") {
    throw new Error("Erro na gravação de enums do StudyBlockSource ou Segment.");
  }
  console.log("✅ Enums do StudyBlockSource e Segment aceitos com sucesso.");

  // 10. Testar unique composto em StudyBlockSource (studyBlockId + materialId + sourceRole)
  console.log("Testando constraint unique composta em StudyBlockSource...");
  try {
    await prisma.studyBlockSource.create({
      data: {
        studyBlockId: hybridBlock.id,
        materialId: materialDefault.id,
        sourceRole: "ANCHOR_8020", // Duplicado no mesmo bloco e mesmo material
      },
    });
    throw new Error("Erro: O banco permitiu duplicata do unique composto de fontes!");
  } catch (err: any) {
    if (err.message && err.message.includes(" O banco permitiu")) {
      throw err;
    }
    console.log("✅ Rejeição de duplicata composta funcionando.");
  }

  // 11. Testar exclusão CASCADE de StudyBlock (deve deletar suas fontes e seus segmentos)
  console.log("Testando cascade de StudyBlock...");
  const tempBlock = await prisma.studyBlock.create({
    data: {
      title: "Bloco Temporário Cascade",
      userId: user.id,
      subjectId: subject.id,
      materialId: materialDefault.id,
      pageStart: 1,
      pageEnd: 5,
      estimatedStudyMinutes: 45,
    },
  });
  const tempSource = await prisma.studyBlockSource.create({
    data: {
      studyBlockId: tempBlock.id,
      materialId: materialDefault.id,
      sourceRole: "DEEPENING",
    },
  });
  const tempSegment = await prisma.studyBlockSourceSegment.create({
    data: {
      sourceId: tempSource.id,
      disposition: "CONSULT",
      pageStart: 10,
      pageEnd: 20,
    },
  });

  // Deletar o bloco
  await prisma.studyBlock.delete({ where: { id: tempBlock.id } });

  // Verificar se a fonte e o segmento sumiram
  const sourceCheck = await prisma.studyBlockSource.findUnique({ where: { id: tempSource.id } });
  const segmentCheck = await prisma.studyBlockSourceSegment.findUnique({ where: { id: tempSegment.id } });

  if (sourceCheck !== null || segmentCheck !== null) {
    throw new Error("Erro: Cascade de StudyBlock falhou!");
  }
  console.log("✅ CASCADE de StudyBlock removeu as fontes e segmentos corretamente.");

  // 12. Testar exclusão CASCADE de StudyBlockSource (deve deletar seus segmentos)
  console.log("Testando cascade de StudyBlockSource...");
  const cascadeSource = await prisma.studyBlockSource.create({
    data: {
      studyBlockId: hybridBlock.id,
      materialId: materialDefault.id,
      sourceRole: "DEEPENING",
    },
  });
  const cascadeSegment = await prisma.studyBlockSourceSegment.create({
    data: {
      sourceId: cascadeSource.id,
      disposition: "SKIP",
      pageStart: 10,
      pageEnd: 20,
    },
  });

  await prisma.studyBlockSource.delete({ where: { id: cascadeSource.id } });
  const segmentCheck2 = await prisma.studyBlockSourceSegment.findUnique({ where: { id: cascadeSegment.id } });
  if (segmentCheck2 !== null) {
    throw new Error("Erro: Cascade de StudyBlockSource falhou!");
  }
  console.log("✅ CASCADE de StudyBlockSource removeu seus segmentos corretamente.");

  // 13. Testar restrição RESTRICT em StudyMaterial vinculado a StudyBlockSource
  console.log("Testando RESTRICT de StudyMaterial vinculado...");
  try {
    await prisma.studyMaterial.delete({ where: { id: materialDefault.id } });
    throw new Error("Erro: O banco permitiu deletar um StudyMaterial referenciado por StudyBlockSource (RESTRICT falhou)!");
  } catch (err: any) {
    if (err.message && err.message.includes(" O banco permitiu")) {
      throw err;
    }
    console.log("✅ RESTRICT impediu a exclusão do material referenciado.");
  }

  // 14. Limpar dados sintéticos de teste do banco
  console.log("Limpando dados sintéticos...");
  // Desvincular fontes para conseguir deletar materiais e bloco
  await prisma.studyBlockSource.deleteMany({ where: { studyBlockId: { in: [hybridBlock.id] } } });
  await prisma.flashcard.deleteMany({ where: { userId: user.id } });
  await prisma.studyBlock.deleteMany({ where: { userId: user.id } });
  await prisma.studyMaterial.deleteMany({ where: { userId: user.id } });
  await prisma.studySubject.delete({ where: { id: subject.id } });
  await prisma.user.delete({ where: { id: user.id } });

  // 15. Garantir que nenhuma alteração indesejada foi feita
  const logCount = await prisma.studySessionLog.count({ where: { userId: user.id } });
  const itemCount = await prisma.studyScheduleItem.count({ where: { studyBlockId: { in: [hybridBlock.id, blockDefault.id] } } });

  if (logCount !== 0 || itemCount !== 0) {
    throw new Error("Erro: Logs ou itens de cronograma indesejados foram criados!");
  }

  console.log("=== Todos os testes de integridade da migration híbrida PASSARAM! ===");
}

runTests()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("❌ Erro na execução dos testes de integridade:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
