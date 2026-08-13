-- CreateTable
CREATE TABLE "SyllabusTopicMapping" (
    "id" TEXT NOT NULL,
    "v1TopicId" TEXT NOT NULL,
    "v2TopicId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusTopicMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyllabusTopicMapping_v1TopicId_idx" ON "SyllabusTopicMapping"("v1TopicId");

-- CreateIndex
CREATE INDEX "SyllabusTopicMapping_v2TopicId_idx" ON "SyllabusTopicMapping"("v2TopicId");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusTopicMapping_v1TopicId_v2TopicId_key" ON "SyllabusTopicMapping"("v1TopicId", "v2TopicId");

-- AddForeignKey
ALTER TABLE "SyllabusTopicMapping" ADD CONSTRAINT "SyllabusTopicMapping_v1TopicId_fkey" FOREIGN KEY ("v1TopicId") REFERENCES "SyllabusTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopicMapping" ADD CONSTRAINT "SyllabusTopicMapping_v2TopicId_fkey" FOREIGN KEY ("v2TopicId") REFERENCES "SyllabusTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
