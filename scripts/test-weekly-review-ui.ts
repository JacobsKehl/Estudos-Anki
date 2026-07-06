import {
  suggestQuestionCount,
  mapSelectionReason,
  mapResultText,
  calculateProgress,
  distributeQuestionsAcrossTopics,
  mapSessionStatus,
  getStatusBadgeClasses,
  getResultBadgeClasses,
  formatDateBR,
  formatDateShort,
} from "../src/lib/weekly-review-ui";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function runTests() {
  console.log("=== Running Weekly Review UI Utility Pure Function Tests ===\n");

  // 1. suggestQuestionCount
  console.log("Testing suggestQuestionCount...");
  assert(suggestQuestionCount(15) === 5, "15 min should give 5 questions (floor)");
  assert(suggestQuestionCount(30) === 10, "30 min should give 10 questions");
  assert(suggestQuestionCount(60) === 20, "60 min should give 20 questions");
  assert(suggestQuestionCount(90) === 30, "90 min should give 30 questions");
  assert(suggestQuestionCount(120) === 40, "120 min should give 40 questions");
  assert(suggestQuestionCount(180) === 50, "180 min should give 50 questions (cap)");
  assert(suggestQuestionCount(5) === 5, "Too few minutes should stay at 5 questions");

  // 2. mapSelectionReason
  console.log("Testing mapSelectionReason...");
  assert(mapSelectionReason("WEEK_CONTENT") === "Conteúdo da semana", "WEEK_CONTENT mapping failed");
  assert(mapSelectionReason("OVERDUE") === "Pendente de revisão anterior", "OVERDUE mapping failed");
  assert(mapSelectionReason("LONG_UNSEEN") === "Longo tempo sem revisão", "LONG_UNSEEN mapping failed");

  // 3. mapResultText
  console.log("Testing mapResultText...");
  assert(mapResultText("PENDING") === "Pendente", "PENDING result mapping failed");
  assert(mapResultText("DID_WELL") === "Dominei bem", "DID_WELL result mapping failed");
  assert(mapResultText("HAD_DOUBTS") === "Tive dúvidas", "HAD_DOUBTS result mapping failed");
  assert(mapResultText("REVIEW_AGAIN") === "Revisar novamente", "REVIEW_AGAIN result mapping failed");

  // 4. calculateProgress
  console.log("Testing calculateProgress...");
  const prog1 = calculateProgress([]);
  assert(prog1.count === 0 && prog1.total === 0 && prog1.percent === 0, "Empty list progress failed");

  const prog2 = calculateProgress([
    { result: "PENDING" },
    { result: "DID_WELL" },
    { result: "PENDING" },
    { result: "HAD_DOUBTS" },
  ]);
  assert(prog2.count === 2, "Should count 2 graded topics");
  assert(prog2.total === 4, "Total should be 4");
  assert(prog2.percent === 50, "Percentage should be 50%");

  // 5. distributeQuestionsAcrossTopics
  console.log("Testing distributeQuestionsAcrossTopics...");
  const topics = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
  
  // Distribute 5 questions across 3 topics
  const dist1 = distributeQuestionsAcrossTopics(5, topics);
  assert(dist1["t1"] === 2, "t1 should get 2 questions");
  assert(dist1["t2"] === 2, "t2 should get 2 questions");
  assert(dist1["t3"] === 1, "t3 should get 1 question");
  assert(dist1["t1"] + dist1["t2"] + dist1["t3"] === 5, "Total sum should be exactly 5");

  // Distribute 0 questions
  const dist2 = distributeQuestionsAcrossTopics(0, topics);
  assert(Object.keys(dist2).length === 0, "0 target questions should return empty record");

  // Distribute 10 questions across 3 topics
  const dist3 = distributeQuestionsAcrossTopics(10, topics);
  assert(dist3["t1"] === 4, "t1 should get 4 questions");
  assert(dist3["t2"] === 3, "t2 should get 3 questions");
  assert(dist3["t3"] === 3, "t3 should get 3 questions");
  assert(dist3["t1"] + dist3["t2"] + dist3["t3"] === 10, "Total sum should be exactly 10");

  // 6. mapSessionStatus
  console.log("Testing mapSessionStatus...");
  assert(mapSessionStatus("PENDING") === "Pendente", "PENDING status mapping failed");
  assert(mapSessionStatus("IN_PROGRESS") === "Em andamento", "IN_PROGRESS status mapping failed");
  assert(mapSessionStatus("COMPLETED") === "Concluída", "COMPLETED status mapping failed");
  assert(mapSessionStatus("SKIPPED") === "Pulada", "SKIPPED status mapping failed");

  // 7. getStatusBadgeClasses
  console.log("Testing getStatusBadgeClasses...");
  assert(getStatusBadgeClasses("PENDING").includes("warning"), "PENDING classes failed");
  assert(getStatusBadgeClasses("IN_PROGRESS").includes("sage-light") || getStatusBadgeClasses("IN_PROGRESS").includes("accent"), "IN_PROGRESS classes failed");
  assert(getStatusBadgeClasses("COMPLETED").includes("success"), "COMPLETED classes failed");
  assert(getStatusBadgeClasses("SKIPPED").includes("muted"), "SKIPPED classes failed");

  // 8. getResultBadgeClasses
  console.log("Testing getResultBadgeClasses...");
  assert(getResultBadgeClasses("PENDING").includes("muted"), "PENDING result classes failed");
  assert(getResultBadgeClasses("DID_WELL").includes("success"), "DID_WELL result classes failed");
  assert(getResultBadgeClasses("HAD_DOUBTS").includes("warning"), "HAD_DOUBTS result classes failed");
  assert(getResultBadgeClasses("REVIEW_AGAIN").includes("error"), "REVIEW_AGAIN result classes failed");

  // 9. formatDateBR & formatDateShort
  console.log("Testing date formatting functions...");
  const testDate = "2026-07-06T12:00:00Z";
  assert(formatDateBR(testDate) === "06/07/2026", "formatDateBR failed");
  assert(formatDateShort(testDate) === "06/07", "formatDateShort failed");

  console.log("\n=== All UI Utility Pure Function Tests Passed Successfully! ===");
}

try {
  runTests();
} catch (e: any) {
  console.error("Test failed with error:", e.message);
  process.exit(1);
}
