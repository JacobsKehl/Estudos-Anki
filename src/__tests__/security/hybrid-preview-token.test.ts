/**
 * Testes unitários para hybrid-preview-token.ts
 *
 * Executar com: npx jest src/__tests__/security/
 */

import {
  generatePreviewToken,
  validatePreviewToken,
  verifyPreviewIntegrity,
  computePreviewHash,
} from "@/lib/security/hybrid-preview-token";

// ── Setup do ambiente de teste ────────────────────────────────────────────────

const MOCK_SECRET = "test-secret-must-be-at-least-32-characters-long-for-security";

beforeEach(() => {
  process.env.HYBRID_PREVIEW_SIGNING_SECRET = MOCK_SECRET;
});

afterEach(() => {
  delete process.env.HYBRID_PREVIEW_SIGNING_SECRET;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockPreview = {
  generationRunId: "run-123",
  subject: "Direito do Trabalho",
  title: "Rescisão Contratual",
  methodology: "HYBRID_8020",
  confidence: 0.85,
  warnings: [],
  blockingWarnings: [],
  sources: [
    {
      materialId: "mat-cfc-1",
      sourceRole: "ANCHOR_8020",
      isCanonical: false,
      segments: [{ disposition: "READ", pageStart: 1, pageEnd: 5, reason: "Âncora CFC" }],
    },
    {
      materialId: "mat-strat-1",
      sourceRole: "DEEPENING",
      isCanonical: true,
      segments: [{ disposition: "READ", pageStart: 10, pageEnd: 20, reason: "Aprofundamento" }],
    },
  ],
  fccFocusPoints: ["Ponto 1", "Ponto 2"],
  flashcardSeeds: [],
  aiAuditMetadata: {
    provider: "gemini",
    modelUsed: "gemini-pro",
    promptVersion: "v1.0.0",
    generatedAt: "2025-01-01T00:00:00.000Z",
    generationRunId: "run-123",
    confidence: 0.85,
    warnings: [],
    blockingWarnings: [],
    batchConfig: {
      maxInputTokensPerBatch: 12000,
      maxCharactersPerBatch: 50000,
      maxPagesPerBatch: 12,
    },
    analyzedScope: {
      cfcMaterialId: "mat-cfc-1",
      cfcPageRanges: [{ pageStart: 1, pageEnd: 30 }],
      deepeningMaterials: [{ materialId: "mat-strat-1", pageRanges: [{ pageStart: 1, pageEnd: 100 }] }],
    },
    sourceFingerprintCfc: "cfc-hash",
    sourceFingerprintsDeepening: [{ materialId: "mat-strat-1", fingerprint: "strat-hash" }],
    justification: { anchorChoice: "CFC selecionado", deepeningChoice: "Estratégia selecionado" },
  },
};

const defaultParams = {
  userId: "user-abc",
  subjectId: "subject-xyz",
  generationRunId: "run-123",
  preview: mockPreview,
};

// ── Geração ───────────────────────────────────────────────────────────────────

describe("generatePreviewToken", () => {
  test("retorna uma string base64url não vazia", () => {
    const token = generatePreviewToken(defaultParams);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  test("não inclui caracteres base64 inválidos (+, /, =)", () => {
    const token = generatePreviewToken(defaultParams);
    expect(token).not.toMatch(/[+/=]/);
  });

  test("tokens gerados para o mesmo input podem diferir em issuedAt (tempo real)", () => {
    const t1 = generatePreviewToken(defaultParams);
    const t2 = generatePreviewToken(defaultParams);
    // Com timestamps diferentes, os tokens devem ser diferentes
    // (se ocorrerem no mesmo milissegundo, podem ser iguais — aceitável)
    expect(typeof t1).toBe("string");
    expect(typeof t2).toBe("string");
  });

  test("falha explicitamente quando a variável de ambiente está ausente", () => {
    delete process.env.HYBRID_PREVIEW_SIGNING_SECRET;
    expect(() => generatePreviewToken(defaultParams)).toThrow("HYBRID_PREVIEW_SIGNING_SECRET");
  });
});

// ── Validação ─────────────────────────────────────────────────────────────────

describe("validatePreviewToken", () => {
  test("token válido retorna { valid: true } com payload correto", () => {
    const token = generatePreviewToken(defaultParams);
    const result = validatePreviewToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.userId).toBe("user-abc");
      expect(result.payload.subjectId).toBe("subject-xyz");
      expect(result.payload.generationRunId).toBe("run-123");
      expect(result.payload.previewHash).toBeTruthy();
      expect(result.payload.issuedAt).toBeGreaterThan(0);
      expect(result.payload.expiresAt).toBeGreaterThan(result.payload.issuedAt);
    }
  });

  test("token com assinatura adulterada retorna { valid: false }", () => {
    const token = generatePreviewToken(defaultParams);
    const tampered = token.slice(0, -4) + "aaaa"; // alterar últimos bytes
    const result = validatePreviewToken(tampered);
    expect(result.valid).toBe(false);
  });

  test("string aleatória retorna { valid: false }", () => {
    const result = validatePreviewToken("not-a-token-at-all");
    expect(result.valid).toBe(false);
  });

  test("string vazia retorna { valid: false }", () => {
    const result = validatePreviewToken("");
    expect(result.valid).toBe(false);
  });

  test("token expirado retorna { valid: false }", () => {
    // Simular token com expiresAt no passado
    const expiredToken = forgeExpiredToken(defaultParams);
    const result = validatePreviewToken(expiredToken);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/expirado/i);
    }
  });

  test("falha explicitamente quando a variável de ambiente está ausente durante validação", () => {
    const token = generatePreviewToken(defaultParams);
    delete process.env.HYBRID_PREVIEW_SIGNING_SECRET;
    expect(() => validatePreviewToken(token)).toThrow("HYBRID_PREVIEW_SIGNING_SECRET");
  });

  describe("Hardened HMAC Validation", () => {
    let validWire: any;

    beforeEach(() => {
      const token = generatePreviewToken(defaultParams);
      const decoded = Buffer.from(token, "base64url").toString("utf8");
      validWire = JSON.parse(decoded);
    });

    function forgeToken(wireOverride: any): string {
      return Buffer.from(JSON.stringify(wireOverride)).toString("base64url");
    }

    test("1. assinatura correta", () => {
      const token = generatePreviewToken(defaultParams);
      const result = validatePreviewToken(token);
      expect(result.valid).toBe(true);
    });

    test("2. assinatura incorreta com o mesmo comprimento", () => {
      const badWire = {
        ...validWire,
        signature: "a".repeat(64),
      };
      const result = validatePreviewToken(forgeToken(badWire));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Assinatura do token inválida");
      }
    });

    test("3. assinatura com comprimento menor", () => {
      const badWire = {
        ...validWire,
        signature: "a".repeat(60),
      };
      const result = validatePreviewToken(forgeToken(badWire));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Assinatura do token inválida");
      }
    });

    test("4. assinatura com comprimento maior", () => {
      const badWire = {
        ...validWire,
        signature: "a".repeat(68),
      };
      const result = validatePreviewToken(forgeToken(badWire));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Assinatura do token inválida");
      }
    });

    test("5. assinatura vazia", () => {
      const badWire = {
        ...validWire,
        signature: "",
      };
      const result = validatePreviewToken(forgeToken(badWire));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Assinatura do token inválida");
      }
    });

    test("6. signature ausente", () => {
      const badWire = { ...validWire };
      delete (badWire as any).signature;
      const result = validatePreviewToken(forgeToken(badWire));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Assinatura do token inválida");
      }
    });

    test("7. signature como número", () => {
      const badWire = {
        ...validWire,
        signature: 12345,
      };
      const result = validatePreviewToken(forgeToken(badWire));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Assinatura do token inválida");
      }
    });

    test("8. signature como objeto", () => {
      const badWire = {
        ...validWire,
        signature: {},
      };
      const result = validatePreviewToken(forgeToken(badWire));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Assinatura do token inválida");
      }
    });

    test("9. string com 64 caracteres não hexadecimais", () => {
      const badWire = {
        ...validWire,
        signature: "g".repeat(64),
      };
      const result = validatePreviewToken(forgeToken(badWire));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Assinatura do token inválida");
      }
    });

    test("10. token que não é base64url", () => {
      const result = validatePreviewToken("not base64url space!");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Token malformado");
      }
    });

    test("11. base64url que não contém JSON", () => {
      const badToken = Buffer.from("just plain text string").toString("base64url");
      const result = validatePreviewToken(badToken);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Token malformado");
      }
    });

    test("12. JSON sem payload", () => {
      const badWire = {
        signature: "a".repeat(64),
      };
      const result = validatePreviewToken(forgeToken(badWire));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Payload do token incompleto");
      }
    });

    test("13. payload válido com assinatura inválida", () => {
      const badWire = {
        ...validWire,
        signature: "b".repeat(64),
      };
      const result = validatePreviewToken(forgeToken(badWire));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Assinatura do token inválida");
      }
    });
  });
});

