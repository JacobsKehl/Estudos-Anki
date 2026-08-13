-- CreateEnum
CREATE TYPE "SchedulingStatus" AS ENUM ('ACTIVE', 'DEFERRED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "StudySubject" ADD COLUMN "schedulingStatus" "SchedulingStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "deferredUntil" TIMESTAMP(3);
