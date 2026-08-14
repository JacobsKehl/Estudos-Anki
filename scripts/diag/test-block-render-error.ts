import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  const mockUserId = gabriela?.id;

  const id = "cmss35fow0007iyaoey50kzf4";

  const block = await (prisma as any).studyBlock.findUnique({
    where: { id },
    include: {
      subject: true,
      material: true,
      supportMaterials: { include: { material: true } },
      sources: {
        include: {
          material: true,
          segments: true
        }
      },
      _count: {
        select: {
          flashcards: true
        }
      },
      flashcards: {
        where: { userId: mockUserId },
        select: {
          id: true,
          question: true,
          answer: true,
          type: true,
          difficulty: true,
          status: true
        }
      }
    }
  });

  console.log("Block query result:", !!block);

  let sourceV1Info: { sourceTitle: string; totalV2Topics: number } | null = null;
  if (block?.possiblyAlreadyStudied && block.sourceV1BlockId) {
    const sourceBlock = await prisma.studyBlock.findUnique({
      where: { id: block.sourceV1BlockId },
      select: { title: true, officialTopicId: true }
    });

    if (sourceBlock) {
      let v2Count = 1;
      if (sourceBlock.officialTopicId) {
        v2Count = await prisma.syllabusTopicMapping.count({
          where: { v1TopicId: sourceBlock.officialTopicId }
        });
      }
      sourceV1Info = {
        sourceTitle: sourceBlock.title,
        totalV2Topics: Math.max(v2Count, 1)
      };
    }
  }

  console.log("sourceV1Info:", sourceV1Info);
}

main().catch(console.error).finally(() => prisma.$disconnect());
