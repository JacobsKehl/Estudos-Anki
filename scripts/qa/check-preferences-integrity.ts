import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== Testing UserPreferences Database Integrity ===");
  try {
    const users = await prisma.user.findMany({
      include: { preferences: true }
    });

    console.log(`Total users validated: ${users.length}`);

    let missingPrefs = 0;
    users.forEach(u => {
      if (!u.preferences) {
        console.error(`✗ ERROR: User ${u.email} (ID: ${u.id}) has NO preferences record!`);
        missingPrefs++;
      } else {
        console.log(`✓ User ${u.email} preferences verified successfully. Focus: "${u.preferences.focusArea}", Theme: "${u.preferences.theme}"`);
      }
    });

    if (missingPrefs === 0) {
      console.log("✓ SUCCESS: Database user preference consolidation is completely intact and aligned!");
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error("Preferences validation failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
