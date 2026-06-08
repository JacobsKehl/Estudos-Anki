/**
 * Prompt de alta fidelidade e regras rígidas para geração de flashcards estilo Anki.
 * Focado em Concursos Públicos (TRTs, FCC, AJAJ) ou Tópicos Técnicos/Certificações.
 */

export type FlashcardDifficulty = "EASY" | "NORMAL_PLUS" | "HARD";

export interface FlashcardPromptOptions {
  blockText: string;
  difficulty?: FlashcardDifficulty;
  subjectName?: string | null;
  blockTitle?: string | null;
  materialTitle?: string | null;
  examGoal?: string | null;
  focusArea?: string | null;
}

export function buildFlashcardPrompt(
  optionsOrText: string | FlashcardPromptOptions,
  legacyDifficulty?: FlashcardDifficulty
): string {
  let options: FlashcardPromptOptions;
  if (typeof optionsOrText === "string") {
    options = {
      blockText: optionsOrText,
      difficulty: legacyDifficulty
    };
  } else {
    options = optionsOrText;
  }

  const {
    blockText,
    difficulty = "NORMAL_PLUS",
    subjectName = "Geral",
    blockTitle = "Conteúdo",
    materialTitle = "Material",
    examGoal = "Estudos gerais",
    focusArea = "Geral"
  } = options;

  const goal = examGoal || "Estudos gerais";
  const isTRT = goal.toUpperCase().includes("TRT");

  let focusGuidelines = "";
  let examplesText = "";

  if (isTRT) {
    focusGuidelines = `
- focados em concursos públicos de alto rendimento para carreiras jurídicas, especialmente TRT, FCC e Analista Judiciário (AJAJ).
- Priorize: prazos, marcos temporais, requisitos, exceções, distinções conceituais, competências, consequências jurídicas, hipóteses de cabimento, efeitos jurídicos, súmulas (TST, STF, STJ), súmulas vinculantes, teses de repercussão geral, artigos de lei expressamente relevantes.
`;
    examplesText = `
* Exemplos Excelentes para Carreiras Jurídicas:
  - Pergunta: Qual é o prazo de...? / Resposta: ... dias.
  - Pergunta: Qual requisito é necessário para...? / Resposta: ...
  - Pergunta: O que estabelece a Súmula X do TST sobre Y? / Resposta: ...
  - Pergunta: Qual é a exceção à regra de...? / Resposta: ...
`;
  } else {
    focusGuidelines = `
- focados em tópicos técnicos, certificações profissionais e aplicação prática do conteúdo.
- Priorize: conceitos chaves, definições claras, diferenças entre termos, controles de segurança, frameworks (ex: ISO, NIST, CIS), siglas importantes, responsabilidades, processos, etapas de metodologias, riscos identificados, boas práticas de mercado, pegadinhas comuns de certificações.
`;
    examplesText = `
* Exemplos Excelentes para Certificações/Técnico:
  - Pergunta: Qual é o objetivo de um SGSI? / Resposta: ...
  - Pergunta: Qual é a diferença entre risco inerente e risco residual? / Resposta: ...
  - Pergunta: O que significa aplicar tratamento de riscos? / Resposta: ...
  - Pergunta: Qual é a função do Anexo A da ISO/IEC 27001? / Resposta: ...
  - Pergunta: Qual é a diferença entre controle preventivo, detectivo e corretivo? / Resposta: ...
`;
  }

  const difficultyLabel = difficulty === "EASY" ? "EASY" : difficulty === "HARD" ? "HARD" : "MEDIUM";

  const prompt = `Você é um especialista em criação de flashcards para repetição espaçada por meio do sistema Anki.
Dados de Contexto do Aluno e do Material:
- Objetivo do Aluno (examGoal): "${goal}"
- Área de Foco (focusArea): "${focusArea}"
- Matéria do Bloco (subjectName): "${subjectName}"
- Título do Bloco (blockTitle): "${blockTitle}"
- Nome do Material (materialTitle): "${materialTitle}"

Sua tarefa é ler o trecho do material de estudo fornecido e extrair somente os pontos de maior relevância prática/prova, convertendo-os em flashcards objetivos no formato Pergunta/Resposta.

DIRETRIZES DE FOCO:
O estudante possui o perfil e objetivos abaixo. Os cards devem ser gerados sob este contexto:
${focusGuidelines}

REGRAS ABSOLUTAS:
1. Não crie cards Cloze.
2. Não use lacunas com {{c1::...}}.
3. Cada flashcard deve conter uma pergunta direta e uma resposta objetiva.
4. Cada card deve testar apenas UMA informação (princípio da atomicidade do Anki).
5. O verso (resposta) deve ser curto, técnico e revisável em até 10 segundos.
6. Evite respostas longas em parágrafos.
7. Evite perguntas genéricas como "Fale sobre...", "Explique..." ou "O que é..." quando o conceito for básico demais.
8. Não crie cards baseados em opinião pessoal de autor, a menos que seja um padrão consagrado no framework/área de estudos.

ESTILO DAS PERGUNTAS E RESPOSTAS:
${examplesText}
- Responder de forma curta e precisa.
- Idealmente entre 1 e 15 palavras.
- Pode passar disso apenas se for indispensável.
- Não usar parágrafos longos.
- Não explicar além do necessário.
- Não inventar informação que não esteja no texto.

QUANTIDADE E LIMITES:
- Gere poucos flashcards. A qualidade e relevância são muito mais importantes do que a quantidade.
- Se o bloco tiver apenas 3 pontos realmente relevantes, gere apenas 3 flashcards.
- Se o bloco não tiver nenhum ponto bom de memorização, gere 0 flashcards.
- Não force quantidade. Não tente cobrir cada parágrafo.
- Limite de geração: entre 3 e 6 flashcards por bloco. Só gere mais se o bloco for extremamente denso. NUNCA ultrapasse 10 flashcards.

FORMATO DE SAÍDA:
Retorne estritamente um array JSON válido (sem comentários, sem blocos markdown adicionais como \`\`\`json) contendo os flashcards no formato exato abaixo:
[
  {
    "question": "Pergunta específica e direta?",
    "answer": "Resposta curta e precisa.",
    "type": "QUESTION_ANSWER",
    "difficulty": "MEDIUM"
  }
]`;

  return `${prompt}\n\nDificuldade desejada: ${difficultyLabel}\n\nTexto base para extração:\n${blockText}`;
}
