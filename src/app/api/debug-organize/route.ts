import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { identifySubject } from "@/lib/ai/organizer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildStructurePrompt } from "@/lib/ai/prompts/organizer";
import { OFFICIAL_TOPICS } from "../../../lib/constants/official-topics";
import { callGeminiWithRetry } from "@/lib/ai/utils/retry";
import { detectQuestionsOrGabaritoHeuristic } from "@/lib/ai/organizer";

export async function GET() {
  const logs: string[] = [];
  const log = (...args: any[]) => {
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : a).join(" ");
    logs.push(msg);
    console.log("[DEBUG ROUTE]", msg);
  };

  try {
    log("Iniciando debug de organização...");
    log("GEMINI_API_KEY present:", Boolean(process.env.GEMINI_API_KEY));
    log("GEMINI_MODEL:", process.env.GEMINI_MODEL || "gemini-2.5-flash");

    // 1. Encontrar um material que tenha conteúdo extraído
    const material = await prisma.studyMaterial.findFirst({
      where: {
        extractedContent: {
          some: {}
        }
      },
      include: {
        extractedContent: {
          orderBy: { pageNumber: "asc" }
        }
      }
    });

    if (!material) {
      log("Nenhum material com conteúdo extraído encontrado.");
      return NextResponse.json({ error: "No materials with extracted content found", logs });
    }

    log(`Encontrado material: ID=${material.id}, FileName=${material.fileName}, totalPages=${material.totalPages}, paginasExtraidas=${material.extractedContent.length}`);

    // 2. Extrair sample para identifySubject
    const sampleText = material.extractedContent
      .slice(0, 5)
      .map(p => p.text)
      .join("\n\n");

    log("Identificando matéria...");
    let detectedSubject = "";
    try {
      const subjectResult = await identifySubject(sampleText.substring(0, 3000), material.fileName);
      detectedSubject = subjectResult.subjectName;
      log("Matéria identificada:", subjectResult);
    } catch (err: any) {
      log("Erro no identifySubject:", err.message, err.stack);
      return NextResponse.json({ error: "identifySubject failed", errMessage: err.message, errStack: err.stack, logs });
    }

    // 3. Obter tópicos oficiais
    const relevantTopics = OFFICIAL_TOPICS.filter(
      (t: any) => t.subjectName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
           detectedSubject.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    );
    log(`Tópicos oficiais para "${detectedSubject}": ${relevantTopics.length}`);

    // 4. Executar detectStructure mas capturando os dados brutos e etapas
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      log("Erro: GEMINI_API_KEY ausente.");
      return NextResponse.json({ error: "GEMINI_API_KEY missing", logs });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const nonEmptyPages = material.extractedContent;
    const numPages = material.totalPages || nonEmptyPages.length;
    const fullTextForStructure = nonEmptyPages
      .slice(0, 15)
      .map(p => p.text)
      .join("\n");

    const officialTopicsListText = relevantTopics.length > 0
      ? relevantTopics.map((t: any) => `- ID: "${t.id}" | Código: "${t.topicCode}" | Título: "${t.title}"`).join("\n")
      : "Esta matéria não possui matriz de tópicos cadastrada. Use officialTopicId = null, topicCode = \"GERAL\", officialTopicName = \"Tópico não identificado\".";

    const prompt = buildStructurePrompt(fullTextForStructure, detectedSubject, officialTopicsListText) +
      `\n\nTotal de páginas do PDF: ${numPages}`;

    log("Chamando Gemini para detecção de estrutura...");
    let rawResponseText = "";
    try {
      const result = await callGeminiWithRetry(() => model.generateContent(prompt));
      rawResponseText = result.response.text();
      log("Resposta bruta do Gemini recebida (comprimento):", rawResponseText.length);
    } catch (geminiErr: any) {
      log("Erro na chamada ao Gemini:", geminiErr.message, geminiErr.stack);
      return NextResponse.json({ error: "Gemini API call failed", errMessage: geminiErr.message, errStack: geminiErr.stack, logs });
    }

    // 5. Parsear JSON
    let parsedResult: any;
    try {
      const startIndex = rawResponseText.indexOf("{");
      const endIndex = rawResponseText.lastIndexOf("}");
      if (startIndex === -1) {
        log("Erro: JSON não encontrado na resposta:", rawResponseText);
        return NextResponse.json({ error: "JSON not found in response", rawResponseText, logs });
      }
      const cleanJson = rawResponseText.substring(startIndex, endIndex + 1);
      parsedResult = JSON.parse(cleanJson);
      log("JSON parseado com sucesso:", parsedResult);
    } catch (parseErr: any) {
      log("Erro ao parsear JSON:", parseErr.message, parseErr.stack);
      return NextResponse.json({ error: "JSON parse failed", rawResponseText, errMessage: parseErr.message, logs });
    }

    // 6. Validar blocos
    const blocks = parsedResult.blocks || [];
    const role = parsedResult.materialRole || "UNKNOWN";
    const validationErrors: string[] = [];

    log("Validando blocos retornados...");
    log("Total de blocos:", blocks.length);

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
      const isForbiddenLiteral = GENERIC_TITLES.some(gt => titleNorm === gt || titleNorm.includes(gt));
      const isForbiddenPattern = FORBIDDEN_GENERIC_PATTERNS.some(re => re.test(b.title));
      return isForbiddenLiteral || isForbiddenPattern;
    });
    if (hasGenericTitle) {
      validationErrors.push("Contém títulos genéricos proibidos (Parte X, Conteúdo Completo, Bloco 1, etc).");
    }

    // 2. Bloco único
    if (blocks.length === 1 && numPages > 5) {
      validationErrors.push("Criou apenas um bloco único para um material longo.");
    }

    // 3. Mínimo de blocos
    let minBlocks = 1;
    if (numPages > 50) minBlocks = 8;
    else if (numPages > 20) minBlocks = 5;
    else if (numPages > 5) minBlocks = 3;

    if (blocks.length < minBlocks && numPages > 5) {
      validationErrors.push(`Quantidade insuficiente de blocos (encontrado ${blocks.length}, esperado no mínimo ${minBlocks}).`);
    }

    // 4. Heurísticas por página
    for (const b of blocks) {
      const blockPages = nonEmptyPages.filter(p => p.pageNumber >= b.pageStart && p.pageNumber <= b.pageEnd);
      const fullBlockText = blockPages.map(p => p.text).join("\n");
      const normalizedBlockText = fullBlockText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      if (normalizedBlockText.trim().length > 0) {
        const qgResult = detectQuestionsOrGabaritoHeuristic(fullBlockText);
        if (qgResult.isQuestions || qgResult.isAnswerKey) {
          log(`Bloco "${b.title}" convertido em apoio.`);
          continue;
        }

        const negativeKeywords = [
          "resumo", "bizu", "mapa mental", "mapas mentais", "gabarito", "questoes", "questões",
          "simulado", "revisao de vespera", "revisão de véspera", "revisao rapida", "revisão rápida",
          "esquematico", "esquemático", "checklist"
        ];
        let negativeScore = 0;
        negativeKeywords.forEach(kw => {
          const regex = new RegExp(kw, "g");
          const matches = normalizedBlockText.match(regex);
          if (matches) negativeScore += matches.length;
        });

        const positiveKeywords = [
          "conceito", "definicao", "definicao", "exemplo", "classificacao", "classificacao",
          "regra", "excecao", "excecao", "jurisprudencia", "jurisprudencia", "artigo",
          "fundamento", "aplicacao", "aplicacao", "doutrina", "entendimento", "explicacao", "explicacao"
        ];
        let positiveScore = 0;
        positiveKeywords.forEach(kw => {
          const regex = new RegExp(kw, "g");
          const matches = normalizedBlockText.match(regex);
          if (matches) positiveScore += matches.length;
        });

        const isResumoOnly = negativeScore > 6 && positiveScore <= 2;
        if (isResumoOnly && (!b.type || b.type === "MAIN_BLOCK")) {
          validationErrors.push(`Bloco "${b.title}" (p.${b.pageStart}-${b.pageEnd}) rejeitado por parecer apenas resumo/bizu (negativo=${negativeScore}, positivo=${positiveScore}).`);
        }
      }
    }

    // 5. Mapeamento de Tópico Oficial obrigatório para disciplinas principais
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

    log("Erros de validação encontrados:", validationErrors);

    return NextResponse.json({
      success: validationErrors.length === 0,
      validationErrors,
      detectedSubject,
      materialRole: role,
      blocksCount: blocks.length,
      blocks,
      rawResponseText,
      logs
    });

  } catch (err: any) {
    log("Erro geral no debug:", err.message, err.stack);
    return NextResponse.json({ error: "General error", errMessage: err.message, errStack: err.stack, logs });
  }
}
