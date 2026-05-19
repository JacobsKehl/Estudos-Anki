const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const m = await prisma.studyMaterial.findUnique({
    where: { id: "cmpah8enm0001jj04623eqhn4" },
    include: { subject: true }
  });

  if (m) {
    console.log(`=== MATERIAL DETAILS ===`);
    console.log(`- File Name: ${m.fileName}`);
    console.log(`- Status: ${m.organizationStatus}`);
    console.log(`- Error: ${m.processingError || "None"}`);
    console.log(`- Subject: ${m.subject?.name || "None"}`);
    console.log(`- Detected Subject: ${m.detectedSubjectName || "None"}`);
    console.log(`- Updated At: ${m.updatedAt.toISOString()}`);
    console.log(`- Detected Structure: ${m.detectedStructure ? m.detectedStructure.substring(0, 500) : "None"}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
