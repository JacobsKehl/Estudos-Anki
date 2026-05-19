import { prisma } from "../src/lib/prisma";
import dotenv from "dotenv";
dotenv.config();

// We will simulate processMaterial step-by-step
import { identifySubject, detectStructure } from "../src/lib/ai/organizer";

async function main() {
  const mId = "cmpafftfq0001l504ignzjk8h"; // direito administrativo 1.pdf
  console.log(`Processing material ID: ${mId}`);

  const material = await prisma.studyMaterial.findUnique({
    where: { id: mId },
    include: {
      extractedContent: {
        orderBy: { pageNumber: "asc" }
      }
    }
  });

  if (!material) {
    console.log("Material not found.");
    return;
  }

  console.log(`File Name: ${material.fileName}`);
  console.log(`Extracted pages count: ${material.extractedContent.length}`);

  const sampleText = material.extractedContent
    .slice(0, 5)
    .map(p => p.text)
    .join("\n\n");

  console.log(`Sample text length: ${sampleText.length}`);
  console.log("Calling identifySubject...");
  
  try {
    const idResult = await identifySubject(sampleText.substring(0, 3000), material.fileName);
    console.log("Subject Identification Result:", idResult);
  } catch (err: any) {
    console.error("Error in identifySubject:", err);
  }
}

main().catch(console.error);
