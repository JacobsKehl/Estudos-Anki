import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

// Robust CSV row parser handling quotes, double quotes, and internal commas
function parseCSVRow(line: string): [string, string] | null {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  if (result.length < 2) {
    // Fallback: split on first comma
    const firstCommaIndex = line.indexOf(',');
    if (firstCommaIndex === -1) return null;
    const front = line.substring(0, firstCommaIndex).trim();
    const back = line.substring(firstCommaIndex + 1).trim();
    return [
      front.replace(/^"|"$/g, '').replace(/""/g, '"').trim(),
      back.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
    ];
  }
  
  return [
    result[0].replace(/^"|"$/g, '').replace(/""/g, '"').trim(),
    result.slice(1).join(',').replace(/^"|"$/g, '').replace(/""/g, '"').trim()
  ];
}

// Text normalization helper for strict deduplication
function normalizeFlashcardText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")                     // remove double spaces
    .replace(/["'“”‘’]/g, "")                 // normalize quotes
    .replace(/[.,;:!?]$/, "")                 // remove trailing punctuation
    .trim();
}

// Keywords mapping for subject heuristics
const SUBJECT_KEYWORDS: Record<string, string[]> = {
  "Direito do Trabalho": [
    "clt", "contrato de trabalho", "empregado", "empregador", "relação de emprego", 
    "subordinação", "pessoalidade", "onerosidade", "não eventualidade", "jornada", 
    "férias", "fgts", "aviso prévio", "remuneração", "salário", "equiparação salarial", 
    "terceirização", "estabilidade", "cipa", "sindicato", "greve", "tst", 
    "súmula do tst", "oj", "orientação jurisprudencial"
  ],
  "Direito Processual do Trabalho": [
    "processo do trabalho", "justiça do trabalho", "reclamação trabalhista", 
    "audiência trabalhista", "rito sumaríssimo", "recurso ordinário", "recurso de revista", 
    "execução trabalhista", "liquidação de sentença", "custas", "depósito recursal", 
    "dissídio coletivo", "ação de cumprimento", "competência da justiça do trabalho", 
    "trt", "tst", "clt processual"
  ],
  "Direito Administrativo": [
    "administração pública", "ato administrativo", "licitação", "lei 14.133", 
    "contrato administrativo", "poder de polícia", "poder hierárquico", "poder disciplinar", 
    "responsabilidade civil do estado", "serviço público", "agente público", 
    "improbidade administrativa", "bens públicos", "descentralização", "desconcentração", 
    "autarquia", "fundação pública", "empresa pública", "sociedade de economia mista"
  ],
  "Direito Constitucional": [
    "constituição federal", "direitos fundamentais", "direitos sociais", "nacionalidade", 
    "direitos políticos", "controle de constitucionalidade", "stf", "súmula vinculante", 
    "repercussão geral", "poder legislativo", "poder executivo", "poder judiciário", 
    "administração pública constitucional", "servidores públicos", "princípios fundamentais"
  ],
  "Direito Civil": [
    "lindb", "pessoa natural", "pessoa jurídica", "bens", "fatos jurídicos", 
    "atos jurídicos", "negócio jurídico", "prescrição", "decadência", "obrigações", 
    "contratos", "responsabilidade civil", "posse", "propriedade", "direitos reais"
  ],
  "Direito Processual Civil": [
    "cpc", "processo civil", "jurisdição", "ação", "competência", "partes", 
    "procuradores", "litisconsórcio", "intervenção de terceiros", "tutela provisória", 
    "provas", "sentença", "coisa julgada", "cumprimento de sentença", "execução", 
    "recursos", "agravo", "apelação", "mandado de segurança", "ação civil pública", 
    "ação popular"
  ],
  "Língua Portuguesa": [
    "ortografia", "acentuação", "crase", "concordância", "regência", "pontuação", 
    "classe de palavras", "substantivo", "adjetivo", "advérbio", "pronome", 
    "verbo", "preposição", "conjunção", "sintaxe", "oração", "coesão", 
    "coerência", "semântica", "interpretação de texto", "tipologia textual", 
    "funções da linguagem"
  ]
};

function detectSubjectForImportedFlashcard(front: string, back: string): string {
  const combinedText = `${front} ${back}`.toLowerCase();
  
  let bestSubject = "Revisão Geral TRT";
  let maxScore = 0;
  
  // Calculate scores for each subject based on word boundary matches
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      // Regex for Portuguese words, accounting for accents
      const regex = new RegExp(`(^|[^a-zA-Z0-9À-ÿ])${keyword}([^a-zA-Z0-9À-ÿ]|$)`, 'i');
      if (regex.test(combinedText)) {
        score++;
      }
    }
    
    if (score > maxScore) {
      maxScore = score;
      bestSubject = subject;
    }
  }
  
  return bestSubject;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();

    // 1. Get CSV file contents
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado. Por favor, envie um arquivo CSV." },
        { status: 400 }
      );
    }

    const textContent = await file.text();
    // Split lines by LF or CRLF
    const rawLines = textContent.split(/\r?\n/);
    
    // 2. Fetch existing subjects to map by name
    const dbSubjects = await prisma.studySubject.findMany({
      where: { userId }
    });

    const subjectMap: Record<string, string> = {};
    dbSubjects.forEach(s => {
      subjectMap[s.name] = s.id;
    });

    // Mapeamentos especiais
    // Se no DB chama "Língua Portuguesa" e nós classificamos como "Português", mapear para o ID de "Língua Portuguesa"
    if (subjectMap["Língua Portuguesa"]) {
      subjectMap["Português"] = subjectMap["Língua Portuguesa"];
    }

    // Garantir que a matéria de fallback "Revisão Geral TRT" existe
    let fallbackSubjectId = subjectMap["Revisão Geral TRT"];
    if (!fallbackSubjectId) {
      const createdFallback = await prisma.studySubject.create({
        data: {
          name: "Revisão Geral TRT",
          userId,
          examWeight: 1.0,
          priority: 1
        }
      });
      fallbackSubjectId = createdFallback.id;
      subjectMap["Revisão Geral TRT"] = fallbackSubjectId;
    }

    // 3. Fetch existing flashcards for deduplication
    const existingCards = await prisma.flashcard.findMany({
      where: { userId },
      select: { question: true, answer: true }
    });

    const existingKeys = new Set(
      existingCards.map(c => 
        `${normalizeFlashcardText(c.question)}|||${normalizeFlashcardText(c.answer)}`
      )
    );

    // Track import stats
    let importedCount = 0;
    let skippedDuplicatesCount = 0;
    let failedRowsCount = 0;
    
    const bySubjectStats: Record<string, number> = {
      "Direito do Trabalho": 0,
      "Direito Processual do Trabalho": 0,
      "Direito Administrativo": 0,
      "Direito Constitucional": 0,
      "Direito Civil": 0,
      "Direito Processual Civil": 0,
      "Língua Portuguesa": 0,
      "Revisão Geral TRT": 0
    };

    const cardsToCreate: any[] = [];
    const localDeduplicationKeys = new Set<string>();

    for (let index = 0; index < rawLines.length; index++) {
      const line = rawLines[index];
      if (!line.trim()) continue; // Skip empty lines

      const parsed = parseCSVRow(line);
      if (!parsed) {
        failedRowsCount++;
        continue;
      }

      const [front, back] = parsed;
      if (!front || !back) {
        failedRowsCount++;
        continue;
      }

      const normFront = normalizeFlashcardText(front);
      const normBack = normalizeFlashcardText(back);
      const normKey = `${normFront}|||${normBack}`;

      // Deduplication: check against existing db cards and local batch duplicates
      if (existingKeys.has(normKey) || localDeduplicationKeys.has(normKey)) {
        skippedDuplicatesCount++;
        continue;
      }

      // Detect subject
      const detectedSubjectName = detectSubjectForImportedFlashcard(front, back);
      
      // Resolve subject ID
      let subjectId = subjectMap[detectedSubjectName];
      if (!subjectId) {
        // Se a matéria classificada não existe no banco, tentar criar ou usar fallback
        // Para matérias oficiais do TRT, se não existirem, vamos criar
        try {
          const createdSubject = await prisma.studySubject.create({
            data: {
              name: detectedSubjectName,
              userId,
              examWeight: 1.0,
              priority: 1
            }
          });
          subjectId = createdSubject.id;
          subjectMap[detectedSubjectName] = subjectId;
        } catch {
          subjectId = fallbackSubjectId;
        }
      }

      // Add to batch create array
      cardsToCreate.push({
        userId,
        subjectId,
        question: front,
        answer: back,
        type: "QUESTION_ANSWER",
        difficulty: "MEDIUM",
        status: "APPROVED",
        reviewState: "NEW",
        learningStep: 0,
        easeFactor: 2.5,
        intervalDays: 0,
        repetitionCount: 0,
        lapseCount: 0,
        nextReviewAt: new Date(),
        lastReviewedAt: null,
        approvedAt: new Date()
      });

      localDeduplicationKeys.add(normKey);
      
      // Track statistics (map "Português" stats to "Língua Portuguesa")
      const statsKey = detectedSubjectName === "Português" ? "Língua Portuguesa" : detectedSubjectName;
      if (bySubjectStats[statsKey] !== undefined) {
        bySubjectStats[statsKey]++;
      } else {
        bySubjectStats[statsKey] = 1;
      }
      
      importedCount++;
    }

    // Save batch to database in a transaction
    if (cardsToCreate.length > 0) {
      await prisma.$transaction(
        cardsToCreate.map(card => 
          (prisma as any).flashcard.create({ data: card })
        )
      );
    }

    return NextResponse.json({
      imported: importedCount,
      skippedDuplicates: skippedDuplicatesCount,
      failedRows: failedRowsCount,
      bySubject: bySubjectStats
    });

  } catch (error: unknown) {
    console.error("Erro na importação de CSV:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: "Falha interna ao processar arquivo de importação.", details: err.message },
      { status: 500 }
    );
  }
}
