import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gabriela = await prisma.user.findUnique({
    where: { email: "gabriela.furtado.p@gmail.com" },
  });

  if (!gabriela) {
    console.error("Gabriela (gabriela.furtado.p@gmail.com) não foi encontrada no banco.");
    process.exit(1);
  }

  const userId = gabriela.id;
  const weight2SubjectNames = [
    "Direito Constitucional",
    "Direito Processual do Trabalho",
    "Direito do Trabalho",
    "Direito Processual Civil",
    "Direito Administrativo",
  ];

  console.log("=======================================================================================");
  console.log(" AUDITORIA DE MAPEAMENTO BLOCO → TÓPICO (H3 - PARTE B)");
  console.log(" User: Gabriela Furtado (gabriela.furtado.p@gmail.com)");
  console.log("=======================================================================================\n");

  // 1. Distribuição de Confiança nas 5 Matérias de Peso 2
  const weight2Subjects = await prisma.studySubject.findMany({
    where: { userId, name: { in: weight2SubjectNames } },
  });
  const weight2SubjectIds = weight2Subjects.map((s) => s.id);

  const blocksWeight2 = await prisma.studyBlock.findMany({
    where: { userId, subjectId: { in: weight2SubjectIds } },
    include: { material: true, subject: true },
  });

  let confHigh = 0; // > 0.8
  let confMed = 0; // 0.5 - 0.8
  let confLow = 0; // < 0.5
  let confNull = 0; // null

  const lowConfidenceBlocks: typeof blocksWeight2 = [];

  for (const b of blocksWeight2) {
    const conf = b.confidence;
    if (conf === null || conf === undefined) {
      confNull++;
      lowConfidenceBlocks.push(b);
    } else if (conf > 0.8) {
      confHigh++;
    } else if (conf >= 0.5) {
      confMed++;
      if (conf < 0.7) lowConfidenceBlocks.push(b);
    } else {
      confLow++;
      lowConfidenceBlocks.push(b);
    }
  }

  console.log("--- 1. DISTRIBUIÇÃO DE CONFIANÇA DE MAPEAMENTO (PESO 2) ---");
  console.log("  ⚠️ NOTA: Os valores de confidence no banco refletem a fórmula LEGADA da ingestão original.");
  console.log("  O novo limiar de 0.7 (normalizado pelo novo findBestOfficialTopic) será aplicado apenas a remapeamentos/novas ingestões.\n");
  console.log(` - Alta Confiança (> 0.8):       ${confHigh} blocos`);
  console.log(` - Média Confiança (0.5 - 0.8):  ${confMed} blocos`);
  console.log(` - Baixa Confiança (< 0.5):      ${confLow} blocos`);
  console.log(` - Sem Confiança (null/legacy):  ${confNull} blocos`);
  console.log(` - TOTAL COM CONFIANÇA < 0.7:    ${lowConfidenceBlocks.length} blocos\n`);

  // 2. Listagem dos Blocos com Confiança < 0.7
  console.log("--- 2. BLOCOS COM CONFIANÇA < 0.7 QUE REQUEREM REVISÃO ---");
  if (lowConfidenceBlocks.length === 0) {
    console.log(" (Nenhum bloco encontrado com confiança < 0.7)\n");
  } else {
    for (const b of lowConfidenceBlocks) {
      console.log(
        ` [${b.subject.name}] ${b.title} | PDF: ${b.material?.fileName || "N/A"} (p.${b.pageStart}-${b.pageEnd}) | Tópico: ${b.officialTopicName || "NULO"} | Conf: ${b.confidence ?? "NULL"}`
      );
    }
    console.log("");
  }

  // 3. Materiais com Tópicos Espalhados (Fragmentados)
  console.log("--- 3. DISPERSÃO DE TÓPICOS POR MATERIAL (PDFs ESPALHADOS POR ≥3 TÓPICOS) ---");
  const materials = await prisma.studyMaterial.findMany({
    where: { userId },
    include: { studyBlocks: true },
  });

  for (const mat of materials) {
    const distinctTopics = Array.from(
      new Set(mat.studyBlocks.map((b) => b.officialTopicName).filter(Boolean))
    );

    if (distinctTopics.length >= 3) {
      console.log(
        ` ⚠️ PDF Espalhado: ${mat.fileName} (${mat.studyBlocks.length} blocos em ${distinctTopics.length} tópicos distintos)`
      );
      console.log(`    Tópicos: ${distinctTopics.slice(0, 5).join(" | ")}${distinctTopics.length > 5 ? "..." : ""}`);
    }
  }
  console.log("");

  // 4. Verificação dos 4 Mapeamentos Suspeitos Conhecidos
  console.log("--- 4. AUDITORIA DOS 4 MAPEAMENTOS SUSPEITOS CONHECIDOS ---");
  
  // Mapeamento 1: Intervenção Federal
  const b1 = blocksWeight2.find((b) => b.material?.fileName.toLowerCase().includes("constitucional 7") || b.title.toLowerCase().includes("intervencao"));
  console.log(` [1/4] Intervenção Federal: ${b1 ? `Encontrado em '${b1.officialTopicName}' (PDF: ${b1.material?.fileName}, p.${b1.pageStart}-${b1.pageEnd})` : "NÃO LOCALIZADO DIRETAMENTE"}`);

  // Mapeamento 2: Inafastabilidade
  const b2 = blocksWeight2.find((b) => b.material?.fileName.toLowerCase().includes("constitucional 3") || b.title.toLowerCase().includes("inafastabilidade"));
  console.log(` [2/4] Inafastabilidade da Jurisdição: ${b2 ? `Encontrado em '${b2.officialTopicName}' (PDF: ${b2.material?.fileName}, p.${b2.pageStart}-${b2.pageEnd})` : "NÃO LOCALIZADO DIRETAMENTE"}`);

  // Mapeamento 3: IRDR
  const b3 = blocksWeight2.find((b) => b.material?.fileName.toLowerCase().includes("processual civil 12") || b.title.toLowerCase().includes("irdr"));
  console.log(` [3/4] IRDR: ${b3 ? `Encontrado em '${b3.officialTopicName}' (PDF: ${b3.material?.fileName}, p.${b3.pageStart}-${b3.pageEnd})` : "NÃO LOCALIZADO DIRETAMENTE"}`);

  // Mapeamento 4: processual civil 18.pdf
  const b4 = materials.find((m) => m.fileName.toLowerCase().includes("processual civil 18"));
  console.log(` [4/4] processual civil 18.pdf: ${b4 ? `Pertence à matéria ID ${b4.subjectId} com ${b4.studyBlocks.length} blocos` : "NÃO LOCALIZADO DIRETAMENTE"}\n`);

  // 5. Materiais Órfãos e Cobertura de Páginas
  console.log("--- 5. MATERIAIS ÓRFÃOS E STATUS DE INGESTÃO ---");
  const orphanMaterials = materials.filter(
    (m) => m.studyBlocks.length === 0 || ["UPLOADED", "EXTRACTING", "ANALYZING"].includes(m.organizationStatus)
  );

  console.log(` Total de Materiais Sem Blocos ou Parados em Ingestão: ${orphanMaterials.length}`);
  for (const om of orphanMaterials) {
    console.log(`  - ${om.fileName} | Status: ${om.organizationStatus} | Role: ${om.materialRole} | Provider: ${om.provider}`);
  }

  const totalExtractedPages = await prisma.extractedContent.count({ where: { userId } });
  console.log(` Total de Páginas de Conteúdo Extraído (ExtractedContent): ${totalExtractedPages}`);
  console.log("=======================================================================================");
}

main()
  .catch((e) => {
    console.error("Erro na auditoria:", e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
