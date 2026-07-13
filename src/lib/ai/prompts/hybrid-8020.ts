/**
 * src/lib/ai/prompts/hybrid-8020.ts
 *
 * Contratos e templates de prompts estruturais para a metodologia híbrida 80/20.
 *
 * REGRAS CRÍTICAS:
 *   - Não importa SDKs de IA ou executa chamadas de rede.
 *   - Contém definições e construtores de strings (builders).
 */

export const HYBRID_PROMPT_VERSION = "1.0.0";

// ─── Contratos de Entrada/Saída em Formato de Documentação de Prompts ──────────

export const MAP_PAGES_SCHEMA = `
Output JSON format (Array of objects):
[
  {
    "pageNumber": number,
    "topics": string[],
    "summary": string
  }
]
`;

export const CANDIDATE_RETRIEVAL_SCHEMA = `
Output JSON format:
{
  "candidatePages": number[]
}
`;

export const DEEP_ANALYSIS_SCHEMA = `
Output JSON format:
{
  "confidence": number, // entre 0.0 e 1.0
  "justification": {
    "anchorChoice": string,
    "deepeningChoice": string
  },
  "sources": [
    {
      "materialId": string,
      "sourceRole": "ANCHOR_8020" | "DEEPENING",
      "isCanonical": boolean,
      "selectionReason": string,
      "segments": [
        {
          "disposition": "READ" | "CONSULT" | "SKIP",
          "pageStart": number,
          "pageEnd": number,
          "reason": string
        }
      ]
    }
  ],
  "fccFocusPoints": string[],
  "flashcardSeeds": [
    {
      "question": string,
      "answer": string,
      "type": "CLOZE" | "QUESTION_ANSWER",
      "sourceMaterialId": string,
      "sourcePageStart": number,
      "sourcePageEnd": number,
      "generationReason": string
    }
  ]
}
`;

// ─── Prompt Builders ──────────────────────────────────────────────────────────

/**
 * Constrói o prompt para o mapeamento inicial de páginas (Etapa A).
 */
export function buildMapPagesPrompt(params: {
  materialId: string;
  pages: { pageNumber: number; text: string }[];
}): string {
  return `
Você é o analisador estrutural de PDFs da plataforma Kehl Study (Versão do Prompt: ${HYBRID_PROMPT_VERSION}).
Mapeie os tópicos contidos em cada página abaixo para o Material ID "${params.materialId}".

Páginas a analisar:
${params.pages
  .map(
    (p) => `--- INÍCIO DA PÁGINA ${p.pageNumber} ---
${p.text}
--- FIM DA PÁGINA ${p.pageNumber} ---`
  )
  .join("\n\n")}

Instruções críticas:
1. Extraia de 1 a 5 tópicos centrais discutidos na página.
2. Forneça um resumo sucinto da página.
3. Preserve exatamente o "pageNumber" de cada página analisada.
4. Responda exclusivamente no formato JSON especificado.

${MAP_PAGES_SCHEMA}
`;
}

/**
 * Constrói o prompt para o candidate retrieval (Etapa B).
 */
export function buildCandidateRetrievalPrompt(params: {
  cfcAnchorPoints: string[];
  estrategiaMappedPages: { pageNumber: number; topics: string[]; summary: string }[];
  targetTheme: string;
  examProfile: string;
}): string {
  return `
Você é o motor de busca 80/20 do Kehl Study (Versão: ${HYBRID_PROMPT_VERSION}).
Com base no perfil da banca "${params.examProfile}" e no tema "${params.targetTheme}", identifique quais páginas do material de aprofundamento (Estratégia) contêm conteúdo relevante relacionado aos pontos âncora do Concurseiro Fora da Caixa (CFC).

Pontos Âncora do CFC:
${params.cfcAnchorPoints.map((p) => `- ${p}`).join("\n")}

Estrutura Mapeada do Estratégia:
${params.estrategiaMappedPages
  .map(
    (p) => `- Página ${p.pageNumber}: Tópicos [${p.topics.join(", ")}] | Resumo: ${p.summary}`
  )
  .join("\n")}

Instruções críticas:
1. Retorne apenas as páginas que são cruciais para aprofundar, explicar ou complementar os pontos âncora do CFC.
2. Seja seletivo. Busque maximizar o benefício 80/20 (reduzir volume de leitura preservando o alto rendimento).
3. Responda exclusivamente no formato JSON especificado.

${CANDIDATE_RETRIEVAL_SCHEMA}
`;
}

/**
 * Constrói o prompt para a análise profunda (Etapa C).
 */
export function buildDeepAnalysisPrompt(params: {
  cfcPages: { pageNumber: number; text: string }[];
  estrategiaPages: { materialId: string; pageNumber: number; text: string }[];
  targetTheme: string;
  examProfile: string;
  goal: string;
}): string {
  return `
Você é o Analista Pedagógico Híbrido do Kehl Study (Versão: ${HYBRID_PROMPT_VERSION}).
Cruze o material de ancoragem (CFC) com o material de aprofundamento (Estratégia) para o tema "${params.targetTheme}".

Objetivo de Estudo:
${params.goal}

Banca de Priorização:
${params.examProfile}

Páginas do CFC (Âncora):
${params.cfcPages
  .map((p) => `Página ${p.pageNumber}: ${p.text.slice(0, 1000)}...`)
  .join("\n")}

Páginas Candidatas do Estratégia (Aprofundamento):
${params.estrategiaPages
  .map(
    (p) => `Material: ${p.materialId} | Página ${p.pageNumber}: ${p.text.slice(0, 1000)}...`
  )
  .join("\n")}

Instruções de Disposição (MANDATÓRIO):
1. **READ**: Páginas com teoria densa explicativa essencial que complementa o CFC. Apenas essas páginas podem gerar flashcards.
2. **CONSULT**: Páginas com tabelas, esquemas ou jurisprudência complementar que servem apenas como consulta. PROIBIDO gerar flashcards delas.
3. **SKIP**: Páginas com enrolação, exercícios resolvidos, repetição ou fora do tema do CFC. PROIBIDO gerar flashcards delas.
4. **IMPORTANTE**: Páginas que não foram analisadas NÃO podem ser classificadas como SKIP ou qualquer outra disposição.
5. Preserve exatamente o "materialId" e "pageNumber" de todas as páginas.

Instruções de Flashcards:
- Gere de 3 a 10 flashcards baseados EXCLUSIVAMENTE nas seções classificadas como READ.
- Proibido gerar flashcards de seções CONSULT ou SKIP.
- Indique claramente a página de origem real (sourcePageStart, sourcePageEnd) e a justificativa (generationReason).

${DEEP_ANALYSIS_SCHEMA}
`;
}
