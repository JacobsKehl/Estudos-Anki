const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Testing Prisma connection with password in .env...");
    const userCount = await prisma.user.count();
    console.log("Prisma connection successful! Total users:", userCount);
  } catch (err) {
    console.error("Prisma connection failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
