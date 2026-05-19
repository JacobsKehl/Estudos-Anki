import { prisma } from "../src/lib/prisma";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  console.log("Querying 5 most recently updated materials...");
  const materials = await prisma.studyMaterial.findMany({
    take: 5,
    orderBy: { updatedAt: "desc" },
    include: { subject: true }
  });

  for (const m of materials) {
    console.log(`\n- File: ${m.fileName}`);
    console.log(`  ID: ${m.id}`);
    console.log(`  Status: ${m.organizationStatus}`);
    console.log(`  Subject: ${m.subject?.name || "None"}`);
    console.log(`  Detected Subject: ${m.detectedSubjectName || "None"}`);
    console.log(`  Error: ${m.processingError || "None"}`);
    console.log(`  Updated At: ${m.updatedAt.toISOString()}`);
  }
}

main().catch(console.error);
