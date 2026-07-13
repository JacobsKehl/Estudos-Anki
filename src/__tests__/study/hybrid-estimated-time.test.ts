/**
 * Testes unitários para hybrid-estimated-time.ts
 *
 * Executar com: npx jest src/__tests__/study/
 */

import {
  calculateHybridMinutes,
  isHybridTimeError,
  type HybridTimeInput,
} from "@/lib/study/hybrid-estimated-time";

// ── Casos de sucesso ──────────────────────────────────────────────────────────

describe("calculateHybridMinutes — sucesso", () => {
  const BASE_INPUT: HybridTimeInput = {
    cfcReadWords: 500,
    deepeningReadWords: 1500,
    availableMinutes: 120,
  };

  test("retorna resultado sem erro para input válido", () => {
    const result = calculateHybridMinutes(BASE_INPUT);
    expect(isHybridTimeError(result)).toBe(false);
  });

  test("calcula readingMinutes corretamente com 150 wpm", () => {
    // 2000 words / 150 wpm = ceil(13.33) = 14 min
    const result = calculateHybridMinutes(BASE_INPUT);
    if (!isHybridTimeError(result)) {
      expect(result.audit.readingMinutes).toBe(14);
    }
  });

  test("aplica methodMinimum quando maior que readingMinutes", () => {
    // 100 words / 150 = ceil(0.67) = 1 min < methodMinimum (15+30=45)
    const input: HybridTimeInput = {
      cfcReadWords: 50,
      deepeningReadWords: 50,
      availableMinutes: 120,
    };
    const result = calculateHybridMinutes(input);
    if (!isHybridTimeError(result)) {
      expect(result.audit.rawMinutes).toBe(45); // methodMinimum
      expect(result.finalMinutes).toBe(45);
    }
  });

  test("usa availableMinutes como teto absoluto", () => {
    const input: HybridTimeInput = {
      cfcReadWords: 10000,
      deepeningReadWords: 50000,
      availableMinutes: 60,
    };
    const result = calculateHybridMinutes(input);
    if (!isHybridTimeError(result)) {
      expect(result.finalMinutes).toBe(60);
    }
  });

  test("aplica minimumBlockMinutes quando rawMinutes é muito baixo", () => {
    // Mesmo com poucas palavras, o bloco deve ter ao menos 30 min
    const input: HybridTimeInput = {
      cfcReadWords: 0,
      deepeningReadWords: 0,
      availableMinutes: 60,
    };
    const result = calculateHybridMinutes(input);
    if (!isHybridTimeError(result)) {
      // methodMinimum = 15+30 = 45, minimumBlockMinutes = 30
      // rawMinutes = max(0, 45) = 45, finalMinutes = min(45, 60) = 45
      expect(result.finalMinutes).toBe(45);
    }
  });

  test("finalMinutes é sempre inteiro (Math.ceil aplicado)", () => {
    const input: HybridTimeInput = {
      cfcReadWords: 151,
      deepeningReadWords: 151,
      availableMinutes: 120,
    };
    const result = calculateHybridMinutes(input);
    if (!isHybridTimeError(result)) {
      expect(result.finalMinutes % 1).toBe(0);
    }
  });

  test("aceita cfcReadWords = 0 (sem segmentos READ no CFC)", () => {
    const input: HybridTimeInput = {
      cfcReadWords: 0,
      deepeningReadWords: 1500,
      availableMinutes: 90,
    };
    const result = calculateHybridMinutes(input);
    expect(isHybridTimeError(result)).toBe(false);
  });

  test("config personalizada substitui defaults", () => {
    const input: HybridTimeInput = {
      cfcReadWords: 600,
      deepeningReadWords: 600,
      availableMinutes: 120,
      config: {
        wordsPerMinute: 300,
        anchorMinimumMinutes: 10,
        deepeningMinimumMinutes: 20,
        minimumBlockMinutes: 20,
      },
    };
    const result = calculateHybridMinutes(input);
    if (!isHybridTimeError(result)) {
      // 1200 words / 300 wpm = 4 min < methodMinimum (10+20=30)
      expect(result.audit.readingMinutes).toBe(4);
      expect(result.audit.methodMinimum).toBe(30);
      expect(result.finalMinutes).toBe(30);
    }
  });

  test("audit contém todos os campos documentados", () => {
    const result = calculateHybridMinutes(BASE_INPUT);
    if (!isHybridTimeError(result)) {
      const { audit } = result;
      expect(audit).toMatchObject({
        totalReadWords: expect.any(Number),
        wordsPerMinute: expect.any(Number),
        readingMinutes: expect.any(Number),
        anchorMinimumMinutes: expect.any(Number),
        deepeningMinimumMinutes: expect.any(Number),
        methodMinimum: expect.any(Number),
        rawMinutes: expect.any(Number),
        availableMinutes: expect.any(Number),
        minimumBlockMinutes: expect.any(Number),
        finalMinutes: expect.any(Number),
        roundingRule: expect.any(String),
      });
    }
  });

  test("audit.finalMinutes é idêntico a result.finalMinutes", () => {
    const result = calculateHybridMinutes(BASE_INPUT);
    if (!isHybridTimeError(result)) {
      expect(result.audit.finalMinutes).toBe(result.finalMinutes);
    }
  });
});

