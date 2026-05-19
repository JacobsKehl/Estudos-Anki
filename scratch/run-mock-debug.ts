import dotenv from "dotenv";
dotenv.config();

import { identifySubject } from "../src/lib/ai/organizer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildStructurePrompt } from "../src/lib/ai/prompts/organizer";
import { OFFICIAL_TOPICS } from "../src/lib/constants/official-topics";
import { callGeminiWithRetry } from "../src/lib/ai/utils/retry";
import { detectQuestionsOrGabaritoHeuristic } from "../src/lib/ai/organizer";

const mockText = `
DIREITO ADMINISTRATIVO
Capítulo I: Princípios da Administração Pública
1. Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência (LIMPE).
A Administração Pública é regida por princípios expressos e implícitos. O princípio da legalidade determina que o administrador só pode fazer o que a lei autoriza. A impessoalidade veda promoções pessoais.
Páginas 1 a 10.

Capítulo II: Atos Administrativos
1. Conceito e Requisitos do Ato Administrativo (Competência, Finalidade, Forma, Motivo e Objeto).
Atos administrativos são manifestações unilaterais de vontade do Estado. Os requisitos de validade são a competência, finalidade, forma, motivo e objeto.
2. Atributos do Ato Administrativo (Presunção de Legitimidade, Imperatividade, Autoexecutoriedade, Tipicidade).
Páginas 11 a 20.

Capítulo III: Organização Administrativa
1. Administração Direta e Indireta (Autarquias, Fundações Públicas, Empresas Públicas e Sociedades de Economia Mista).
A descentralização administrativa gera as entidades da administração indireta.
Páginas 21 a 35.

Capítulo IV: Processo Administrativo (Lei 9.784/99)
Páginas 36 a 50.
`;

