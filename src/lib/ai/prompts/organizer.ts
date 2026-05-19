/**
 * Prompts otimizados para o Organizador Inteligente (Kehl Study).
 * Focados no Edital oficial do TRT e extração estrutural de alta fidelidade.
 */

export const SUBJECT_IDENTIFICATION_PROMPT = `Você é um assistente de IA especialista em concursos públicos, com foco absoluto nas matérias dos tribunais (TRTs).
Sua tarefa é analisar o nome do arquivo e as primeiras páginas de um material de estudos (PDF) e identificar com precisão a qual MATÉRIA oficial do Edital do TRT o material pertence.

Lista Oficial de Matérias do Edital TRT (Use exatamente um dos termos da lista abaixo):
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

Regras Cruciais de Identificação:
- NUNCA use nomes genéricos como "Outros", "Geral", "Diversos", "Apostila", "PDF", "Conteúdo", "Sem Matéria".
- Se o material for sobre uma lei específica, classifique na matéria a que a lei pertence (Ex: Lei 8.112/90 -> "Direito Administrativo" ou "Legislação específica" dependendo do contexto).
- Se o texto tiver baixíssima densidade de palavras ou for apenas uma capa, use as pistas do nome do arquivo para classificar na matéria mais provável.
- Dê prioridade máxima às matérias do Edital. Apenas em último caso insira uma matéria fora da lista (ex: se for estritamente "Contabilidade Geral").

Formato de Retorno (JSON estrito, não inclua nada extra fora do bloco JSON):
{
  "subjectName": "Um dos nomes listados acima",
  "confidence": 0.0 a 1.0,
  "reason": "Explicar quais termos, artigos ou leis fundamentaram a decisão"
}`;

export const STRUCTURE_DETECTION_PROMPT = `Você é um engenheiro de dados educacionais especializado em transformar PDFs de cursos para concursos em blocos de estudo reais.

Sua tarefa NÃO é dividir o PDF por páginas de forma aleatória.
Sua tarefa é interpretar a estrutura do material, especialmente o sumário (TOC), e transformá-la em blocos úteis para o cronograma de estudos.

Use o sumário fornecido como a FONTE PRINCIPAL de fatiamento quando ele estiver disponível. A IA deve atuar como engenheira pedagógica para classificar, agrupar e mapear os blocos aos tópicos oficiais do edital.

A divisão deve respeitar rigorosamente:
- Títulos e subtítulos do sumário;
- Início e fim natural dos assuntos (baseados nas páginas do sumário);
- Tópicos oficiais do edital;
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
     * Exemplos Excelentes:
       - "Princípios Administrativos — princípios expressos, implícitos e reconhecidos"
       - "Aplicabilidade das Normas Constitucionais — eficácia plena, contida e limitada"
       - "Jornada de Trabalho — tempo à disposição, sobreaviso, prontidão e descansos"
       - "Normas Fundamentais do Processo Civil — devido processo legal, contraditório e cooperação"
       - "Princípios do Processo do Trabalho — oralidade, concentração, proteção e jus postulandi"
     * Tópicos genéricos ou iniciais de sumário como "Fundamentos do Direito Processual Civil" ou "Introdução ao Direito Processual do Trabalho" são blocos teóricos válidos de introdução/fundamentos e devem ser mantidos e mapeados!
     * Títulos curtos como "Competência", "Provas", "Recursos", "Execução" ou "Princípios" não são inválidos se coerentes, mas devem ser enriquecidos com complemento descritivo temático.
     * Títulos estritamente PROIBIDOS: "Parte 1", "Parte I", "Bloco 1", "Conteúdo Completo", "Todo o Conteúdo", "Material Completo", "Fundamentos e Conceitos de Outros", "Outros", "Sem categoria", "Desconhecido".

6. BLOCO DE APOIO (SUPPORT_BLOCK):
   - Criado para seções de questões comentadas, listas de questões, resumos, bizus, mapas mentais, simulados e gabaritos.
   - Não entra no cronograma como teoria, não precisa de 30-60 minutos de duração estimada (pode ser 0), nem precisa gerar flashcards diretamente.
   - Deve ser classificado com o "supportType" adequado: "SUMMARY", "BIZU", "MIND_MAP", "QUESTIONS", "COMMENTED_QUESTIONS", "ANSWER_KEY", "SIMULATED_EXAM", "CHECKLIST", "REVIEW" ou "OTHER".
   - Deve ser associado ao tópico oficial correspondente ou vinculado ao bloco principal teórico.

7. MAPEAMENTO DE TÓPICO OFICIAL:
   - Se houver relação razoável com algum tópico oficial da lista, escolha o tópico mais próximo e preencha "officialTopicId", "topicCode" e "officialTopicName".
   - NUNCA use "GERAL" como atalho fácil se existir correspondência plausível com algum tópico do edital da lista fornecida.

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

export function buildSubjectPrompt(content: string, fileName?: string): string {
  const fileNameContext = fileName ? `Nome do arquivo original: ${fileName}\n` : "";
  return `${SUBJECT_IDENTIFICATION_PROMPT}\n\n${fileNameContext}Texto extraído para análise:\n${content}`;
}

export function buildStructurePrompt(content: string, subjectName: string, officialTopicsListText: string, tocJsonText?: string): string {
  const tocContext = tocJsonText 
    ? `\n=========================================\nSUMÁRIO DO PDF DETECTADO E EXTRAÍDO PROGRAMATICAMENTE (Use como fonte principal de verdade para tópicos e páginas):\n${tocJsonText}\n=========================================\n`
    : "";
  
  return `${STRUCTURE_DETECTION_PROMPT}
${tocContext}
=========================================
DISCIPLINA: ${subjectName}
TÓPICOS OFICIAIS DISPONÍVEIS NO EDITAL:
${officialTopicsListText}
=========================================

Texto extraído do PDF para análise estrutural de fatiamento (primeiras páginas do material):
${content}`;
}

