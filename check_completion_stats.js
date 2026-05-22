const fs = require('fs');
const path = require('path');

// Load .env manually
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key && !key.startsWith('#')) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.error("Error loading .env file:", e);
}

// Let's use DIRECT_URL for prisma client query directly if pooler fails
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

console.log("Using DATABASE_URL:", process.env.DATABASE_URL);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const completedBlocks = await prisma.studyBlock.findMany({
    where: { status: 'COMPLETED' },
    select: { id: true, title: true }
  });

  const completedScheduleItems = await prisma.studyScheduleItem.findMany({
    where: { status: 'COMPLETED' },
    select: { id: true, studyBlockId: true, actionType: true, reason: true }
  });

  console.log('--- STATS ---');
  console.log(`Total StudyBlocks with status COMPLETED: ${completedBlocks.length}`);
  completedBlocks.forEach(b => console.log(` - Block: ${b.title} (${b.id})`));

  console.log(`Total StudyScheduleItems with status COMPLETED: ${completedScheduleItems.length}`);
  completedScheduleItems.forEach(item => {
    console.log(` - Item ID: ${item.id}, Block ID: ${item.studyBlockId}, Type: ${item.actionType}, Reason: ${item.reason}`);
  });
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
