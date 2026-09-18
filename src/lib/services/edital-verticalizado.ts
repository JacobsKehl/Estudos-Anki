import { prisma } from "@/lib/prisma";
import { CFC_FILE_NAMES, ORDEM_MATERIAS } from "@/lib/scheduler/config";

export interface EditalTopicRow {
  topicCode: string;
  title: string;
  orderIndex: number;
}

export interface MaterialChapterRow {
  id: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  theoryStatus: string;
}

export interface EditalSubjectSection {
  canonicalKey: string;
  displayName: string;
  weight: number;
  topics: EditalTopicRow[];
  topicsCount: number;
  chapters: MaterialChapterRow[];
  chaptersCount: number;
  chaptersStudiedCount: number;
}

/**
 * Etapa A do edital verticalizado (T22): as duas colunas lado a lado, sem
 * ligação entre elas — não existe mapeamento capítulo→tópico ainda (0/89
 * StudyBlock.officialTopicId, ver T21). Paralelas até a etapa B existir.
 *
 * Escopo das 5 matérias: ORDEM_MATERIAS/CFC_FILE_NAMES (src/lib/scheduler/config.ts),
 * a mesma fonte única do agendador/guardião/métricas — nunca studyPriority/materialRole.
 *
 * Coluna esquerda (edital): SyllabusTopic da SyllabusVersion ATIVA.
 * Coluna direita (material dela): StudyBlock com material.originalFileName em
 * CFC_FILE_NAMES e theoryStatus != EXCLUDED (os 100 duplicados do P2 não entram).
 *
 * O join entre as duas colunas é por nome de matéria (SyllabusSubject.displayName
 * === StudySubject.name === ORDEM_MATERIAS), porque StudySubject não tem FK para
 * SyllabusSubject ainda — é o único vínculo que o modelo de dados oferece hoje.
 * Verificado em produção (17/09/2026): os 5 nomes batem exatamente dos dois lados.
 */
export async function getEditalVerticalizadoPorMateria(userId: string): Promise<EditalSubjectSection[]> {
  const activeVersion = await prisma.syllabusVersion.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  if (!activeVersion) return [];

  const materiaNames = [...ORDEM_MATERIAS];

  const [syllabusSubjects, topics, cfcBlocks] = await Promise.all([
    prisma.syllabusSubject.findMany({
      where: { versionId: activeVersion.id, displayName: { in: materiaNames } },
      select: { canonicalKey: true, displayName: true, weight: true },
    }),
    prisma.syllabusTopic.findMany({
      where: { versionId: activeVersion.id, subjectName: { in: materiaNames } },
      select: { subjectName: true, topicCode: true, title: true, orderIndex: true },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.studyBlock.findMany({
      where: {
        userId,
        material: { originalFileName: { in: [...CFC_FILE_NAMES] } },
        theoryStatus: { not: "EXCLUDED" },
      },
      select: {
        id: true,
        title: true,
        pageStart: true,
        pageEnd: true,
        theoryStatus: true,
        subject: { select: { name: true } },
      },
      orderBy: { pageStart: "asc" },
    }),
  ]);

  return syllabusSubjects
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .map((s) => {
      const sectionTopics = topics
        .filter((t) => t.subjectName === s.displayName)
        .map((t) => ({ topicCode: t.topicCode, title: t.title, orderIndex: t.orderIndex }));

      const sectionChapters = cfcBlocks
        .filter((b) => b.subject.name === s.displayName)
        .map((b) => ({
          id: b.id,
          title: b.title,
          pageStart: b.pageStart,
          pageEnd: b.pageEnd,
          theoryStatus: b.theoryStatus,
        }));

      return {
        canonicalKey: s.canonicalKey,
        displayName: s.displayName,
        weight: s.weight,
        topics: sectionTopics,
        topicsCount: sectionTopics.length,
        chapters: sectionChapters,
        chaptersCount: sectionChapters.length,
        chaptersStudiedCount: sectionChapters.filter((c) => c.theoryStatus === "COMPLETED").length,
      };
    });
}
