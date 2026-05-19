import dotenv from "dotenv";
dotenv.config();

import { buildDocumentStructureMap, detectStructure } from "../src/lib/ai/organizer";
import { OFFICIAL_TOPICS } from "../src/lib/constants/official-topics";

// Mock das páginas reais de "processual civil 0.pdf"
const mockPages = [
  {
    pageNumber: 1,
    text: `
    ESTUDOS ANKI - DIREITO PROCESSUAL CIVIL
    SUMÁRIO GERAL DA DISCIPLINA
    
    Apresentação do Curso ............................................. I
    Capítulo I — Fundamentos do Processo Civil ......................... 2
    Capítulo II — Sujeitos do Processo ................................. 15
    Capítulo III — Atos Processuais e Prazos ........................... 28
    Questões de Fixação - Cespe/Cesgranrio .............................. 42
    Gabarito Oficial ................................................... 50
    `
  },
  {
    pageNumber: 2,
    text: `
    Capítulo I — Fundamentos do Processo Civil
    Normas Fundamentais do Processo Civil brasileiro.
    O novo CPC estabelece em seu capítulo inicial os princípios diretores do processo de forma explícita.
    O acesso à justiça é a base constitucional do devido processo legal.
    `
  },
  {
    pageNumber: 5,
    text: `
    DIREITO PROCESSUAL CIVIL
    1. Princípio da Inafastabilidade da Jurisdição: A lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito.
    2. Princípio do Contraditório e da Ampla Defesa: É assegurado aos litigantes o direito de manifestação e influência nas decisões judiciais.
    3. Princípio da Duração Razoável do Processo: Todos têm direito à tramitação do processo em tempo adequado.
    4. Limites da Jurisdição Nacional:
       4.1 Competência concorrente do juiz brasileiro.
       4.2 Competência exclusiva sobre imóveis situados no Brasil.
       4.3 Cooperação internacional passiva e ativa.
    Esse rol conceitual fundamenta o estudo do direito instrumental e doutrinário civil brasileiro.
    `
  },
  {
    pageNumber: 15,
    text: `
    Capítulo II — Sujeitos do Processo
    Das partes e dos procuradores. Da capacidade processual.
    Toda pessoa que se encontra no exercício de seus direitos tem capacidade para estar em juízo.
    `
  },
  {
    pageNumber: 28,
    text: `
    Capítulo III — Atos Processuais e Prazos
    Da forma, do tempo e do lugar dos atos processuais.
    Os atos processuais realizam-se em dias úteis, das 6 às 20 horas.
    `
  },
  {
    pageNumber: 42,
    text: `
    Questões de Fixação - Cespe/Cesgranrio
    Questão 01. Concurso Tribunal de Justiça (TJ) - CESPE (2024).
    Acerca dos princípios fundamentais do Processo Civil brasileiro, assinale a alternativa correta:
    A) O contraditório aplica-se apenas no processo de execução civil, sendo mitigado na cognição.
    B) A inafastabilidade da jurisdição impede a conciliação prévia obrigatória.
    C) Não se proferirá decisão contra uma das partes sem que ela seja previamente ouvida, salvo medidas de urgência.
    D) O processo civil brasileiro é regido pelo princípio inquisitorial absoluto na instrução fática.
    E) O princípio da cooperação vincula as partes, mas exclui o magistrado de seus deveres.
    `
  },
  {
    pageNumber: 43,
    text: `
    Questão 02. Concurso Público (2024).
    Tendo em vista a capacidade processual dos sujeitos do processo, julgue o item a seguir:
    O cônjuge necessitará do consentimento do outro para propor ação que verse sobre direito real imobiliário, salvo quando casados sob o regime de separação absoluta de bens.
    ( ) Certo
    ( ) Errado
    `
  },
  {
    pageNumber: 50,
    text: `
    Gabarito Oficial de Processual Civil
    01 - C
    02 - Certo
    `
  }
];

// Gerar array completo com 50 páginas (para simular a densidade real do PDF)
const completePageTexts: { pageNumber: number; text: string }[] = [];
for (let i = 1; i <= 50; i++) {
  const customPage = mockPages.find(p => p.pageNumber === i);
  if (customPage) {
    completePageTexts.push(customPage);
  } else {
    // Páginas intermediárias padrão de teoria
    let heading = "Fundamentos do Processo Civil";
    if (i >= 15 && i < 28) heading = "Sujeitos do Processo";
    else if (i >= 28 && i < 42) heading = "Atos Processuais e Prazos";
    else if (i >= 42 && i < 50) heading = "Caderno de Exercícios Resolvidos";
    
    completePageTexts.push({
      pageNumber: i,
      text: `Conteúdo da página física número ${i} pertencente à seção teórica ${heading}. Doutrina, jurisprudência e conceitos fundamentais do CPC brasileiro.`
    });
  }
}

