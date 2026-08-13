-- AlterTable
ALTER TABLE "StudyBlock" ADD COLUMN "officialTopicId" TEXT;

-- AddForeignKey
ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_officialTopicId_fkey" FOREIGN KEY ("officialTopicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