// ── Integridade do preview ────────────────────────────────────────────────────

describe("verifyPreviewIntegrity", () => {
  test("preview original passa verificação de integridade", () => {
    const token = generatePreviewToken(defaultParams);
    const result = validatePreviewToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(verifyPreviewIntegrity(result.payload, mockPreview)).toBe(true);
    }
  });

  test("preview modificado falha verificação de integridade", () => {
    const token = generatePreviewToken(defaultParams);
    const result = validatePreviewToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      const tamperedPreview = { ...mockPreview, confidence: 1.0 };
      expect(verifyPreviewIntegrity(result.payload, tamperedPreview)).toBe(false);
    }
  });

  test("preview com flashcardSeeds extras falha verificação", () => {
    const token = generatePreviewToken(defaultParams);
    const result = validatePreviewToken(token);
    if (result.valid) {
      const tamperedPreview = {
        ...mockPreview,
        flashcardSeeds: [
          {
            question: "Q extra",
            answer: "A extra",
            type: "QUESTION_ANSWER",
            sourceMaterialId: "mat-strat-1",
            sourcePageStart: 10,
            sourcePageEnd: 12,
            generationReason: "injetado",
          },
        ],
      };
      expect(verifyPreviewIntegrity(result.payload, tamperedPreview)).toBe(false);
    }
  });
});

