/**
 * Prompts otimizados para o Organizador Inteligente (Kehl Study).
 * Focados no Edital oficial do TRT e extração estrutural de alta fidelidade,
 * estendidos dinamicamente para suportar múltiplos objetivos (TI/Cibersegurança/GRC).
 */

export function buildSubjectPrompt(
  content: string,
  fileName?: string,
  examGoal?: string | null,
  focusArea?: string | null
): string {
  const goal = examGoal || "Estudos gerais";
  const area = focusArea || "Inferir pelo conteúdo do material";
  
  // Se for focado em TRT, injeta a lista oficial de disciplinas de tribunais.
  const isTRT = goal.toUpperCase().includes("TRT");
  
  let subjectsGuidance = "";
  if (isTRT) {
    subjectsGuidance = `
Lista Oficial de Matérias do Edital TRT (Use exatamente um dos termos da lista abaixo se coincidir com o conteúdo do material):
1. "Direito do Trabalho" (Temas: CLT, contrato de trabalho, remuneração, FGTS, jornada, rescisão, etc.)
2. "Direito Processual do Trabalho" (Temas: petição inicial, audiência trabalhista, recursos, execução, competência, etc.)
3. "Direito Administrativo" (Temas: atos administrativos, licitações, contratos, agentes públicos, Lei 8112, etc.)
4. "Direito Constitucional" (Temas: direitos fundamentais, organização do Estado, controle de constitucionalidade, etc.)
5. "Direito Civil" (Temas: LINDB, pessoas, bens, negócios jurídicos, obrigações, contratos, etc.)
6. "Direito Processual Civil" (Temas: CPC, petição, contestação, recursos civis, execução, tutela provisória, etc.)
7. "Língua Portuguesa" (Temas: concordância, regência, crase, morfologia, sintaxe, interpretação, etc.)
8. "Matemática e Raciocínio Lógico" (Temas: lógica proposicional, porcentagem, equações, probabilidade, sequências, etc.)
9. "Informática" (Temas: Windows, Word, Excel, PowerPoint, redes, segurança da informação, nuvem, etc.)
10. "Direitos das Pessoas com Deficiência" (Temas: Lei 13.146/2015, inclusão, resoluções do CNJ, etc.)
11. "Legislação específica" (Temas: Regimento Interno do TRT4, resoluções do tribunal, etc.)
12. "Discursiva" (Temas: técnicas de redação, estudos de caso, redação jurídica, etc.)
`;
  } else {
    subjectsGuidance = `
Como o objetivo do estudante não é focado na área de advocacia ou concursos de tribunais, sua tarefa é identificar ou sugerir uma matéria/disciplina técnica coerente com o conteúdo do PDF e o objetivo do usuário.
Não presuma matérias legais/jurídicas clássicas a menos que o conteúdo do material seja estritamente sobre legislação.
Exemplo para Cibersegurança: se o conteúdo do PDF for sobre a ISO 27001, IAM ou riscos cibernéticos, a saída esperada deve ser uma matéria coerente como "Segurança da Informação", "Cibersegurança", "Gestão de Riscos", etc.
`;
  }

  const prompt = `Você é um assistente de IA especialista em organização e planejamento de estudos, focado em ajudar o estudante a atingir seu objetivo.
Objetivo do Usuário (examGoal): "${goal}"
Área de Foco do Usuário (focusArea): "${area}"

Sua tarefa é analisar o nome do arquivo e as primeiras páginas de um material de estudos (PDF) e identificar com precisão a qual MATÉRIA/DISCIPLINA o material pertence, levando em consideração o objetivo e a área de foco do aluno.

${subjectsGuidance}

Regras Cruciais de Identificação:
- NUNCA use nomes genéricos como "Outros", "Geral", "Diversos", "Apostila", "PDF", "Conteúdo", "Sem Matéria".
- Se o material for sobre uma norma, framework ou lei específica, classifique na matéria/disciplina a que ela pertence (Ex: ISO 27001 -> "Segurança da Informação" ou "Gestão de Riscos"; Lei 8.112/90 -> "Direito Administrativo").
- Se o texto tiver baixíssima densidade de palavras ou for apenas uma capa, use as pistas do nome do arquivo para classificar na matéria mais provável.
- Dê prioridade a matérias específicas e úteis para a organização do cronograma de estudos.

Formato de Retorno (JSON estrito, não inclua nada extra fora do bloco JSON):
{
  "subjectName": "Nome da matéria identificada (curto, útil, direto e sem aspas internas)",
  "confidence": 0.0 a 1.0,
  "reason": "Explicar quais termos, conceitos, normas ou leis fundamentaram a decisão de forma concisa"
}`;

  const fileNameContext = fileName ? `Nome do arquivo original: ${fileName}\n` : "";
  return `${prompt}\n\n${fileNameContext}Texto extraído para análise:\n${content}`;
}

