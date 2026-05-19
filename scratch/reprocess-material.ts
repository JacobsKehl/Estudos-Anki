import { prisma } from "../src/lib/prisma";
import dotenv from "dotenv";
dotenv.config();

import { identifySubject, detectStructure } from "../src/lib/ai/organizer";

async function main() {
  const mId = "cmpah8enm0001jj04623eqhn4"; // Direito Civil (1).pdf
  console.log(`Reprocessing material: ${mId}...`);

  const material = await prisma.studyMaterial.findUnique({
    where: { id: mId },
    include: {
      extractedContent: {
        orderBy: { pageNumber: "asc" }
      }
    }
  });

  if (!material) {
    console.error("Material not found!");
    return;
  }

  const sampleText = material.extractedContent
    .slice(0, 5)
    .map(p => p.text)
    .join("\n\n");

  console.log("1. Identifying Subject...");
  const idResult = await identifySubject(sampleText.substring(0, 3000), material.fileName);
  console.log("Subject Result:", idResult);

  console.log("2. Finding/Creating StudySubject...");
  let subject = await prisma.studySubject.findFirst({
    where: { userId: material.userId, name: { contains: idResult.subjectName } }
  });

  if (!subject) {
    console.log(`Creating subject: ${idResult.subjectName}`);
    subject = await prisma.studySubject.create({
      data: { name: idResult.subjectName, userId: material.userId, priority: 1 }
    });
  } else {
    console.log(`Reusing subject: ${subject.name} (${subject.id})`);
  }

  console.log("3. Detecting Structure...");
  const totalPages = material.totalPages || material.extractedContent.length;
  
  // Format pages text for structure detection
  const pageTexts = material.extractedContent.map(p => ({
    pageNumber: p.pageNumber,
    text: p.text
  }));

  const structure = await detectStructure(sampleText, totalPages, idResult.subjectName, pageTexts);
  console.log(`Structure detected with ${structure.blocks?.length || 0} blocks.`);

  console.log("4. Updating Material in DB...");
  await prisma.studyMaterial.update({
    where: { id: mId },
    data: {
      subjectId: subject.id,
      detectedSubjectName: idResult.subjectName,
      organizationStatus: "ORGANIZED",
      processingError: idResult.confidence < 0.5 ? `Baixa confiança na identificação da matéria (${idResult.confidence}).` : null
    }
  });

  // Re-create study blocks
  console.log("5. Saving Blocks...");
  // Clear old blocks
  await prisma.studyBlock.deleteMany({
    where: { materialId: mId }
  });

  if (structure.blocks && structure.blocks.length > 0) {
    for (const block of structure.blocks) {
      await prisma.studyBlock.create({
        data: {
          userId: material.userId,
          subjectId: subject.id,
          materialId: mId,
          title: block.title,
          description: block.description || "",
          pageStart: block.pageStart,
          pageEnd: block.pageEnd,
          estimatedStudyMinutes: block.estimatedStudyMinutes || 30,
          status: "NOT_STARTED"
        }
      });
    }
  }

  console.log("🎉 SUCCESS! Material successfully reprocessed and updated!");
}

main().catch(console.error);
