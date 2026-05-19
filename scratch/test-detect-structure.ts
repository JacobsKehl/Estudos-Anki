import dotenv from "dotenv";
dotenv.config();

import { detectStructure } from "../src/lib/ai/organizer";

async function main() {
  console.log("=== INICIANDO TESTE DO PIPELINE DE AUTO-REPARO E DETECTSTRUCTURE ===");
  console.log("GEMINI_API_KEY present:", Boolean(process.env.GEMINI_API_KEY));

  const subjectName = "Direito Administrativo";
  const totalPages = 50;

  // 1. Mock do texto de sumário / páginas iniciais
  const summaryContent = `
  SUMÁRIO
  Capítulo I: Princípios da Administração Pública ....... 1
  Capítulo II: Atos Administrativos ......... 11
  Capítulo III: Organização Administrativa ........ 21
  Capítulo IV: Processo Administrativo .......... 36
  Questões de Fixação .......... 45
  Gabarito .......... 50
  `;

  // 2. Mock de todas as 50 páginas com conteúdo adequado para passar nas heurísticas
  const pageTexts: { pageNumber: number; text: string }[] = [];
  for (let p = 1; p <= 50; p++) {
    let text = `Esta é a página ${p} de material de estudo de Direito Administrativo. `;
    if (p >= 1 && p <= 10) {
      text += `Princípio da Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência (LIMPE). Conceito e definição da administração direta e indireta.`;
    } else if (p >= 11 && p <= 20) {
      text += `Requisitos do Ato Administrativo: competência, finalidade, forma, motivo e objeto. Presunção de legitimidade e imperatividade dos atos.`;
    } else if (p >= 21 && p <= 35) {
      text += `Organização administrativa: descentralização, autarquias, fundações, empresas públicas e sociedades de economia mistas federais.`;
    } else if (p >= 36 && p <= 44) {
      text += `Processo Administrativo Federal sob a égide da Lei nº 9.784/99. Regras de competência, impedimentos e suspeições de autoridades públicas.`;
    } else if (p >= 45 && p <= 49) {
      text += `Questão 1. Assinale a alternativa correta sobre atos administrativos:\nA) São bilaterais.\nB) Presumem-se ilegítimos.\nC) A forma é sempre livre.\nD) A competência pode ser delegada.\nQuestão 2. Sobre princípios fundamentais...`;
    } else if (p === 50) {
      text += `GABARITO OFICIAL:\n1. D\n2. C\n3. A\n4. E\nFim do material.`;
    }
    pageTexts.push({ pageNumber: p, text });
  }

  // 3. Chamar detectStructure
  console.log("\nChamando detectStructure com o sumário e páginas mockadas...");
  try {
    const result = await detectStructure(summaryContent, totalPages, subjectName, pageTexts);
    console.log("\n=== RESULTADO FINAL DO PIPELINE DE ORGANIZAÇÃO ===");
    console.log(`Material Role: ${result.materialRole}`);
    console.log(`Estratégia Utilizada: ${result.sourceStrategy}`);
    console.log(`TOC Detectado: ${result.tocDetected} (Confiança: ${result.tocConfidence})`);
    console.log(`Modelo de IA / Rescue Utilizado: ${result.aiModelUsed}`);
    console.log(`Total de blocos gerados: ${result.blocks.length}`);
    
    console.log("\n--- DETALHAMENTO DOS BLOCOS GERADOS ---");
    result.blocks.forEach((b, idx) => {
      console.log(`\n[Bloco ${idx + 1}] "${b.title}"`);
      console.log(`  - Tipo: ${b.type || "MAIN_BLOCK"} (${b.supportType || "N/A"})`);
      console.log(`  - Intervalo de páginas: ${b.pageStart}-${b.pageEnd} (Total: ${b.pageEnd - b.pageStart + 1} pgs)`);
      console.log(`  - Tópico Oficial: [${b.topicCode}] ${b.officialTopicName} (ID: ${b.officialTopicId})`);
      console.log(`  - Estimativa de Tempo: ${b.estimatedStudyMinutes} minutos`);
      console.log(`  - Justificativa / Rationale: ${b.selectionJustification || b.mergeRationale || "N/A"}`);
    });
  } catch (err: any) {
    console.error("\n❌ FALHA CRÍTICA NO PIPELINE:", err.message);
  }
}

main().catch(console.error);