export function buildStructurePrompt(
  content: string,
  subjectName: string,
  officialTopicsListText: string,
  tocJsonText?: string,
  examGoal?: string | null,
  focusArea?: string | null
): string {
  const goal = examGoal || "Estudos gerais";
  const area = focusArea || "Geral";
  const isTRT = goal.toUpperCase().includes("TRT");

  let examplesText = "";
  if (isTRT) {
    examplesText = `
* Exemplos Excelentes:
  - "Princípios Administrativos — princípios expressos, implícitos e reconhecidos"
  - "Aplicabilidade das Normas Constitucionais — eficácia plena, contida e limitada"
  - "Jornada de Trabalho — tempo à disposição, sobreaviso, prontidão e descansos"
  - "Normas Fundamentais do Processo Civil — devido processo legal, contraditório e cooperação"
  - "Princípios do Processo do Trabalho — oralidade, concentração, proteção e jus postulandi"
`;
  } else {
    examplesText = `
* Exemplos Excelentes:
  - "Controles de Acesso — IAM, autenticação multifator e privilégio mínimo"
  - "ISO/IEC 27001 — objetivos de controle, SGSI e processo de certificação"
  - "Análise de Riscos — identificação de ameaças, vulnerabilidades e cálculo de risco residual"
  - "Segurança em Nuvem — modelos de responsabilidade compartilhada e segurança de containers"
  - "Gestão de Incidentes — preparação, detecção, análise, contenção e lições aprendidas"
`;
  }

  const prompt = `Você é um engenheiro de dados educacionais especializado em transformar PDFs de cursos de estudo em blocos de estudo reais para o cronograma de estudos do aluno.
Objetivo de Estudos do Aluno: "${goal}"
Área de Foco: "${area}"

Sua tarefa NÃO é dividir o PDF por páginas de forma aleatória.
Sua tarefa é interpretar a estrutura do material, especialmente o sumário (TOC), e transformá-la em blocos úteis para o cronograma de estudos de acordo com a disciplina/matéria "${subjectName}".

Use o sumário fornecido como a FONTE PRINCIPAL de fatiamento quando ele estiver disponível. A IA deve atuar como engenheira pedagógica para classificar, agrupar e mapear os blocos aos tópicos oficiais de estudo do edital ou do escopo de estudo.

A divisão deve respeitar rigorosamente:
- Títulos e subtítulos do sumário;
- Início e fim natural dos assuntos (baseados nas páginas do sumário);
- Tópicos oficiais/principais de estudo;
- Continuidade temática e pedagógica;
- Densidade do conteúdo;
- Separação estrita entre teoria e questões/materiais de apoio.

REGRAS DE CLASSIFICAÇÃO E DIVISÃO:
1. Nunca colapse todo o PDF em 1 único bloco se o sumário mostra várias seções teóricas independentes.
2. Nunca divida mecanicamente o conteúdo por intervalos fixos de páginas (ex: de 10 em 10 páginas de forma contínua).
3. Não existe mínimo matemático de blocos por PDF. Mas há obrigação absoluta de respeitar a estrutura temática do sumário.
4. Classifique o material globalmente no campo "materialRole" como:
   - "MAIN_MATERIAL": Predominantemente teoria. Crie MAIN_BLOCKS a partir das seções teóricas.
   - "SUPPORT_MATERIAL": Predominantemente resumos, mapas mentais, bizus, questões, gabaritos, checklists ou revisão rápida. Crie apenas SUPPORT_BLOCKS, não force nenhum MAIN_BLOCK.
   - "MIXED_MATERIAL": Contém teoria principal + questões, resumos, listas ou gabaritos. Crie MAIN_BLOCKS para as seções teóricas e SUPPORT_BLOCKS para resumos, questões comentadas, listas de exercícios e gabaritos.

5. BLOCO TEÓRICO PRINCIPAL (MAIN_BLOCK):
   - Deve representar uma unidade temática real do sumário, cobrindo teoria explicativa.
   - Cada bloco deve ter um tempo estimado ("estimatedStudyMinutes") entre 30 e 60 minutos (idealmente aproximando 45 minutos de teoria). Respeite a unidade temática.
   - Títulos de "MAIN_BLOCK" devem ser específicos e temáticos. Use travessão explicativo quando necessário para contextualizar.
   ${examplesText}
   * Tópicos genéricos ou iniciais de sumário como "Introdução a ${subjectName}" ou "Fundamentos de ${subjectName}" são blocos teóricos válidos de introdução/fundamentos e devem ser mantidos e mapeados!
   * Títulos curtos não são inválidos se coerentes, mas devem ser enriquecidos com complemento descritivo temático.
   * Títulos estritamente PROIBIDOS: "Parte 1", "Parte I", "Bloco 1", "Conteúdo Completo", "Todo o Conteúdo", "Material Completo", "Fundamentos e Conceitos de Outros", "Outros", "Sem categoria", "Desconhecido".

6. BLOCO DE APOIO (SUPPORT_BLOCK):
   - Criado para seções de questões comentadas, listas de questões, resumos, bizus, mapas mentais, simulados e gabaritos.
   - Não entra no cronograma como teoria, não precisa de 30-60 minutos de duração estimada (pode ser 0), nem precisa gerar flashcards diretamente.
   - Deve ser classificado com o "supportType" adequado: "SUMMARY", "BIZU", "MIND_MAP", "QUESTIONS", "COMMENTED_QUESTIONS", "ANSWER_KEY", "SIMULATED_EXAM", "CHECKLIST", "REVIEW" ou "OTHER".
   - Deve ser associado ao tópico oficial correspondente ou vinculado ao bloco principal teórico.

7. MAPEAMENTO DE TÓPICO OFICIAL:
   - Se houver relação razoável com algum tópico oficial da lista, escolha o tópico mais próximo e preencha "officialTopicId", "topicCode" e "officialTopicName".
   - NUNCA use "GERAL" como atalho fácil se existir correspondência plausível com algum tópico do edital/lista fornecida.

8. DETECÇÃO E FONTE (sourceStrategy):
   - Se o sumário do PDF foi detectado e fornecido, defina "sourceStrategy" = "TOC_BASED", "tocDetected" = true, e "tocConfidence" = 1.0.
   - Se o sumário não foi detectado e você está fatiando com base no texto corrido das páginas, defina "sourceStrategy" = "CONTENT_BASED" ou "HYBRID", "tocDetected" = false, e "tocConfidence" = 0.0.

Retorne APENAS um objeto JSON estrito com o seguinte schema, sem nenhum texto introdutório ou conclusivo:
{
  "materialRole": "MAIN_MATERIAL | SUPPORT_MATERIAL | MIXED_MATERIAL",
  "sourceStrategy": "TOC_BASED | CONTENT_BASED | HYBRID",
  "tocDetected": true,
  "tocConfidence": 1.0,
  "blocks": [
    {
      "type": "MAIN_BLOCK | SUPPORT_BLOCK",
      "title": "Título específico e temático do bloco",
      "titleQuality": "GOOD | WEAK | INVALID",
      "titleRationale": "Por que o título representa de forma específica e pedagógica o conteúdo deste bloco",
      "description": "Descrição pedagógica curta do assunto estudado no bloco",
      "sourceHeading": "Título original do sumário que originou o bloco",
      "pageStart": 3,
      "pageEnd": 25,
      "estimatedStudyMinutes": 45,
      "contentDensity": "LOW | MEDIUM | HIGH | VERY_HIGH",
      "officialTopicId": "ID do tópico oficial ou null",
      "officialTopicName": "Nome completo do tópico oficial do edital ou null",
      "topicCode": "Código do tópico (Ex: Tópico XX) ou 'GERAL'",
      "pageTypes": ["MAIN_THEORY", "EXPLANATION", "QUESTIONS", "SUMMARY"],
      "selectionJustification": "Por que estas páginas formam uma unidade temática pedagógica coerente e indivisível baseada na estrutura do sumário",
      "isMechanicalCut": false,
      "isSummaryOnly": false,
      "isQuestionsOnly": false,
      "supportType": "SUMMARY | BIZU | MIND_MAP | QUESTIONS | COMMENTED_QUESTIONS | ANSWER_KEY | SIMULATED_EXAM | CHECKLIST | REVIEW | OTHER | null",
      "supportGroupingRationale": "Motivação pedagógica para agrupar ou estruturar esta seção de apoio"
    }
  ]
}`;

  const tocContext = tocJsonText 
    ? `\n=========================================\nSUMÁRIO DO PDF DETECTADO E EXTRAÍDO PROGRAMATICAMENTE (Use como fonte principal de verdade para tópicos e páginas):\n${tocJsonText}\n=========================================\n`
    : "";
  
  return `${prompt}
${tocContext}
=========================================
DISCIPLINA: ${subjectName}
TÓPICOS OFICIAIS DISPONÍVEIS NO EDITAL/ESCOPO:
${officialTopicsListText}
=========================================

Texto extraído do PDF para análise estrutural de fatiamento (primeiras páginas do material):
${content}`;
}