async function main() {
  console.log("=== INICIANDO DEBUG LOCAL MOCKADO ===");
  console.log("GEMINI_API_KEY present:", Boolean(process.env.GEMINI_API_KEY));

  console.log("\n--- PASSO 1: IDENTIFICAR MATÉRIA ---");
  let detectedSubject = "";
  try {
    const subjectResult = await identifySubject(mockText, "direito administrativo 1.pdf");
    detectedSubject = subjectResult.subjectName;
    console.log("Resultado da Identificação de Matéria:", subjectResult);
  } catch (err: any) {
    console.error("Erro no identifySubject:", err.message);
    return;
  }

  // 3. Obter tópicos oficiais
  console.log("\n--- PASSO 2: FILTRAR TÓPICOS OFICIAIS ---");
  const relevantTopics = OFFICIAL_TOPICS.filter(
    t => t.subjectName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
         detectedSubject.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );
  console.log(`Tópicos oficiais para "${detectedSubject}": ${relevantTopics.length}`);

  // 4. Executar detectStructure mas capturando os dados brutos e etapas
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Erro: GEMINI_API_KEY ausente.");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const numPages = 50;
  const officialTopicsListText = relevantTopics.length > 0
    ? relevantTopics.map(t => `- ID: "${t.id}" | Código: "${t.topicCode}" | Título: "${t.title}"`).join("\n")
    : "Esta matéria não possui matriz de tópicos cadastrada. Use officialTopicId = null, topicCode = \"GERAL\", officialTopicName = \"Tópico não identificado\".";

  const prompt = buildStructurePrompt(mockText, detectedSubject, officialTopicsListText) +
    `\n\nTotal de páginas do PDF: ${numPages}`;

  console.log("\n--- PASSO 3: CHAMANDO GEMINI PARA DETECTSTRUCTURE ---");
  let rawResponseText = "";
  try {
    const result = await callGeminiWithRetry(() => model.generateContent(prompt));
    rawResponseText = result.response.text();
    console.log(`Resposta do Gemini recebida (${rawResponseText.length} caracteres)`);
  } catch (geminiErr: any) {
    console.error("Erro na chamada ao Gemini:", geminiErr.message);
    return;
  }

  // 5. Parsear JSON
  console.log("\n--- PASSO 4: PARSEAR JSON ---");
  let parsedResult: any;
  try {
    const startIndex = rawResponseText.indexOf("{");
    const endIndex = rawResponseText.lastIndexOf("}");
    if (startIndex === -1) {
      console.error("JSON não encontrado na resposta:\n", rawResponseText);
      return;
    }
    const cleanJson = rawResponseText.substring(startIndex, endIndex + 1);
    parsedResult = JSON.parse(cleanJson);
    console.log("JSON parseado com sucesso!");
    console.log("Blocos brutos retornados pelo Gemini:");
    console.dir(parsedResult.blocks, { depth: null });
  } catch (parseErr: any) {
    console.error("Erro ao parsear JSON:", parseErr.message);
    console.error("Resposta bruta do Gemini:\n", rawResponseText);
    return;
  }

  // 6. Validar blocos
  console.log("\n--- PASSO 5: VALIDAR CRITÉRIOS DE QUALIDADE ---");
  const blocks = parsedResult.blocks || [];
  const role = parsedResult.materialRole || "UNKNOWN";
  const validationErrors: string[] = [];

  console.log("Total de blocos gerados pela IA:", blocks.length);
  console.log("Papel do material (role):", role);

  // Heurísticas de Validação
  const FORBIDDEN_GENERIC_PATTERNS = [
    /^parte\s+\d+/i,
    /^conteúdo\s+\d+/i,
    /^conteudo\s+\d+/i,
    /^bloco\s+\d+$/i
  ];
  const GENERIC_TITLES = [
    "TODO CONTEUDO", "TODO O CONTEUDO", "CONTEUDO COMPLETO", 
    "MATERIAL COMPLETO", "MATERIAL GERAL", "RESUMO GERAL", "CONTEUDO GERAL",
    "CONTEUDO DA MATERIA", "APOSTILA COMPLETA", "PDF COMPLETO", "PARTE 1 DO CONTEUDO",
    "PARTE 2 DO CONTEUDO", "PARTE 3 DO CONTEUDO", "PARTE DO CONTEUDO", "MATERIAL INTEGRA", "TODO O PDF",
    "CONTEUDO INTEGRAL", "VISAO GERAL", "ESTUDO COMPLETO", "APOSTILA", "PDF", 
    "CONTEUDO", "SUMARIO", "CAPITULO", "INTRODUCAO", "FUNDAMENTOS E CONCEITOS DE OUTROS",
    "FUNDAMENTOS DE OUTROS", "CONCEITOS DE OUTROS", "OUTROS - BLOCO 1", "OUTROS", "BLOCO GENERICO"
  ];

  // 1. Títulos genéricos
  const hasGenericTitle = blocks.some((b: any) => {
    const titleNorm = b.title.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const isForbiddenLiteral = GENERIC_TITLES.some(gt => titleNorm === gt);
    const isForbiddenPattern = FORBIDDEN_GENERIC_PATTERNS.some(re => re.test(b.title));
    if (isForbiddenLiteral || isForbiddenPattern) {
      console.log(`[Rejeição] Bloco "${b.title}" possui título genérico/proibido.`);
    }
    return isForbiddenLiteral || isForbiddenPattern;
  });
  if (hasGenericTitle) {
    validationErrors.push("Contém títulos genéricos proibidos.");
  }

  // 2. Bloco único
  if (blocks.length === 1 && numPages > 5) {
    validationErrors.push("Criou apenas um bloco único para um material longo.");
  }

  // 3. Mínimo de blocos
  let minBlocks = 1;
  if (numPages > 50) minBlocks = 4;
  else if (numPages > 20) minBlocks = 3;
  else if (numPages > 5) minBlocks = 2;

  if (blocks.length < minBlocks && numPages > 5) {
    validationErrors.push(`Quantidade insuficiente de blocos (encontrado ${blocks.length}, esperado no mínimo ${minBlocks}).`);
  }

  // 4. Mapeamento de Tópico Oficial obrigatório para disciplinas principais
  const mainSubjects = [
    "Língua Portuguesa",
    "Direito Administrativo",
    "Direito Constitucional",
    "Direito do Trabalho",
    "Direito Processual do Trabalho",
    "Direito Civil",
    "Direito Processual Civil"
  ];
  const isMainSubject = mainSubjects.includes(detectedSubject);

  if (isMainSubject) {
    for (const b of blocks) {
      if (b.type !== "SUPPORT_BLOCK" && !b.officialTopicId) {
        validationErrors.push(`Bloco principal "${b.title}" sem officialTopicId na disciplina principal "${detectedSubject}".`);
      }
    }
  }

  console.log("\n=== RESULTADO FINAL DO DEBUG ===");
  if (validationErrors.length === 0) {
    console.log("✅ SUCESSO! A divisão passou em todas as validações de qualidade!");
  } else {
    console.log("❌ REJEITADO! Erros de validação:");
    validationErrors.forEach((e, idx) => console.log(`  ${idx+1}. ${e}`));
  }
}

main().catch(console.error);
