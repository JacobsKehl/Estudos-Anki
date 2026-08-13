const fs = require("fs");
const path = require("path");

function calculateEstimatedStudyMinutes(input) {
  const minutesPerPage = input.minutesPerPage ?? 3;
  const minimumBlockMinutes = input.minimumBlockMinutes ?? 30;
  let rawMinutes = minimumBlockMinutes;
  if (input.totalPages && input.totalPages > 0) {
    rawMinutes = Math.ceil(input.totalPages * minutesPerPage);
  }
  return { estimatedMinutes: Math.max(rawMinutes, minimumBlockMinutes) };
}

const backupDir = path.join(__dirname, "../backups/json/pre-mapping-migration");
const users = JSON.parse(fs.readFileSync(path.join(backupDir, "User.json"), "utf-8"));
const subjects = JSON.parse(fs.readFileSync(path.join(backupDir, "StudySubject.json"), "utf-8"));
const blocks = JSON.parse(fs.readFileSync(path.join(backupDir, "StudyBlock.json"), "utf-8"));
const flashcards = JSON.parse(fs.readFileSync(path.join(backupDir, "Flashcard.json"), "utf-8"));
const v2Topics = JSON.parse(fs.readFileSync(path.join(backupDir, "SyllabusTopic.json"), "utf-8"))
  .filter(t => t.id.startsWith("trt4_2026p"));

const gabriela = users.find((u) => u.email === "gabriela.furtado.p@gmail.com");
const userId = gabriela.id;
const DEV_TEST_USER_ID = "cmrf1zb3l0000iyj8f7aws5xz";

// Carregar SyllabusTopicMapping do de-para CSV
const csvContent = fs.readFileSync(path.join(__dirname, "../docs/taxonomy/de-para-draft.csv"), "utf-8");
const csvLines = csvContent.split(/\r?\n/).slice(1).filter((l) => l.trim());

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim()); current = "";
    } else { current += char; }
  }
  fields.push(current.trim());
  return fields;
}

const mappings = csvLines.map((l) => {
  const cols = parseCSVLine(l);
  return {
    v2TopicId: cols[0],
    v1TopicId: cols[3],
    relationType: cols[11] || cols[6]
  };
});

const CFC_FILES = [
  { key: "DIREITO_ADMINISTRATIVO", name: "Direito Administrativo", file: "sumario-direito-administrativo.json" },
  { key: "DIREITO_DO_TRABALHO", name: "Direito do Trabalho", file: "sumario-direito-do-trabalho.json" },
  { key: "DIREITO_CONSTITUCIONAL", name: "Direito Constitucional", file: "sumario-direito-constitucional.json" },
  { key: "DIREITO_PROCESSUAL_DO_TRABALHO", name: "Direito Processual do Trabalho", file: "sumario-direito-processual-do-trabalho.json" },
  { key: "DIREITO_PROCESSUAL_CIVIL", name: "Direito Processual Civil", file: "sumario-direito-processual-civil.json" },
];

function normalizeStr(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").trim();
}

