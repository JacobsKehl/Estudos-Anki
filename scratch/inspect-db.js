const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.studyMaterial.findMany({
    where: {
      fileName: { contains: "7" }
    },
    orderBy: { createdAt: "desc" }
  });

  console.log("=== MATERIAL LIST ===");
  for (const m of materials) {
    console.log(`- ID: ${m.id}`);
    console.log(`  Title: ${m.title}`);
    console.log(`  File Name: ${m.fileName}`);
    console.log(`  Source Path: ${m.sourcePath}`);
    console.log(`  Status: ${m.organizationStatus}`);
    console.log(`  Error: ${m.processingError || "None"}`);
    console.log(`  Detected structure: ${m.detectedStructure ? "Yes" : "No"}`);
    console.log("------------------------");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