// ── computePreviewHash ─────────────────────────────────────────────────────────

describe("computePreviewHash", () => {
  test("mesmo objeto retorna mesmo hash", () => {
    expect(computePreviewHash(mockPreview)).toBe(computePreviewHash(mockPreview));
  });

  test("objetos com mesma estrutura em ordens diferentes retornam mesmo hash", () => {
    const a = { z: 1, a: 2, sources: [] };
    const b = { a: 2, z: 1, sources: [] };
    expect(computePreviewHash(a)).toBe(computePreviewHash(b));
  });

  test("mudança de confidence muda o hash", () => {
    const base = { ...mockPreview, confidence: 0.85 };
    const modified = { ...mockPreview, confidence: 0.86 };
    expect(computePreviewHash(base)).not.toBe(computePreviewHash(modified));
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function forgeExpiredToken(params: typeof defaultParams): string {
  // Criamos manualmente um payload expirado e o assinamos
  // (teste de caixa branca — verifica que o sistema detecta expiração)
  const crypto = require("crypto");

  const secret = process.env.HYBRID_PREVIEW_SIGNING_SECRET!;
  const { canonicalStringify } = require("@/lib/security/canonical-json");

  const past = Date.now() - 60 * 60 * 1000; // 1 hora atrás
  const payload = {
    userId: params.userId,
    subjectId: params.subjectId,
    generationRunId: params.generationRunId,
    previewHash: computePreviewHash(params.preview),
    issuedAt: past - 30 * 60 * 1000,
    expiresAt: past, // expirado
  };

  const canonical = canonicalStringify(payload as any);
  const signature = crypto.createHmac("sha256", secret).update(canonical, "utf8").digest("hex");

  const wire = { payload, signature };
  return Buffer.from(JSON.stringify(wire)).toString("base64url");
}
