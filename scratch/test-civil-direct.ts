import { prisma } from "../src/lib/prisma";
import dotenv from "dotenv";
dotenv.config();

import { identifySubject, detectStructure } from "../src/lib/ai/organizer";
import { OFFICIAL_TOPICS } from "../src/lib/constants/official-topics";

async function main() {
  console.log("=== INICIANDO TESTE DIRETO DE DETECÇÃO DE ESTRUTURA ===");
  console.log("Material alvo: processual civil 0.pdf");

  // 1. Encontrar o material de Processual Civil no banco
  const materials = await prisma.studyMaterial.findMany({
    include: {
      extractedContent: {
        orderBy: { pageNumber: "asc" }
      }
    }
  });

  const civilMaterial = materials.find(m => 
    m.fileName.toLowerCase().includes("processual civil 0") ||
    m.fileName.toLowerCase().includes("processual civil") ||
    (m.originalFileName && m.originalFileName.toLowerCase().includes("processual civil"))
  );

  if (!civilMaterial) {
    console.log("❌ ERRO: Nenhum material de Processo Civil encontrado no banco de dados.");
    return;
  }

  console.log(`\nMaterial Selecionado:`);
  console.log(`- ID: ${civilMaterial.id}`);
  console.log(`- Nome: ${civilMaterial.fileName}`);
  console.log(`- Páginas Extraídas: ${civilMaterial.extractedContent.length}`);

  if (civilMaterial.extractedContent.length === 0) {
    console.log("❌ ERRO: O material não possui páginas extraídas para análise.");
    return;
  }

  // 2. Extrair sample para identifySubject
  const sampleText = civilMaterial.extractedContent
    .slice(0, 5)
    .map(p => p.text)
    .join("\n\n");

  console.log("\n--- ETAPA 1: IDENTIFICAR MATÉRIA ---");
  let detectedSubject = "";
  try {
    const subjectResult = await identifySubject(sampleText.substring(0, 3000), civilMaterial.fileName);
    detectedSubject = subjectResult.subjectName;
    console.log("✅ Matéria identificada:", subjectResult);
  } catch (err: any) {
    console.error("❌ Erro no identifySubject:", err.message);
    return;
  }

  // 3. Executar o detectStructure principal
  console.log("\n--- ETAPA 2: DISPARANDO DETECTOR DE ESTRUTURA ---");
  const numPages = civilMaterial.totalPages || civilMaterial.extractedContent.length;
  const fullTextForStructure = civilMaterial.extractedContent
    .slice(0, 15)
    .map(p => p.text)
    .join("\n");

  try {
    const start = Date.now();
    const structResult = await detectStructure(
      fullTextForStructure, 
      numPages, 
      detectedSubject, 
      civilMaterial.extractedContent
    );
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    
    console.log(`\n✅ DETECÇÃO CONCLUÍDA EM ${duration}s!`);
    console.log(`- Papel do Material: ${structResult.materialRole}`);
    console.log(`- Modelo Utilizado: ${structResult.aiModelUsed || "Não especificado"}`);
    console.log(`- Estratégia de Mapeamento: ${structResult.sourceStrategy || "Não especificada"}`);
    console.log(`- Sumário Detectado (TOC): ${structResult.tocDetected} (Confiança: ${structResult.tocConfidence})`);

    const blocks = structResult.blocks || [];
    console.log(`\n=== BLOCO TEMÁTICOS GERADOS (${blocks.length}) ===`);
    
    blocks.forEach((b, idx) => {
      const typeLabel = b.type || "MAIN_BLOCK";
      console.log(`\n[${idx + 1}] [${typeLabel}] "${b.title}" (p. ${b.pageStart} - ${b.pageEnd})`);
      console.log(`  - Descrição: ${b.description}`);
      console.log(`  - Seção do Sumário (Heading): ${b.sourceHeading}`);
      console.log(`  - Mapeamento Tópico Oficial: ${b.officialTopicName || "Não identificado"} (${b.topicCode || "N/A"})`);
      console.log(`  - Tempo Estimado de Estudo: ${b.estimatedStudyMinutes} min`);
      if (b.supportType) {
        console.log(`  - Categoria de Apoio: ${b.supportType}`);
      }
      if (b.isShortBlock) {
        console.log(`  - ⚠️ Bloco Curto: Sim (Justificativa: ${b.shortBlockJustification || "N/A"})`);
      }
    });

    console.log("\n=============================================");
    console.log("✅ TESTE EXECUTADO COM SUCESSO ABSOLUTO!");
  } catch (err: any) {
    console.error("❌ Erro em detectStructure:", err.message);
    if (err.stack) {
      console.error(err.stack);
    }
  }
}

main().catch(console.error);
