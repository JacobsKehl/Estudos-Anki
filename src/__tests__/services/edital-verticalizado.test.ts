/**
 * src/__tests__/services/edital-verticalizado.test.ts
 *
 * T22 — Etapa A do edital verticalizado dentro de Desempenho.
 *
 * Duas colunas paralelas, sem ligação entre elas (0/89 StudyBlock.officialTopicId
 * mapeados, ver docs/EDITAL-VERTICALIZADO-completude-2026-09-17.md): os tópicos
 * do edital (SyllabusTopic da versão ATIVA) e os capítulos dela (StudyBlock
 * escopados por CFC_FILE_NAMES). Mesma classe de bug do "48 de 189" (T19): sem
 * excluir theoryStatus EXCLUDED, os 100 blocos duplicados (P2) entrariam na
 * coluna direita.
 */
import { prisma } from "@/lib/prisma";
import { getEditalVerticalizadoPorMateria } from "@/lib/services/edital-verticalizado";
import { ORDEM_MATERIAS } from "@/lib/scheduler/config";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    syllabusVersion: { findFirst: jest.fn() },
    syllabusSubject: { findMany: jest.fn() },
    syllabusTopic: { findMany: jest.fn() },
    studyBlock: { findMany: jest.fn() },
  },
}));

const mockPrisma = prisma as jest.Mocked<any>;

function fiveSyllabusSubjects() {
  return [
    { canonicalKey: "DIREITO_ADMINISTRATIVO", displayName: "Direito Administrativo", weight: 1.2 },
    { canonicalKey: "DIREITO_CONSTITUCIONAL", displayName: "Direito Constitucional", weight: 1.2 },
    { canonicalKey: "DIREITO_TRABALHO", displayName: "Direito do Trabalho", weight: 2 },
    { canonicalKey: "DIREITO_PROCESSUAL_CIVIL", displayName: "Direito Processual Civil", weight: 1 },
    { canonicalKey: "DIREITO_PROCESSUAL_TRABALHO", displayName: "Direito Processual do Trabalho", weight: 2 },
  ];
}

describe("getEditalVerticalizadoPorMateria", () => {
  const userId = "user-edital-fixture";

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.syllabusVersion.findFirst.mockResolvedValue({ id: "trt4_v1" });
    mockPrisma.syllabusSubject.findMany.mockResolvedValue(fiveSyllabusSubjects());
    mockPrisma.syllabusTopic.findMany.mockResolvedValue([]);
    mockPrisma.studyBlock.findMany.mockResolvedValue([]);
  });

  it("busca SyllabusSubject/SyllabusTopic da versão ATIVA e só as 5 matérias de ORDEM_MATERIAS — não as 7 do banco (Português/Direito Civil ficam fora)", async () => {
    await getEditalVerticalizadoPorMateria(userId);

    expect(mockPrisma.syllabusSubject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { versionId: "trt4_v1", displayName: { in: [...ORDEM_MATERIAS] } },
      })
    );
    expect(mockPrisma.syllabusTopic.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { versionId: "trt4_v1", subjectName: { in: [...ORDEM_MATERIAS] } },
      })
    );

    const whereSubjects = mockPrisma.syllabusSubject.findMany.mock.calls[0][0].where;
    expect(whereSubjects.displayName.in).toHaveLength(5);
    expect(whereSubjects.displayName.in).not.toContain("Língua Portuguesa");
    expect(whereSubjects.displayName.in).not.toContain("Direito Civil");
  });

  it("consulta StudyBlock escopado por CFC_FILE_NAMES excluindo theoryStatus EXCLUDED — os 100 duplicados (P2) não entram na coluna do material", async () => {
    await getEditalVerticalizadoPorMateria(userId);

    expect(mockPrisma.studyBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          material: expect.objectContaining({
            originalFileName: expect.objectContaining({ in: expect.any(Array) }),
          }),
          theoryStatus: { not: "EXCLUDED" },
        }),
      })
    );
  });

  it("ordena as matérias por peso decrescente (2, 2, 1.2, 1.2, 1) — não alfabeticamente", async () => {
    const result = await getEditalVerticalizadoPorMateria(userId);

    expect(result).toHaveLength(5);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].weight).toBeGreaterThanOrEqual(result[i + 1].weight);
    }
    // Alfabeticamente "Direito Administrativo" viria primeiro; por peso, não.
    expect(result[0].displayName).not.toBe("Direito Administrativo");
    expect(result[0].weight).toBe(2);
  });

  it("nenhuma seção expõe ou calcula percentual de cobertura de tópico — as colunas são paralelas, não relacionadas", async () => {
    mockPrisma.syllabusTopic.findMany.mockResolvedValue([
      { subjectName: "Direito do Trabalho", topicCode: "Tópico 01", title: "X", orderIndex: 1 },
    ]);
    mockPrisma.studyBlock.findMany.mockResolvedValue([
      { id: "b1", title: "Y", pageStart: 1, pageEnd: 2, theoryStatus: "COMPLETED", subject: { name: "Direito do Trabalho" } },
    ]);

    const result = await getEditalVerticalizadoPorMateria(userId);

    const trabalho = result.find((s) => s.displayName === "Direito do Trabalho")!;
    expect(trabalho.topicsCount).toBe(1);
    expect(trabalho.chaptersCount).toBe(1);

    const coverageLikeKeys = Object.keys(trabalho).filter((k) => /coverage|cobertura|percent/i.test(k));
    expect(coverageLikeKeys).toEqual([]);
  });
});
