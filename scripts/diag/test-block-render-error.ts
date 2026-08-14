import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

async function testQuery() {
  try {
    const sourceBlock = await prisma.studyBlock.findUnique({
      where: { id: "cmss35fow0007iyaoey50kzf4" },
      select: { title: true, officialTopicId: true, sourceV1BlockId: true }
    });
    console.log("Source block query:", sourceBlock);

    if (sourceBlock?.sourceV1BlockId) {
      const v1Block = await prisma.studyBlock.findUnique({
        where: { id: sourceBlock.sourceV1BlockId },
        select: { title: true, officialTopicId: true }
      });
      console.log("v1Block:", v1Block);

      if (v1Block?.officialTopicId) {
        const count = await prisma.syllabusTopicMapping.count({
          where: { v1TopicId: v1Block.officialTopicId }
        });
        console.log("syllabusTopicMapping count:", count);
      }
    }
  } catch (err) {
    console.error("Test query error:", err);
  }
}

testQuery().finally(() => prisma.$disconnect());
