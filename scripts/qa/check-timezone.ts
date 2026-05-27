import { getTodayRangeSP, getNextStudyResetAt } from '../../src/lib/date-utils';

function testTimezone() {
  console.log("=== Testing Timezone America/Sao_Paulo Helper ===");

  const now = new Date();
  const range = getTodayRangeSP(now);
  const resetAt = getNextStudyResetAt(now, 0);

  console.log(`Current Time (UTC): ${now.toISOString()}`);
  console.log(`SP Today Range Start (UTC): ${range.start.toISOString()}`);
  console.log(`SP Today Range End (UTC): ${range.end.toISOString()}`);
  console.log(`SP Label: ${range.label}`);
  console.log(`SP DateString: ${range.dateString}`);
  console.log(`SP Next Midnight Reset (UTC): ${resetAt.toISOString()}`);

  const startHourInSP = range.start.getUTCHours();
  // Sao Paulo offset is normally UTC-3, meaning 00:00 local is 03:00 UTC (offset = 3)
  // Let's assert that the calculated range is correct (offset matches getUTCHours)
  const isStartCorrect = startHourInSP >= 2 && startHourInSP <= 4;
  
  if (isStartCorrect) {
    console.log("✓ SUCCESS: Timezone calculations align with dynamic Sao Paulo fuso horário!");
  } else {
    console.error("✗ FAILED: Timezone start hours are out of expected range.");
    process.exit(1);
  }
}

testTimezone();