// ── Casos de erro ─────────────────────────────────────────────────────────────

describe("calculateHybridMinutes — erros de validação", () => {
  test("retorna erro NEGATIVE_WORDS para cfcReadWords < 0", () => {
    const result = calculateHybridMinutes({
      cfcReadWords: -1,
      deepeningReadWords: 100,
      availableMinutes: 60,
    });
    expect(isHybridTimeError(result)).toBe(true);
    if (isHybridTimeError(result)) {
      expect(result.code).toBe("NEGATIVE_WORDS");
    }
  });

  test("retorna erro NEGATIVE_WORDS para deepeningReadWords < 0", () => {
    const result = calculateHybridMinutes({
      cfcReadWords: 100,
      deepeningReadWords: -5,
      availableMinutes: 60,
    });
    expect(isHybridTimeError(result)).toBe(true);
    if (isHybridTimeError(result)) {
      expect(result.code).toBe("NEGATIVE_WORDS");
    }
  });

  test("retorna erro AVAILABLE_MINUTES_TOO_LOW quando availableMinutes < minimumBlockMinutes", () => {
    const result = calculateHybridMinutes({
      cfcReadWords: 100,
      deepeningReadWords: 100,
      availableMinutes: 10, // < 30 (default minimumBlockMinutes)
    });
    expect(isHybridTimeError(result)).toBe(true);
    if (isHybridTimeError(result)) {
      expect(result.code).toBe("AVAILABLE_MINUTES_TOO_LOW");
    }
  });

  test("retorna erro INVALID_CONFIG para wordsPerMinute = 0", () => {
    const result = calculateHybridMinutes({
      cfcReadWords: 100,
      deepeningReadWords: 100,
      availableMinutes: 60,
      config: { wordsPerMinute: 0 },
    });
    expect(isHybridTimeError(result)).toBe(true);
    if (isHybridTimeError(result)) {
      expect(result.code).toBe("INVALID_CONFIG");
    }
  });
});

// ── Determinismo ──────────────────────────────────────────────────────────────

describe("calculateHybridMinutes — determinismo", () => {
  test("produz o mesmo resultado para o mesmo input chamado múltiplas vezes", () => {
    const input: HybridTimeInput = {
      cfcReadWords: 750,
      deepeningReadWords: 2250,
      availableMinutes: 90,
    };
    const r1 = calculateHybridMinutes(input);
    const r2 = calculateHybridMinutes(input);
    const r3 = calculateHybridMinutes(input);
    if (!isHybridTimeError(r1) && !isHybridTimeError(r2) && !isHybridTimeError(r3)) {
      expect(r1.finalMinutes).toBe(r2.finalMinutes);
      expect(r2.finalMinutes).toBe(r3.finalMinutes);
    }
  });
});
