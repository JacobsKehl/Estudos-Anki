import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== Testing Schedule Overload & Distribution ===");
  try {
    const items = await (prisma as any).studyScheduleItem.findMany({
      where: {
        status: "PENDING",
        scheduledDate: { not: null }
      }
    });

    console.log(`Total active pending scheduled items: ${items.length}`);

    // Group items by scheduledDate day to see daily loads
    const dailyCounts: Record<string, number> = {};
    const dailyMinutes: Record<string, number> = {};

    items.forEach((item: any) => {
      const dateStr = item.scheduledDate.toISOString().split('T')[0];
      dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
      dailyMinutes[dateStr] = (dailyMinutes[dateStr] || 0) + (item.estimatedMinutes || 0);
    });

    const dates = Object.keys(dailyCounts).sort();
    console.log(`Scheduled days count: ${dates.length}`);

    let overloadedDays = 0;
    const maxThresholdMinutes = 300; // 5 hours max study recommendation per day

    dates.forEach(date => {
      const count = dailyCounts[date];
      const mins = dailyMinutes[date];
      console.log(`  * Date: ${date} -> Items count: ${count}, Estimated minutes: ${mins} mins`);
      
      if (mins > maxThresholdMinutes) {
        console.warn(`    ⚠️ WARNING: Day ${date} has a high study load: ${mins} mins`);
        overloadedDays++;
      }
    });

    if (overloadedDays === 0) {
      console.log("✓ SUCCESS: Schedule load is evenly balanced with no daily overloading (>300 mins) detected.");
    } else {
      console.log(`⚠ INFO: Detected ${overloadedDays} days with heavy study load. Check if study priority needs adjustment.`);
    }

  } catch (err) {
    console.error("Schedule overload check failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
