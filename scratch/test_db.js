const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Checking DB connection...");
    const userCount = await prisma.user.count();
    console.log("User count:", userCount);
    
    const materialCount = await prisma.studyMaterial.count();
    console.log("Material count:", materialCount);
    
    console.log("SUCCESS: DB is reachable.");
  } catch (error) {
    console.error("FAILURE: DB error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