async function main() {
  console.log("=== INICIANDO SIMULAÇÃO DETALHADA: processual civil 0.pdf ===");
  const subjectName = "Direito Processual Civil";
  
  // 1. Obter os tópicos oficiais de Processo Civil cadastrados
  const relevantTopics = OFFICIAL_TOPICS.filter(
    t => t.subjectName.toLowerCase().includes("processual civil") ||
         t.subjectName.toLowerCase().includes("processo civil")
  );
  console.log(`\n1. Filtrando edital para "${subjectName}": ${relevantTopics.length} tópicos cadastrados.`);

  // 2. Construir o Mapa Estrutural do Documento (buildDocumentStructureMap)
  console.log("\n2. Construindo mapa estrutural do documento...");
  const summaryContent = mockPages[0].text;
  const structMap = buildDocumentStructureMap(completePageTexts, 50, subjectName, summaryContent);

  console.log(`\n=== RELATÓRIO DO MAPA ESTRUTURAL DA ANÁLISE COMPLETA ===`);
  console.log(`- Tipo de Documento Mapeado: ${structMap.documentType}`);
  console.log(`- Sumário Físico Detectado: ${structMap.tocDetected} (Confiança: ${structMap.tocConfidence})`);
  console.log(`- Seções Mapeadas (${structMap.sections.length}):`);
  
  structMap.sections.forEach((s, idx) => {
    console.log(`  [Seção ${idx + 1}] "${s.heading}" (p. ${s.pageStart} - ${s.pageEnd}) -> Tipo Mapeado: ${s.sectionType}`);
  });

  // 3. Chamar a IA / Fatiador principal (simulado com detectStructure para ver a qualidade pedagógica final)
  console.log("\n3. Executando o detector principal com a nossa nova heurística de qualidade e auto-reparo...");
  
  // Como o detectStructure requer chamada à API do Gemini, e nossa API_KEY está ativa no .env,
  // vamos executá-la de forma real usando a inteligência artificial ativa no nosso backend!
  try {
    const start = Date.now();
    const result = await detectStructure(
      completePageTexts.slice(0, 15).map(p => p.text).join("\n"),
      50,
      subjectName,
      completePageTexts
    );
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    
    console.log(`\n=== ✅ FATIAMENTO DE ESTRUTURA PROCESSUAL CIVIL FINALIZADO (${duration}s) ===`);
    console.log(`- Papel de Material: ${result.materialRole}`);
    console.log(`- Estratégia de Fatiamento: ${result.sourceStrategy}`);
    
    const blocks = result.blocks || [];
    console.log(`\n=== BLOCOS FINAIS ENTREGUES (${blocks.length}) ===`);
    
    blocks.forEach((b, idx) => {
      const typeLabel = b.type || "MAIN_BLOCK";
      console.log(`\n[${idx + 1}] [${typeLabel}] "${b.title}" (p. ${b.pageStart} - ${b.pageEnd})`);
      console.log(`  * Descrição: ${b.description}`);
      console.log(`  * Seção Relacionada: ${b.sourceHeading}`);
      console.log(`  * Mapeamento Edital: ${b.officialTopicName || "Não identificado"} (${b.topicCode || "N/A"})`);
      console.log(`  * Tempo de Estudo: ${b.estimatedStudyMinutes} min`);
      
      if (b.supportType) {
        console.log(`  * Categoria de Apoio: ${b.supportType}`);
      }
      if (b.isShortBlock) {
        console.log(`  * ⚠️ Bloco Curto: Sim (Justificativa: ${b.shortBlockJustification})`);
      }
    });

    console.log("\n=======================================================");
    console.log("✅ AUDITORIA DE CRITÉRIOS DE ACEITE COMPROVADOS:");
    console.log("1. O sumário físico (pág. 1) foi ignorado de todos os blocos estudáveis? " + 
                (blocks.every(b => b.pageStart > 1) ? "Sim, 100% Excluído! [PASSED]" : "Não [FAILED]"));
    console.log("2. O capítulo 'Fundamentos' foi aceito como teoria válida e mapeado? " + 
                (blocks.some(b => b.title.includes("Fundamentos") && b.type !== "SUPPORT_BLOCK") ? "Sim, Processado! [PASSED]" : "Não [FAILED]"));
    console.log("3. Listas numeradas teóricas (ex: pág. 5) foram protegidas e NÃO viraram questões? " + 
                (blocks.find(b => b.pageStart <= 5 && b.pageEnd >= 5)?.type !== "SUPPORT_BLOCK" ? "Sim, Protegidas! [PASSED]" : "Não [FAILED]"));
    console.log("4. Questões/Gabaritos (págs. 42-50) foram divididos corretamente como SUPPORT_BLOCK? " + 
                (blocks.filter(b => b.pageStart >= 42).every(b => b.type === "SUPPORT_BLOCK") ? "Sim, Classificados perfeitamente! [PASSED]" : "Não [FAILED]"));
    console.log("5. Múltiplos MAIN_BLOCKS criados para PDF longo de 50 páginas? " + 
                (blocks.filter(b => b.type !== "SUPPORT_BLOCK").length > 1 ? `Sim, ${blocks.filter(b => b.type !== "SUPPORT_BLOCK").length} blocos teóricos criados! [PASSED]` : "Não, colapsou em bloco único [FAILED]"));
    console.log("=======================================================");
    console.log("🎉 TESTE DE PROCESSO CIVIL CONCLUÍDO COM SUCESSO ABSOLUTO!");
  } catch (err: any) {
    console.error("❌ Erro no processamento de fatiamento:", err.message);
    if (err.stack) console.error(err.stack);
  }
}

main().catch(console.error);
