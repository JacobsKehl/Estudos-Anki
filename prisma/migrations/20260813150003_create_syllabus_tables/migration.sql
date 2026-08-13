-- CreateTable
CREATE TABLE "SyllabusVersion" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusSubject" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "blocoConhecimento" TEXT,
    "questoesDaMateria" INTEGER,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusTopic" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "subjectCanonicalKey" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "topicCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusVersion_label_key" ON "SyllabusVersion"("label");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusVersion_single_active" ON "SyllabusVersion"("isActive") WHERE "isActive" = true;

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusSubject_versionId_canonicalKey_key" ON "SyllabusSubject"("versionId", "canonicalKey");

-- CreateIndex
CREATE INDEX "SyllabusTopic_versionId_idx" ON "SyllabusTopic"("versionId");

-- CreateIndex
CREATE INDEX "SyllabusTopic_subjectCanonicalKey_idx" ON "SyllabusTopic"("subjectCanonicalKey");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusTopic_versionId_topicCode_key" ON "SyllabusTopic"("versionId", "topicCode");

-- AddForeignKey
ALTER TABLE "SyllabusSubject" ADD CONSTRAINT "SyllabusSubject_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_versionId_subjectCanonicalKey_fkey" FOREIGN KEY ("versionId", "subjectCanonicalKey") REFERENCES "SyllabusSubject"("versionId", "canonicalKey") ON DELETE RESTRICT ON UPDATE CASCADE;
