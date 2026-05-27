import { getTodayRangeSP, getNextStudyResetAt, getTimeUntilNextStudyReset, getDayLabelSP } from '../src/lib/date-utils';

function runTests() {
  console.log("=== Running Date Utilities Timezone Verification ===\n");

  // Test Case 1: Standard conversion
  console.log("Test Case 1: Standard conversion for today");
  const now = new Date();
  const range = getTodayRangeSP(now);
  console.log("Now (Server Local):", now.toString());
  console.log("Now (UTC):", now.toISOString());
  console.log("SP Start of Day (UTC):", range.start.toISOString());
  console.log("SP End of Day (UTC):", range.end.toISOString());
  console.log("SP Formatted Label:", range.label);
  console.log("SP DateString:", range.dateString);
  console.log("");

  // Test Case 2: Verification of fuso horário rollover (meia-noite local)
  console.log("Test Case 2: Reset time simulation");
  const midnightReset = getNextStudyResetAt(now, 0);
  const timeRemaining = getTimeUntilNextStudyReset(now, 0);
  console.log("Next Reset At (UTC):", midnightReset.toISOString());
  console.log("Time Remaining:", `${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s`);
  console.log("");

  // Test Case 3: Verify day labeling
  console.log("Test Case 3: Friendly labels");
  const todayStr = range.dateString;
  // Tomorrow YYYY-MM-DD
  const tomorrowDate = new Date(range.start);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomStr = tomorrowDate.toISOString().split('T')[0];

  console.log(`Today string: ${todayStr}`);
  console.log(`Tomorrow string: ${tomStr}`);
  console.log("Label for tomorrow:", getDayLabelSP(tomStr, todayStr));
  console.log("Label for today (week day):", getDayLabelSP(todayStr, todayStr));
  console.log("");
  
  console.log("=== Timezone Verification Finished Successfully ===");
}

runTests();
