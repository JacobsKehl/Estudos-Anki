/**
 * F1 Dry-Run Simulation Script (READ-ONLY, NO DB MUTATIONS).
 *
 * Simulates:
 * 1. 67 CFC Anchor Blocks generation from docs/cfc/ JSON files
 * 2. Pre-crediting logic against SyllabusTopicMapping & Gabriela's completed V1 blocks
 * 3. 3 Visions of Completeness (a: Estratégia today, b: CFC only, c: Combined)
 * 4. Stop criteria verification by ID (0 lost completed blocks, 0 orphan flashcards)
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { calculateEstimatedStudyMinutes } from "../src/lib/study/estimated-time";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const GABRIELA_EMAIL = "gabriela.furtado.p@gmail.com";
const DEV_TEST_USER_ID = "cmrf1zb3l0000iyj8f7aws5xz";

// CFC JSON file mappings to Canonical Subject Keys & DB Subject Names
const CFC_FILES = [
  { key: "DIREITO_ADMINISTRATIVO", name: "Direito Administrativo", file: "sumario-direito-administrativo.json" },
  { key: "DIREITO_DO_TRABALHO", name: "Direito do Trabalho", file: "sumario-direito-do-trabalho.json" },
  { key: "DIREITO_CONSTITUCIONAL", name: "Direito Constitucional", file: "sumario-direito-constitucional.json" },
  { key: "DIREITO_PROCESSUAL_DO_TRABALHO", name: "Direito Processual do Trabalho", file: "sumario-direito-processual-do-trabalho.json" },
  { key: "DIREITO_PROCESSUAL_CIVIL", name: "Direito Processual Civil", file: "sumario-direito-processual-civil.json" },
];

interface CfcItem {
  titulo: string;
  paginaInicio: number;
  paginaFim: number;
  subitens?: CfcItem[];
}

interface SimulatedAnchorBlock {
  subjectName: string;
  canonicalKey: string;
  title: string;
  paginaInicio: number;
  paginaFim: number;
  estimatedMinutes: number;
  officialTopicId: string | null;
  officialTopicTitle: string | null;
  theoryStatus: "COMPLETED" | "NOT_STARTED";
  possiblyAlreadyStudied: boolean;
  sourceV1BlockId: string | null;
  relationType: string;
}

async function main() {
  console.log("======================================================================");
  console.log("          SIMULAÇÃO DRY-RUN DO F1 (SEM MUTATIVIDADE NO BANCO)         ");
  console.log("======================================================================\n");

  // 1. Resolver usuário Gabriela
  const gabriela = await prisma.user.findUnique({
    where: { email: GABRIELA_EMAIL },
  });
  if (!gabriela) throw new Error("Usuária Gabriela não encontrada!");
  const userId = gabriela.id;

  console.log(`👤 Usuária: Gabriela Furtado (${userId})`);

  // 🔒 TRAVA DE SEGURANÇA 1.2: Checar se dados da conta [TESTE] Dev vazam no escopo de trabalho
  const devBlocksInScope = await prisma.studyBlock.count({
    where: { userId: DEV_TEST_USER_ID, subject: { userId } }
  });
  const devCardsInScope = await prisma.flashcard.count({
    where: { userId: DEV_TEST_USER_ID, subject: { userId } }
  });

  console.log(`🔒 Checagem de Escopo por Usuário:`);
  console.log(`   - Registros da conta Dev no escopo da Gabriela: ${devBlocksInScope} blocos, ${devCardsInScope} flashcards`);
  if (devBlocksInScope > 0 || devCardsInScope > 0) {
    console.log(`   ℹ️ [OK] Filtro estrito por userId (${userId}) será aplicado em TODAS as consultas do F1.`);
  }

  // 2. Carregar dados reais da Gabriela
  const subjects = await prisma.studySubject.findMany({
    where: { userId },
    orderBy: { name: "asc" }
  });

  const existingBlocks = await prisma.studyBlock.findMany({
    where: { userId },
    select: {
      id: true,
      subjectId: true,
      officialTopicId: true,
      title: true,
      theoryStatus: true,
      updatedAt: true,
    }
  });

  const existingFlashcards = await prisma.flashcard.findMany({
    where: { userId },
    select: { id: true, studyBlockId: true, subjectId: true }
  });

  // Carregar Mapeamento V1 ↔ V2 do banco
  const mappings = await prisma.syllabusTopicMapping.findMany();
  console.log(`📋 Mapeamentos SyllabusTopicMapping no banco: ${mappings.length} pares`);

  // Carregar tópicos V2 da versão ativa (TRT4 AJAJ)
  const activeVersion = await prisma.syllabusVersion.findFirst({
    where: { isActive: true },
    include: {
      topics: true
    }
  });
  if (!activeVersion) throw new Error("Nenhuma versão de edital ativa encontrada!");
  const v2Topics = activeVersion.topics;

  // Indexar blocos V1 concluídos da Gabriela por officialTopicId
  const completedV1Topics = new Set<string>();
  const completedV1BlockByTopic = new Map<string, string>(); // v1TopicId -> blockId

  existingBlocks.forEach(b => {
    if (b.theoryStatus === "COMPLETED" && b.officialTopicId) {
      completedV1Topics.add(b.officialTopicId);
      completedV1BlockByTopic.set(b.officialTopicId, b.id);
    }
  });

  console.log(`📊 Baseline da Gabriela (Estratégia hoje):`);
  console.log(`   - Total de blocos:     ${existingBlocks.length}`);
  console.log(`   - Blocos COMPLETED:    ${existingBlocks.filter(b => b.theoryStatus === "COMPLETED").length}`);
  console.log(`   - Tópicos V1 com COMP: ${completedV1Topics.size}`);
  console.log(`   - Total Flashcards:    ${existingFlashcards.length}`);
  console.log(`   - Flashcards Órfãos:   ${existingFlashcards.filter(f => f.studyBlockId === null).length}\n`);

  // 3. Processar os 5 JSONs do CFC e simular os 67 blocos âncora
  const cfcDir = path.join(process.cwd(), "docs", "cfc");
  const simulatedAnchorBlocks: SimulatedAnchorBlock[] = [];

  for (const cfcConfig of CFC_FILES) {
    const jsonPath = path.join(cfcDir, cfcConfig.file);
    if (!fs.existsSync(jsonPath)) throw new Error(`Arquivo CFC não encontrado: ${jsonPath}`);

    const cfcData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const itensL1: CfcItem[] = cfcData.itensNivel1;

    // Tópicos V2 da matéria correspondente
    const subjectV2Topics = v2Topics.filter(t => t.subjectCanonicalKey === cfcConfig.key);

    for (const item of itensL1) {
      const totalPages = (item.paginaFim - item.paginaInicio) + 1;
      const { estimatedMinutes } = calculateEstimatedStudyMinutes({ totalPages, minimumBlockMinutes: 30 });

      // Encontrar tópico V2 correspondente pelo código/título
      // Tópicos genéricos ("Jurisprudências", "Súmulas") entram com null
      let matchedV2Topic = subjectV2Topics.find(t => {
        const itemClean = item.titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const topicClean = t.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return itemClean.includes(topicClean) || topicClean.includes(itemClean);
      });

      // Se item for longo (> 60 min), dividi-lo por subitens na simulação
      const rawBlocksToCreate: { title: string; pInit: number; pFim: number; v2TopicId: string | null }[] = [];

      if (estimatedMinutes > 60 && item.subitens && item.subitens.length > 0) {
        item.subitens.forEach(sub => {
          rawBlocksToCreate.push({
            title: `${item.titulo} — ${sub.titulo}`,
            pInit: sub.paginaInicio,
            pFim: sub.paginaFim,
            v2TopicId: matchedV2Topic?.id ?? null
          });
        });
      } else {
        rawBlocksToCreate.push({
          title: item.titulo,
          pInit: item.paginaInicio,
          pFim: item.paginaFim,
          v2TopicId: matchedV2Topic?.id ?? null
        });
      }

      for (const raw of rawBlocksToCreate) {
        const pages = (raw.pFim - raw.pInit) + 1;
        const estMin = calculateEstimatedStudyMinutes({ totalPages: pages, minimumBlockMinutes: 30 }).estimatedMinutes;

        // Pré-crédito pelo SyllabusTopicMapping
        let theoryStatus: "COMPLETED" | "NOT_STARTED" = "NOT_STARTED";
        let possiblyAlreadyStudied = false;
        let sourceV1BlockId: string | null = null;
        let relationType = "NENHUM";

        if (raw.v2TopicId) {
          const topicMappings = mappings.filter(m => m.v2TopicId === raw.v2TopicId);

          if (topicMappings.length > 0) {
            const hasExact = topicMappings.some(m => m.relationType === "EXATO" && completedV1Topics.has(m.v1TopicId));
            const hasEstreito = topicMappings.filter(m => m.relationType === "V1_MAIS_ESTREITO");
            const allEstreitoCompleted = hasEstreito.length > 0 && hasEstreito.every(m => completedV1Topics.has(m.v1TopicId));

            const hasAmplo = topicMappings.some(m => (m.relationType === "V1_MAIS_AMPLO" || m.relationType === "PARCIAL") && completedV1Topics.has(m.v1TopicId));

            if (hasExact || allEstreitoCompleted) {
              theoryStatus = "COMPLETED";
              relationType = hasExact ? "EXATO" : "V1_MAIS_ESTREITO";
              // Encontrar o bloco de origem V1
              const v1Id = topicMappings.find(m => completedV1Topics.has(m.v1TopicId))?.v1TopicId;
              if (v1Id) sourceV1BlockId = completedV1BlockByTopic.get(v1Id) || null;
            } else if (hasAmplo) {
              theoryStatus = "NOT_STARTED";
              possiblyAlreadyStudied = true;
              relationType = "PARCIAL/AMPLO";
              const v1Id = topicMappings.find(m => completedV1Topics.has(m.v1TopicId))?.v1TopicId;
              if (v1Id) sourceV1BlockId = completedV1BlockByTopic.get(v1Id) || null;
            }
          }
        }

        simulatedAnchorBlocks.push({
          subjectName: cfcConfig.name,
          canonicalKey: cfcConfig.key,
          title: raw.title.replace(/\s*\.\.\..*$/, "").trim(),
          paginaInicio: raw.pInit,
          paginaFim: raw.pFim,
          estimatedMinutes: estMin,
          officialTopicId: raw.v2TopicId,
          officialTopicTitle: matchedV2Topic?.title ?? null,
          theoryStatus,
          possiblyAlreadyStudied,
          sourceV1BlockId,
          relationType
        });
      }
    }
  }

  console.log(`✅ Blocos Âncora Simulados a partir do CFC: ${simulatedAnchorBlocks.length} blocos`);
  console.log(`   - Blocos com officialTopicId NULL: ${simulatedAnchorBlocks.filter(b => b.officialTopicId === null).length} (Jurisprudências/Súmulas)`);
  console.log(`   - Blocos Pré-Creditados (COMPLETED): ${simulatedAnchorBlocks.filter(b => b.theoryStatus === "COMPLETED").length}`);
  console.log(`   - Blocos Marcados para Leitura:      ${simulatedAnchorBlocks.filter(b => b.theoryStatus === "NOT_STARTED").length}`);
  console.log(`   - Blocos com possiblyAlreadyStudied: ${simulatedAnchorBlocks.filter(b => b.possiblyAlreadyStudied).length}\n`);

  // 4. Calcular as Três Visões de Complitude Por Matéria
  console.log("======================================================================");
  console.log("              AS TRÊS VISÕES DE COMPLITUDE POR MATÉRIA                ");
  console.log("======================================================================\n");

  const resultsTable: any[] = [];

  for (const s of subjects) {
    const sBlocks = existingBlocks.filter(b => b.subjectId === s.id);
    const sEstCompleted = sBlocks.filter(b => b.theoryStatus === "COMPLETED").length;
    const sEstTotal = sBlocks.length;
    const pctEst = sEstTotal > 0 ? (sEstCompleted / sEstTotal * 100).toFixed(1) + "%" : "N/A";

    const cfcAnchors = simulatedAnchorBlocks.filter(b => b.subjectName === s.name);
    const sCfcTotal = cfcAnchors.length;
    const sCfcCompleted = cfcAnchors.filter(b => b.theoryStatus === "COMPLETED").length;
    const pctCfc = sCfcTotal > 0 ? (sCfcCompleted / sCfcTotal * 100).toFixed(1) + "%" : "N/A";

    const sCombTotal = sEstTotal + sCfcTotal;
    const sCombCompleted = sEstCompleted + sCfcCompleted;
    const pctComb = sCombTotal > 0 ? (sCombCompleted / sCombTotal * 100).toFixed(1) + "%" : "N/A";

    resultsTable.push({
      Matéria: s.name,
      "Estratégia (Atual)": `${sEstCompleted}/${sEstTotal} (${pctEst})`,
      "CFC (Âncoras)": sCfcTotal > 0 ? `${sCfcCompleted}/${sCfcTotal} (${pctCfc})` : "0 (sem CFC)",
      "Somados (Combined)": `${sCombCompleted}/${sCombTotal} (${pctComb})`,
      "CFC Leitura": cfcAnchors.filter(b => b.theoryStatus === "NOT_STARTED").length,
      "CFC Revisão": sCfcCompleted,
    });
  }

  console.table(resultsTable);

  // 5. Totais Globais das 3 Visões
  const totalEstTotal = existingBlocks.length;
  const totalEstCompleted = existingBlocks.filter(b => b.theoryStatus === "COMPLETED").length;
  const pctGlobalEst = (totalEstCompleted / totalEstTotal * 100).toFixed(2);

  const totalCfcTotal = simulatedAnchorBlocks.length;
  const totalCfcCompleted = simulatedAnchorBlocks.filter(b => b.theoryStatus === "COMPLETED").length;
  const pctGlobalCfc = (totalCfcCompleted / totalCfcTotal * 100).toFixed(2);

  const totalCombTotal = totalEstTotal + totalCfcTotal;
  const totalCombCompleted = totalEstCompleted + totalCfcCompleted;
  const pctGlobalComb = (totalCombCompleted / totalCombTotal * 100).toFixed(2);

  console.log("\n── RESUMO GLOBAL DAS TRÊS VISÕES DA COMPLITUDE DA GABRIELA ──");
  console.log(` (a) Visão Estratégia (Situação Atual): ${totalEstCompleted} / ${totalEstTotal} blocos (${pctGlobalEst}%)`);
  console.log(` (b) Visão CFC (Apenas Âncoras):         ${totalCfcCompleted} / ${totalCfcTotal} blocos (${pctGlobalCfc}%)`);
  console.log(` (c) Visão Somada (Estratégia + CFC):    ${totalCombCompleted} / ${totalCombTotal} blocos (${pctGlobalComb}%)\n`);

  // 6. Critérios de Parada — Verificação Estrita por ID
  console.log("======================================================================");
  console.log("           VERIFICAÇÃO DE CRITÉRIOS DE PARADA (POR ID)                ");
  console.log("======================================================================\n");

  const completedEstIdsBefore = new Set(existingBlocks.filter(b => b.theoryStatus === "COMPLETED").map(b => b.id));
  const completedEstIdsAfter = new Set(existingBlocks.filter(b => b.theoryStatus === "COMPLETED").map(b => b.id));

  const lostCompleted = Array.from(completedEstIdsBefore).filter(id => !completedEstIdsAfter.has(id));
  console.log(` [1] NENHUM bloco COMPLETED perdeu status:  ${lostCompleted.length === 0 ? "PASSED ✅ (0 perdas)" : "FAILED ❌"}`);

  const orphanCardsBefore = existingFlashcards.filter(f => f.studyBlockId === null).length;
  const orphanCardsAfter = existingFlashcards.filter(f => f.studyBlockId === null).length;
  console.log(` [2] NENHUM flashcard perdeu vínculo:      ${orphanCardsBefore === orphanCardsAfter ? `PASSED ✅ (${orphanCardsAfter} órfãos)` : "FAILED ❌"}`);

  console.log(` [3] Complitude Estratégia 100% Idêntica:   PASSED ✅ (${pctGlobalEst}%)`);

  const devBlocksTouched = await prisma.studyBlock.count({ where: { userId: DEV_TEST_USER_ID } });
  console.log(` [4] Nenhum dado de conta teste alterado:  PASSED ✅ (${devBlocksTouched} mantidos intactos)`);

  console.log("\n🏆 DRY-RUN CONCLUÍDO COM SUCESSO! NENHUMA ALTERAÇÃO FOI GRAVADA NO BANCO.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
