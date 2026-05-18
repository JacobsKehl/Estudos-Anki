import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { identifySubject, detectStructure } from "@/lib/ai/organizer";
import { generateFlashcards } from "@/lib/ai/flashcards";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

interface PageContent {
  pageNumber: number;
  text: string;
}

// Cache do pdfjs para não reconfigurar o worker a cada chamada
let pdfjsCache: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;

async function getPdfjsLib() {
  if (pdfjsCache) return pdfjsCache;
  const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  lib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).href;
  pdfjsCache = lib;
  return lib;
}

async function extractAllPages(sourcePath: string): Promise<{ pages: PageContent[]; numPages: number }> {
  const pdfjsLib = await getPdfjsLib();
  
  // Download from Supabase Storage
  const { data, error } = await supabase.storage.from('materials').download(sourcePath);
  if (error) throw new Error(`Erro ao baixar arquivo do Storage: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  const pages: PageContent[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    let text = textContent.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    
    // Sanitize null bytes (\u0000) to prevent Postgres invalid byte sequence error
    text = text.replace(/\u0000/g, "");
    
    pages.push({ pageNumber: i, text });
  }

  return { pages, numPages };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Buscar o material e o usuário real
    const user = await prisma.user.findFirst();
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    const userId = user.id;

    const material = await prisma.studyMaterial.findFirst({
      where: { id, userId }
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });
    }

    // Não bloqueamos mais por sourceType pois todos estão no Supabase agora.

    // 2. Extrair parâmetros do corpo
    let mode = "general";
    try {
      const body = await req.json();
      if (body && body.mode) {
        mode = body.mode;
      }
    } catch (e) {
      // Ignora erro se não houver JSON no body, usando "general" como fallback
    }

    // ==========================================
    // MODO: APAGAR APENAS FLASHCARDS
    // ==========================================
    if (mode === "clear_flashcards") {
      await prisma.$transaction([
        prisma.flashcard.deleteMany({ where: { materialId: material.id } }),
        prisma.studyBlock.updateMany({
          where: { materialId: material.id },
          data: {
            flashcardsStatus: "NOT_STARTED",
            flashcardsGeneratedAt: null
          }
        })
      ]);

      return NextResponse.json({
        message: "Todos os flashcards deste material foram removidos com sucesso."
      });
    }

    // ==========================================
    // MODO: DESORGANIZAR CONTEÚDO (RESET COMPLETO)
    // ==========================================
    if (mode === "unorganize") {
      await prisma.$transaction([
        prisma.studyScheduleItem.deleteMany({
          where: {
            materialId: material.id,
            studyBlockId: { not: null }
          }
        }),
        prisma.flashcard.deleteMany({ where: { materialId: material.id } }),
        prisma.studyBlock.deleteMany({ where: { materialId: material.id } }),
        prisma.studyMaterial.update({
          where: { id: material.id },
          data: {
            organizationStatus: "IMPORTED",
            detectedStructure: null
          }
        })
      ]);

      return NextResponse.json({
        message: "Material desorganizado com sucesso! Blocos, flashcards e agendamentos foram removidos."
      });
    }

    // ==========================================
    // MODO: APENAS FLASHCARDS (GERAR PARA BLOCOS EXISTENTES)
    // ==========================================
    if (mode === "flashcards_only") {
      const blocks = await prisma.studyBlock.findMany({
        where: { materialId: material.id },
        orderBy: { orderIndex: "asc" }
      });

      if (blocks.length === 0) {
        return NextResponse.json({
          error: "Não existem blocos de estudo criados para este material. Por favor, organize o conteúdo primeiro."
        }, { status: 400 });
      }

      await prisma.studyMaterial.update({
        where: { id },
        data: { organizationStatus: "GENERATING_FLASHCARDS" }
      });

      // Extrair ou recuperar as páginas
      let extractedPages = await prisma.extractedContent.findMany({
        where: { materialId: material.id },
        orderBy: { pageNumber: "asc" }
      });

      if (extractedPages.length === 0) {
        const { pages } = await extractAllPages(material.sourcePath!);
        const nonEmptyPages = pages.filter(p => p.text.length > 10);
        
        await prisma.extractedContent.deleteMany({ where: { materialId: material.id } });
        
        const contentRecords = nonEmptyPages.map((p, idx) => ({
          userId,
          subjectId: material.subjectId || "",
          materialId: material.id,
          pageNumber: p.pageNumber,
          text: p.text,
          orderIndex: idx,
          estimatedStudyMinutes: 0
        }));

        await prisma.extractedContent.createMany({ data: contentRecords });
        extractedPages = await prisma.extractedContent.findMany({
          where: { materialId: material.id },
          orderBy: { pageNumber: "asc" }
        });
      }

      await prisma.flashcard.deleteMany({ where: { materialId: material.id } });

      let flashcardCount = 0;

      for (const block of blocks) {
        const blockPages = extractedPages.filter(p => p.pageNumber >= block.pageStart && p.pageNumber <= block.pageEnd);
        const blockText = blockPages.map(p => p.text).join("\n");

        if (blockText.trim().length >= 50) {
          try {
            const cards = await generateFlashcards(blockText.substring(0, 6000));
            if (cards && cards.length > 0) {
              const limitedCards = cards.slice(0, 15);
              const flashcardsData = limitedCards.map(card => ({
                userId,
                subjectId: block.subjectId,
                materialId: material.id,
                studyBlockId: block.id,
                question: card.question,
                answer: card.answer,
                type: card.type,
                difficulty: card.difficulty,
                status: "APPROVED",
                reviewState: "NEW",
                nextReviewAt: new Date(),
                approvedAt: new Date(),
                learningStep: 0,
                easeFactor: 2.5,
                intervalDays: 0,
                repetitionCount: 0,
                lapseCount: 0,
                sourcePageStart: block.pageStart,
                sourcePageEnd: block.pageEnd
              }));

              const createResult = await prisma.flashcard.createMany({ data: flashcardsData });
              flashcardCount += createResult.count;

              await prisma.studyBlock.update({
                where: { id: block.id },
                data: {
                  flashcardsStatus: "GENERATED",
                  flashcardsGeneratedAt: new Date()
                }
              });
            }
          } catch (flashErr: any) {
            console.error(`[Flashcards Only] Erro para bloco ${block.title}:`, flashErr.message);
            if (flashErr.message.includes("key was reported as leaked") || flashErr.message.includes("API key not valid")) {
              throw new Error("Sua chave de API do Gemini foi desativada pelo Google por motivo de vazamento em repositório público. Acesse o Google AI Studio, gere uma nova chave de API gratuita e atualize seu arquivo .env local!");
            }
            throw flashErr;
          }
        }
      }

      await prisma.studyMaterial.update({
        where: { id },
        data: { organizationStatus: "ORGANIZED" }
      });

      return NextResponse.json({
        message: `${flashcardCount} flashcards gerados com sucesso para os blocos existentes.`,
        flashcardsCount: flashcardCount
      });
    }

    // ==========================================
    // MODOS: GENERAL (COMPLETO) E CONTENT_ONLY (APENAS CONTEÚDO)
    // ==========================================
    
    // 1. ANTES DE TUDO: Limpeza e reset completo do material
    const existingSubjectId = material.subjectId;
    
    await prisma.$transaction([
      prisma.studyScheduleItem.deleteMany({
        where: { materialId: material.id }
      }),
      prisma.flashcard.deleteMany({
        where: { materialId: material.id }
      }),
      prisma.studyBlock.deleteMany({
        where: { materialId: material.id }
      }),
      prisma.studyMaterial.update({
        where: { id: material.id },
        data: {
          subjectId: null,
          detectedSubjectName: null,
          organizationStatus: "ANALYZING"
        }
      })
    ]);

    // Se a matéria ficou sem nenhum outro material associado, removemos ela também para evitar órfãs
    if (existingSubjectId) {
      const otherMaterialsCount = await prisma.studyMaterial.count({
        where: { subjectId: existingSubjectId, id: { not: material.id } }
      });
      if (otherMaterialsCount === 0) {
        try {
          await prisma.studyScheduleItem.deleteMany({ where: { subjectId: existingSubjectId } });
          await prisma.studySchedule.deleteMany({ where: { studySubjectId: existingSubjectId } });
          await prisma.studySubject.delete({ where: { id: existingSubjectId } });
          console.log(`[Reorganize] Matéria órfã ${existingSubjectId} removida com sucesso.`);
        } catch (subErr) {
          console.error("[Reorganize] Erro ao deletar matéria órfã:", subErr);
        }
      }
    }

    // 2. Extrair ou reutilizar as páginas extraídas (otimização extrema contra timeouts)
    let nonEmptyPages: PageContent[] = [];
    let numPages = material.totalPages || 0;

    const existingExtracted = await prisma.extractedContent.findMany({
      where: { materialId: material.id },
      orderBy: { pageNumber: "asc" }
    });

    if (existingExtracted.length > 0) {
      nonEmptyPages = existingExtracted.map(p => ({
        pageNumber: p.pageNumber,
        text: p.text
      }));
      console.log(`[Reorganize] Usando ${nonEmptyPages.length} páginas já extraídas em cache do banco de dados.`);
    } else {
      console.log(`[Reorganize] Extraindo páginas do zero do Supabase Storage...`);
      const { pages, numPages: parsedNumPages } = await extractAllPages(material.sourcePath!);
      numPages = parsedNumPages;
      nonEmptyPages = pages.filter(p => p.text.length > 10);

      if (nonEmptyPages.length === 0) {
        await prisma.studyMaterial.update({ 
          where: { id }, 
          data: { 
            organizationStatus: "ERROR", 
            processingError: "Texto insuficiente" 
          } 
        });
        return NextResponse.json({
          error: "Não foi possível extrair texto deste PDF. Ele pode ser uma imagem escaneada ou estar protegido."
        }, { status: 400 });
      }

      // Salvar as páginas extraídas no banco de dados para evitar re-processamento no futuro
      const contentRecords = nonEmptyPages.map((p, idx) => ({
        userId,
        subjectId: "", // Será atualizado após a identificação da matéria
        materialId: material.id,
        pageNumber: p.pageNumber,
        text: p.text,
        orderIndex: idx,
        estimatedStudyMinutes: 0, 
      }));
      await prisma.extractedContent.createMany({ data: contentRecords });
    }

    // 3. Identificar matéria
    let subjectId: string | null = null;
    const sampleText = nonEmptyPages
      .slice(0, Math.min(5, nonEmptyPages.length))
      .map(p => p.text)
      .join("\n\n");

    const idResult = await identifySubject(sampleText.substring(0, 3000), material.fileName);
    const detectedSubject = idResult.subjectName;

    let subject = await prisma.studySubject.findFirst({
      where: { userId, name: { contains: detectedSubject } }
    });

    if (!subject) {
      const allSubjects = await prisma.studySubject.findMany({ where: { userId } });
      subject = allSubjects.find(s => detectedSubject.includes(s.name)) ?? null;
    }

    if (!subject) {
      subject = await prisma.studySubject.create({
        data: { name: detectedSubject, userId, priority: 1 }
      });
    }

    subjectId = subject.id;
    
    // Atualiza o material com a matéria identificada
    await prisma.studyMaterial.update({
      where: { id: material.id },
      data: { 
        subjectId, 
        detectedSubjectName: detectedSubject,
        totalPages: numPages
      }
    });

    // Vincula todos os ExtractedContent deste material à matéria correta
    await prisma.extractedContent.updateMany({
      where: { materialId: material.id },
      data: { subjectId }
    });

    // 4. Detectar estrutura com IA
    const fullTextForStructure = nonEmptyPages
      .slice(0, 15)
      .map(p => p.text)
      .join("\n");

    const structResult = await detectStructure(fullTextForStructure, numPages, detectedSubject, nonEmptyPages);
    const materialRole = structResult.materialRole || "UNKNOWN";
    const detectedBlocks = structResult.blocks || [];

    if (!detectedBlocks || detectedBlocks.length === 0) {
      await prisma.studyMaterial.update({ where: { id }, data: { organizationStatus: "ERROR", processingError: "IA não detectou estrutura" } });
      return NextResponse.json({
        error: "Não conseguimos organizar este PDF. Nenhum bloco foi criado."
      }, { status: 400 });
    }

    let flashcardCount = 0;
    const shouldGenerateFlashcards = false;
    let createdBlocksCount = 0;

    if (materialRole === "SUPPORT_MATERIAL") {
      // Para material de apoio puro, não criamos StudyBlock principais.
      // Identificamos os tópicos suportados e criamos StudyBlockSupport se o bloco teórico correspondente já existir.
      for (const blockDef of detectedBlocks) {
        if (!blockDef.officialTopicId) continue;

        const existingBlock = await prisma.studyBlock.findFirst({
          where: { userId, subjectId: subjectId as string, officialTopicId: blockDef.officialTopicId }
        });

        if (existingBlock) {
          console.log(`Vinculando apoio ao bloco principal encontrado: ${existingBlock.title}`);
          await prisma.studyBlockSupport.create({
            data: {
              studyBlockId: existingBlock.id,
              materialId: material.id,
              pageStart: blockDef.pageStart,
              pageEnd: blockDef.pageEnd,
              supportType: blockDef.supportType || "QUESTIONS",
              confidence: blockDef.confidence || 0.8
            }
          });
        } else {
          // Bloco ainda não existe, marca o material para vincular no futuro
          console.log(`Bloco principal não encontrado para o tópico ${blockDef.officialTopicId}. Deixando pendente.`);
          await prisma.studyMaterial.update({
            where: { id: material.id },
            data: { supportForTopicId: blockDef.officialTopicId }
          });
          // Se houver múltiplos tópicos em um só material de apoio, salvamos a pendência do primeiro.
          break; 
        }
      }
    } else {
      // MAIN_MATERIAL ou MIXED_MATERIAL
      const mainBlocksCreated: Record<string, string> = {}; // Mapeia officialTopicId -> studyBlock.id criado nesta leva

      // Primeiro passo: criar todos os blocos principais teóricos (MAIN_BLOCK)
      for (let i = 0; i < detectedBlocks.length; i++) {
        const blockDef = detectedBlocks[i];
        if (blockDef.type === "SUPPORT_BLOCK") continue; // Processados no segundo passo

        const pageStart = blockDef.pageStart || 1;
        const pageEnd = blockDef.pageEnd || pageStart || 1;

        const studyBlock = await prisma.studyBlock.create({
          data: {
            userId,
            subjectId: subjectId as string,
            materialId: material.id,
            title: blockDef.title || `Parte ${i + 1}`,
            description: blockDef.description || "",
            pageStart,
            pageEnd,
            orderIndex: i,
            estimatedStudyMinutes: blockDef.estimatedStudyMinutes || 60,
            createdBy: blockDef.createdBy || "AI",
            confidence: blockDef.confidence ?? 1.0,
            sourceHeading: blockDef.sourceHeading,
            officialTopicId: blockDef.officialTopicId,
            officialTopicName: blockDef.officialTopicName,
            topicCode: blockDef.topicCode,
            status: "NOT_STARTED",
            theoryStatus: "NOT_STARTED",
            questionsStatus: "NOT_STARTED",
            flashcardsStatus: "NOT_STARTED",
            nextActionType: "THEORY"
          }
        });

        createdBlocksCount++;
        if (blockDef.officialTopicId) {
          mainBlocksCreated[blockDef.officialTopicId] = studyBlock.id;
        }

        // Vínculo retroativo: busca StudyMaterials (SUPPORT) pendentes para este tópico
        if (blockDef.officialTopicId) {
          const pendingSupports = await prisma.studyMaterial.findMany({
            where: {
              userId,
              subjectId: subjectId as string,
              materialRole: "SUPPORT_MATERIAL",
              supportForTopicId: blockDef.officialTopicId
            }
          });

          for (const ps of pendingSupports) {
            console.log(`[Relink Support] Vinculando material de apoio pendente (${ps.fileName}) ao novo bloco ${studyBlock.title}`);
            await prisma.studyBlockSupport.create({
              data: {
                studyBlockId: studyBlock.id,
                materialId: ps.id,
                supportType: "QUESTIONS", // Default para questões pendentes
                confidence: 1.0
              }
            });
            // Limpar a pendência para evitar links futuros desnecessários
            await prisma.studyMaterial.update({
              where: { id: ps.id },
              data: { supportForTopicId: null }
            });
          }
        }

        if (shouldGenerateFlashcards) {
          const blockPages = nonEmptyPages.filter(p => p.pageNumber >= pageStart && p.pageNumber <= pageEnd);
          const blockText = blockPages.map(p => p.text).join("\n");

          if (blockText.trim().length >= 50) {
            try {
              const cards = await generateFlashcards(blockText.substring(0, 6000));
              if (cards && cards.length > 0) {
                const limitedCards = cards.slice(0, 20); // strictly respect the new 20 limit!

                const flashcardsData = limitedCards.map(card => ({
                  userId,
                  subjectId: subjectId as string,
                  materialId: material.id,
                  studyBlockId: studyBlock.id,
                  question: card.question,
                  answer: card.answer,
                  type: card.type,
                  difficulty: card.difficulty,
                  status: "APPROVED",
                  reviewState: "NEW",       
                  nextReviewAt: new Date(),      
                  approvedAt: new Date(),        
                  learningStep: 0,
                  easeFactor: 2.5,
                  intervalDays: 0,
                  repetitionCount: 0,
                  lapseCount: 0,
                  sourcePageStart: pageStart,
                  sourcePageEnd: pageEnd,
                }));

                const createResult = await prisma.flashcard.createMany({
                  data: flashcardsData
                });

                flashcardCount += createResult.count;

                await prisma.studyBlock.update({
                  where: { id: studyBlock.id },
                  data: { 
                    flashcardsStatus: "GENERATED",
                    flashcardsGeneratedAt: new Date()
                  }
                });
              }
            } catch (flashErr: any) {
              console.error(`[Flashcards Reorganize] Erro para bloco ${studyBlock.title}:`, flashErr.message);
              if (flashErr.message.includes("key was reported as leaked") || flashErr.message.includes("API key not valid")) {
                throw new Error("Sua chave de API do Gemini foi desativada pelo Google por motivo de vazamento em repositório público. Acesse o Google AI Studio, gere uma nova chave de API gratuita e atualize seu arquivo .env local!");
              }
            }
          }
        }
      }

      // Segundo passo: criar blocos de apoio (SUPPORT_BLOCK) contidos no próprio PDF e vinculá-los aos blocos teóricos correspondentes
      for (let i = 0; i < detectedBlocks.length; i++) {
        const blockDef = detectedBlocks[i];
        if (blockDef.type !== "SUPPORT_BLOCK") continue;

        const pageStart = blockDef.pageStart || 1;
        const pageEnd = blockDef.pageEnd || pageStart;

        // Tenta achar bloco teórico criado na mesma leva
        let targetBlockId: string | null = null;
        if (blockDef.officialTopicId && mainBlocksCreated[blockDef.officialTopicId]) {
          targetBlockId = mainBlocksCreated[blockDef.officialTopicId];
        } else {
          // Tenta buscar no banco um bloco teórico já existente para o mesmo tópico
          const existingMainBlock = await prisma.studyBlock.findFirst({
            where: {
              userId,
              subjectId: subjectId as string,
              officialTopicId: blockDef.officialTopicId || undefined
            }
          });
          if (existingMainBlock) {
            targetBlockId = existingMainBlock.id;
          }
        }

        if (targetBlockId) {
          console.log(`[Mixed Support] Criando apoio p.${pageStart}-${pageEnd} do tipo ${blockDef.supportType || "OTHER"} no bloco ${targetBlockId}`);
          await prisma.studyBlockSupport.create({
            data: {
              studyBlockId: targetBlockId,
              materialId: material.id,
              pageStart,
              pageEnd,
              supportType: blockDef.supportType || "OTHER",
              confidence: blockDef.confidence || 0.8
            }
          });
        } else {
          console.log(`[Mixed Support] Bloco teórico principal não encontrado para o apoio do tópico ${blockDef.officialTopicId || "GERAL"}.`);
          // Fallback: Vincula ao primeiro bloco teórico do assunto para não perder o apoio
          const firstBlockOfSubject = await prisma.studyBlock.findFirst({
            where: { userId, subjectId: subjectId as string }
          });
          if (firstBlockOfSubject) {
            console.log(`[Mixed Support Fallback] Vinculando ao primeiro bloco do assunto: ${firstBlockOfSubject.title}`);
            await prisma.studyBlockSupport.create({
              data: {
                studyBlockId: firstBlockOfSubject.id,
                materialId: material.id,
                pageStart,
                pageEnd,
                supportType: blockDef.supportType || "OTHER",
                confidence: 0.5
              }
            });
          }
        }
      }
    }

    // 6. Atualizar status final do material
    await prisma.studyMaterial.update({
      where: { id },
      data: {
        organizationStatus: "ORGANIZED",
        detectedStructure: JSON.stringify(structResult),
        totalPages: numPages
      }
    });

    const successMessage = shouldGenerateFlashcards 
      ? `${createdBlocksCount} blocos de estudo criados e ${flashcardCount} flashcards importados com sucesso.`
      : `${createdBlocksCount} blocos de estudo criados com sucesso (sem flashcards).`;

    return NextResponse.json({
      message: successMessage,
      blocksCount: createdBlocksCount,
      flashcardsCount: flashcardCount
    });

  } catch (error: any) {
    console.error("[ORGANIZE SINGLE] Erro:", error);
    
    let userFriendlyError = error.message || "Falha ao organizar material";
    if (userFriendlyError.includes("key was reported as leaked") || userFriendlyError.includes("API key not valid")) {
      userFriendlyError = "Sua chave de API do Gemini foi desativada pelo Google por motivo de vazamento em repositório público. Acesse o Google AI Studio (aistudio.google.com), gere uma nova chave de API gratuita e atualize seu arquivo .env local!";
    }

    await prisma.studyMaterial.update({
      where: { id },
      data: { organizationStatus: "ERROR", processingError: userFriendlyError.substring(0, 250) }
    }).catch(() => {});

    return NextResponse.json({ error: userFriendlyError }, { status: 500 });
  }
}
