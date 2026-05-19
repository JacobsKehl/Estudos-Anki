import { prisma } from "../src/lib/prisma";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const mId = "cmpah8enm0001jj04623eqhn4";
  console.log(`Inspecting material ID: ${mId}`);
  
  const m = await prisma.studyMaterial.findUnique({
    where: { id: mId },
    include: {
      subject: true,
      extractedContent: {
        orderBy: { pageNumber: "asc" }
      }
    }
  });

  if (!m) {
    console.log("Material not found in database.");
    return;
  }

  console.log("\n=== MATERIAL INFO ===");
  console.log(`File Name: ${m.fileName}`);
  console.log(`Status: ${m.organizationStatus}`);
  console.log(`Subject: ${m.subject?.name || "None"}`);
  console.log(`Detected Subject Name: ${m.detectedSubjectName || "None"}`);
  console.log(`Processing Error: ${m.processingError || "None"}`);
  console.log(`Total Extracted Pages: ${m.extractedContent.length}`);
  
  if (m.extractedContent.length > 0) {
    console.log("\n=== EXTRACTED CONTENT PAGES ===");
    for (const page of m.extractedContent.slice(0, 3)) {
      console.log(`Page ${page.pageNumber} (length: ${page.text.length}):`);
      console.log(`Content Preview: "${page.text.substring(0, 200).replace(/\n/g, " ")}..."`);
    }
  } else {
    console.log("WARNING: NO EXTRACTED CONTENT FOR THIS MATERIAL!");
  }
}

main().catch(console.error);
