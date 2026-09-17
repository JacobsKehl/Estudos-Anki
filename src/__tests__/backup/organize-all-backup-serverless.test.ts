/**
 * src/__tests__/backup/organize-all-backup-serverless.test.ts
 *
 * P7 / T11 (auditoria 17/09): createPreOrganizeAllBackup grava em
 * process.cwd()/backups/json, com fallback silencioso para /tmp quando o
 * primeiro mkdir falha. Na Vercel o filesystem fora de /tmp é somente
 * leitura, então o catch SEMPRE dispara — o arquivo é escrito em /tmp,
 * passa a asserção de existência/tamanho, o log diz SUCESSO, e morre com o
 * container quando a invocação termina. É um backup que mente: parece ter
 * funcionado e nunca é recuperável.
 *
 * O conserto é falhar alto em vez de mentir baixo: em ambiente serverless
 * (process.env.VERCEL === "1"), a função deve lançar ANTES de qualquer
 * gravação, nunca cair para /tmp.
 */
import { prisma } from "@/lib/prisma";
import { createPreOrganizeAllBackup } from "@/lib/backup/organize-all-backup";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    studyBlock: { count: jest.fn(), findMany: jest.fn() },
    studyScheduleItem: { count: jest.fn(), findMany: jest.fn() },
    flashcard: { count: jest.fn(), findMany: jest.fn() },
    flashcardReview: { count: jest.fn(), findMany: jest.fn() },
    studySchedule: { count: jest.fn(), findMany: jest.fn() },
    studySubject: { count: jest.fn(), findMany: jest.fn() },
    studyMaterial: { count: jest.fn(), findMany: jest.fn() },
  },
}));

const mockPrisma = prisma as jest.Mocked<any>;

describe("createPreOrganizeAllBackup — não pode mentir em ambiente serverless", () => {
  const userId = "user-backup-fixture";
  const originalVercelEnv = process.env.VERCEL;

  beforeEach(() => {
    jest.clearAllMocks();

    for (const model of [
      mockPrisma.studyBlock,
      mockPrisma.studyScheduleItem,
      mockPrisma.flashcard,
      mockPrisma.flashcardReview,
      mockPrisma.studySchedule,
      mockPrisma.studySubject,
      mockPrisma.studyMaterial,
    ]) {
      model.count.mockResolvedValue(0);
      model.findMany.mockResolvedValue([]);
    }
  });

  afterEach(() => {
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercelEnv;
    }
  });

  it('lança ANTES de gravar qualquer arquivo quando process.env.VERCEL === "1"', async () => {
    process.env.VERCEL = "1";

    await expect(createPreOrganizeAllBackup(userId)).rejects.toThrow(/serverless/i);
  });

  it('a mensagem de erro em ambiente serverless explica POR QUE (filesystem efêmero), não só QUE falhou', async () => {
    process.env.VERCEL = "1";

    await expect(createPreOrganizeAllBackup(userId)).rejects.toThrow(/efêmero|container/i);
  });
});
