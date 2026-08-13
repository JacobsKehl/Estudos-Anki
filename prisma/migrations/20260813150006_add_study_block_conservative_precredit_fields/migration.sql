-- AlterTable
ALTER TABLE "StudyBlock" ADD COLUMN "possiblyAlreadyStudied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sourceV1BlockId" TEXT;