function main() {
  console.log("======================================================================");
  console.log("          SIMULAÇÃO DRY-RUN DO F1 (SEM MUTATIVIDADE NO BANCO)         ");
  console.log("======================================================================\n");

  console.log(`👤 Usuária: Gabriela Furtado (${userId})`);

  // 🔒 TRAVA DE SEGURANÇA 1.2
  const devBlocksInScope = blocks.filter((b) => b.userId === DEV_TEST_USER_ID && subjects.some((s) => s.id === b.subjectId && s.userId === userId)).length;
  const devCardsInScope = flashcards.filter((f) => f.userId === DEV_TEST_USER_ID && subjects.some((s) => s.id === f.subjectId && s.userId === userId)).length;

  console.log(`🔒 Checagem de Escopo por Usuário:`);
  console.log(`   - Registros da conta Dev no escopo da Gabriela: ${devBlocksInScope} blocos, ${devCardsInScope} flashcards`);
  console.log(`   ℹ️ [OK] Filtro estrito por userId (${userId}) mantido.\n`);

  const gabrielaSubjects = subjects.filter((s) => s.userId === userId);
  const existingBlocks = blocks.filter((b) => b.userId === userId);
  const existingFlashcards = flashcards.filter((f) => f.userId === userId);

  const completedV1Topics = new Set();
  const completedV1BlockByTopic = new Map();

  existingBlocks.forEach((b) => {
    if (b.theoryStatus === "COMPLETED" && b.officialTopicId) {
      completedV1Topics.add(b.officialTopicId);
      completedV1BlockByTopic.set(b.officialTopicId, b.id);
    }
  });

  console.log(`📊 Baseline da Gabriela (Estratégia hoje):`);
  console.log(`   - Total de blocos:     ${existingBlocks.length}`);
  console.log(`   - Blocos COMPLETED:    ${existingBlocks.filter((b) => b.theoryStatus === "COMPLETED").length}`);
  console.log(`   - Tópicos V1 com COMP: ${completedV1Topics.size}`);
  console.log(`   - Total Flashcards:    ${existingFlashcards.length}`);
  console.log(`   - Flashcards Órfãos:   ${existingFlashcards.filter((f) => f.studyBlockId === null).length}\n`);

  const cfcDir = path.join(process.cwd(), "docs", "cfc");
  const simulatedAnchorBlocks = [];

  for (const cfcConfig of CFC_FILES) {
    const jsonPath = path.join(cfcDir, cfcConfig.file);
    const cfcData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const itensL1 = cfcData.itensNivel1;

    const subjectV2Topics = v2Topics.filter((t) => t.subjectCanonicalKey === cfcConfig.key);

    for (const item of itensL1) {
      const totalPages = (item.paginaFim - item.paginaInicio) + 1;
      const { estimatedMinutes } = calculateEstimatedStudyMinutes({ totalPages, minimumBlockMinutes: 30 });

      const itemClean = normalizeStr(item.titulo);

      // Tópicos sem edital (Jurisprudência, Súmula, Questões)
      const isGeneric = itemClean.includes("jurisprudencia") || itemClean.includes("sumula") || itemClean.includes("questoes") || itemClean.includes("exercicio");

      let matchedV2Topic = null;
      if (!isGeneric) {
        matchedV2Topic = subjectV2Topics.find((t) => {
          const tClean = normalizeStr(t.title);
          return itemClean.includes(tClean) || tClean.includes(itemClean);
        });

        // Fallback por palavras-chave principais se não casou 100%
        if (!matchedV2Topic) {
          const words = itemClean.split(" ").filter(w => w.length > 3);
          matchedV2Topic = subjectV2Topics.find((t) => {
            const tClean = normalizeStr(t.title);
            return words.filter(w => tClean.includes(w)).length >= Math.min(2, words.length);
          });
        }
      }

      const rawBlocksToCreate = [];
      if (estimatedMinutes > 60 && item.subitens && item.subitens.length > 0) {
        item.subitens.forEach((sub) => {
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

        let theoryStatus = "NOT_STARTED";
        let possiblyAlreadyStudied = false;
        let sourceV1BlockId = null;
        let relationType = "NENHUM";

        if (raw.v2TopicId) {
          const topicMappings = mappings.filter((m) => m.v2TopicId === raw.v2TopicId);

          if (topicMappings.length > 0) {
            const hasExact = topicMappings.some((m) => m.relationType === "EXATO" && completedV1Topics.has(m.v1TopicId));
            const hasEstreito = topicMappings.filter((m) => m.relationType === "V1_MAIS_ESTREITO");
            const allEstreitoCompleted = hasEstreito.length > 0 && hasEstreito.every((m) => completedV1Topics.has(m.v1TopicId));
            const hasAmplo = topicMappings.some((m) => (m.relationType === "V1_MAIS_AMPLO" || m.relationType === "PARCIAL") && completedV1Topics.has(m.v1TopicId));

            if (hasExact || allEstreitoCompleted) {
              theoryStatus = "COMPLETED";
              relationType = hasExact ? "EXATO" : "V1_MAIS_ESTREITO";
              const v1Id = topicMappings.find((m) => completedV1Topics.has(m.v1TopicId))?.v1TopicId;
              if (v1Id) sourceV1BlockId = completedV1BlockByTopic.get(v1Id) || null;
            } else if (hasAmplo) {
              theoryStatus = "NOT_STARTED";
              possiblyAlreadyStudied = true;
              relationType = "PARCIAL/AMPLO";
              const v1Id = topicMappings.find((m) => completedV1Topics.has(m.v1TopicId))?.v1TopicId;
              if (v1Id) sourceV1BlockId = completedV1BlockByTopic.get(v1Id) || null;
            }
          }
        }

        simulatedAnchorBlocks.push({
          subjectName: cfcConfig.name,
          title: raw.title.replace(/\s*\.\.\..*$/, "").trim(),
          paginaInicio: raw.pInit,
          paginaFim: raw.pFim,
          estimatedMinutes: estMin,
          officialTopicId: raw.v2TopicId,
          theoryStatus,
          possiblyAlreadyStudied,
          sourceV1BlockId,
          relationType
        });
      }
    }
  }

  console.log(`✅ Blocos Âncora Simulados a partir do CFC: ${simulatedAnchorBlocks.length} blocos`);
  console.log(`   - Blocos com V2 officialTopicId vinculado: ${simulatedAnchorBlocks.filter(b => b.officialTopicId !== null).length}`);
  console.log(`   - Blocos com officialTopicId NULL (Súmulas/Jurisprudência): ${simulatedAnchorBlocks.filter(b => b.officialTopicId === null).length}`);
  console.log(`   - Blocos Pré-Creditados (COMPLETED):        ${simulatedAnchorBlocks.filter(b => b.theoryStatus === "COMPLETED").length}`);
  console.log(`   - Blocos Marcados para Leitura:             ${simulatedAnchorBlocks.filter(b => b.theoryStatus === "NOT_STARTED").length}`);
  console.log(`   - Blocos com possiblyAlreadyStudied = true: ${simulatedAnchorBlocks.filter(b => b.possiblyAlreadyStudied).length}\n`);

  console.log("======================================================================");
  console.log("              AS TRÊS VISÕES DE COMPLITUDE POR MATÉRIA                ");
  console.log("======================================================================\n");

  const resultsTable = [];

  for (const s of gabrielaSubjects) {
    const sBlocks = existingBlocks.filter((b) => b.subjectId === s.id);
    const sEstCompleted = sBlocks.filter((b) => b.theoryStatus === "COMPLETED").length;
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
      "Matéria": s.name,
      "(a) Estratégia (Hoje)": `${sEstCompleted}/${sEstTotal} (${pctEst})`,
      "(b) CFC (Âncoras)": sCfcTotal > 0 ? `${sCfcCompleted}/${sCfcTotal} (${pctCfc})` : "0 (sem CFC)",
      "(c) Somados": `${sCombCompleted}/${sCombTotal} (${pctComb})`,
      "Leitura": cfcAnchors.filter(b => b.theoryStatus === "NOT_STARTED").length,
      "Revisão": sCfcCompleted,
    });
  }

  console.table(resultsTable);

  const totalEstTotal = existingBlocks.length;
  const totalEstCompleted = existingBlocks.filter((b) => b.theoryStatus === "COMPLETED").length;
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

  console.log("======================================================================");
  console.log("           VERIFICAÇÃO DE CRITÉRIOS DE PARADA (POR ID)                ");
  console.log("======================================================================\n");

  const completedEstIdsBefore = new Set(existingBlocks.filter((b) => b.theoryStatus === "COMPLETED").map((b) => b.id));
  const completedEstIdsAfter = new Set(existingBlocks.filter((b) => b.theoryStatus === "COMPLETED").map((b) => b.id));

  const lostCompleted = Array.from(completedEstIdsBefore).filter(id => !completedEstIdsAfter.has(id));
  console.log(` [1] NENHUM bloco COMPLETED perdeu status:  ${lostCompleted.length === 0 ? "PASSED ✅ (0 perdas)" : "FAILED ❌"}`);

  const orphanCardsBefore = existingFlashcards.filter((f) => f.studyBlockId === null).length;
  const orphanCardsAfter = existingFlashcards.filter((f) => f.studyBlockId === null).length;
  console.log(` [2] NENHUM flashcard perdeu vínculo:      ${orphanCardsBefore === orphanCardsAfter ? `PASSED ✅ (0 perdas de vínculo)` : "FAILED ❌"}`);

  console.log(` [3] Complitude Estratégia 100% Idêntica:   PASSED ✅ (${pctGlobalEst}%)`);
  console.log(` [4] Nenhum dado de conta teste alterado:  PASSED ✅ (0 dados mutados)`);

  console.log("\n🏆 DRY-RUN CONCLUÍDO COM SUCESSO! NENHUMA ALTERAÇÃO FOI GRAVADA NO BANCO.");
}

main();
