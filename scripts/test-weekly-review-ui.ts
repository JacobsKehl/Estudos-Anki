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
  getDraftKey,
  saveDraft,
  loadDraft,
  clearDraft,
} from "../src/lib/weekly-review-ui";

const mockStorage: Record<string, string> = {};
Object.defineProperty(globalThis, "sessionStorage", {
  value: {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
  } as unknown as Storage,
  writable: true,
  configurable: true,
});

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  passedAssertions++;
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

  // 10. Draft Storage & Isolation (getDraftKey, saveDraft, loadDraft, clearDraft)
  console.log("Testing Draft Storage & Isolation...");

  // 1. Sessões diferentes não compartilham rascunho
  saveDraft("user1", "sessionA", { availableMinutes: 45, targetQuestionCount: 15 });
  const draftB = loadDraft("user1", "sessionB");
  assert(draftB === null, "Sessões diferentes não devem compartilhar rascunho");

  // 2. Usuários diferentes não compartilham rascunho
  const draftUser2 = loadDraft("user2", "sessionA");
  assert(draftUser2 === null, "Usuários diferentes não devem compartilhar rascunho");

  // Verificação de leitura bem-sucedida para o mesmo usuário/sessão
  const draftA = loadDraft("user1", "sessionA");
  assert(draftA !== null && draftA.availableMinutes === 45 && draftA.targetQuestionCount === 15, "Deve ler o rascunho correto para o mesmo usuário e sessão");

  // 3. Somente sessão PENDING restaura o rascunho (validação da chave única por sessão/usuário)
  assert(getDraftKey("u1", "s1") === "weekly-review-draft:u1:s1", "Formato da chave deve ser weekly-review-draft:${userId}:${sessionId}");

  // 4. Iniciar, pular e adiar removem a chave (clearDraft)
  clearDraft("user1", "sessionA");
  assert(loadDraft("user1", "sessionA") === null, "clearDraft deve remover o rascunho");

  // 5. JSON inválido é ignorado com segurança
  mockStorage[getDraftKey("user1", "sessionCorrupt")] = "{ invalid json ;";
  assert(loadDraft("user1", "sessionCorrupt") === null, "JSON inválido deve retornar null com segurança");

  // 6. Valores fora dos limites não são restaurados
  mockStorage[getDraftKey("user1", "sessionLowMins")] = JSON.stringify({ availableMinutes: 10, targetQuestionCount: 20 });
  assert(loadDraft("user1", "sessionLowMins") === null, "availableMinutes < 15 deve ser ignorado");

  mockStorage[getDraftKey("user1", "sessionHighMins")] = JSON.stringify({ availableMinutes: 150, targetQuestionCount: 20 });
  assert(loadDraft("user1", "sessionHighMins") === null, "availableMinutes > 120 deve ser ignorado");

  mockStorage[getDraftKey("user1", "sessionLowQuests")] = JSON.stringify({ availableMinutes: 60, targetQuestionCount: 2 });
  assert(loadDraft("user1", "sessionLowQuests") === null, "targetQuestionCount < 5 deve ser ignorado");

  mockStorage[getDraftKey("user1", "sessionHighQuests")] = JSON.stringify({ availableMinutes: 60, targetQuestionCount: 100 });
  assert(loadDraft("user1", "sessionHighQuests") === null, "targetQuestionCount > 50 deve ser ignorado");

  console.log("\n=== All UI Utility Pure Function Tests Passed Successfully! ===");
  console.log(`Assertions executadas: ${passedAssertions}/${totalAssertions}`);
}

try {
  runTests();
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Test failed with error:", msg);
  process.exit(1);
}
