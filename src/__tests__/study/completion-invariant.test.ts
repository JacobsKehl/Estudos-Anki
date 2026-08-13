import { Prisma } from "@prisma/client";
import { completeStudyBlock, reopenStudyBlock } from "@/lib/study/completion";

describe("StudyBlock Completion Invariant Tests", () => {
  it("deve garantir que o modelo StudyBlock usa theoryStatus como fonte única de verdade", () => {
    // Verificar em nível de tipos do Prisma que 'status' não existe mais em StudyBlock
    const dmmf = Prisma.dmmf.datamodel;
    const studyBlockModel = dmmf.models.find((m) => m.name === "StudyBlock");
    expect(studyBlockModel).toBeDefined();

    const statusField = studyBlockModel?.fields.find((f) => f.name === "status");
    expect(statusField).toBeUndefined(); // Garante que a coluna 'status' foi fisicamente removida

    const theoryStatusField = studyBlockModel?.fields.find((f) => f.name === "theoryStatus");
    expect(theoryStatusField).toBeDefined(); // Garante que 'theoryStatus' é a autoridade
  });
});
