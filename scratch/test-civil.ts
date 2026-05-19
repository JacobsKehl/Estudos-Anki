import { prisma } from "../src/lib/prisma";
import { identifySubject } from "../src/lib/ai/organizer";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const m = await prisma.studyMaterial.findUnique({
    where: { id: "cmpah8enm0001jj04623eqhn4" },
    include: {
      extractedContent: {
        orderBy: { pageNumber: "asc" }
      }
    }
  });

  if (!m) {
    console.log("Material not found.");
    return;
  }

  // Pegar as 3 primeiras páginas de texto
  const samplePages = m.extractedContent.slice(0, 3).map(p => p.text).join("\n");
  console.log(`Sample content length: ${samplePages.length}`);
  console.log("Calling identifySubject directly...");
  
  try {
    const res = await identifySubject(samplePages, m.fileName);
    console.log("\nSUCCESS IDENTIFYING SUBJECT:");
    console.log(res);
  } catch (err: any) {
    console.error("\nERROR IDENTIFYING SUBJECT:");
    console.error(err);
  }
}

main().catch(console.error);
