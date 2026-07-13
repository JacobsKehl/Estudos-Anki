/**
 * Testes unitários para canonical-json.ts e hybrid-preview-token.ts
 *
 * Executar com: npx jest src/__tests__/security/
 */

import { canonicalStringify, sha256, canonicalHash } from "@/lib/security/canonical-json";

describe("canonicalStringify", () => {
  // ── Primitivos ─────────────────────────────────────────────────────────────

  test("serializa string corretamente", () => {
    expect(canonicalStringify("hello")).toBe('"hello"');
  });

  test("serializa number corretamente", () => {
    expect(canonicalStringify(42)).toBe("42");
    expect(canonicalStringify(0)).toBe("0");
    expect(canonicalStringify(-3.14)).toBe("-3.14");
  });

  test("serializa boolean corretamente", () => {
    expect(canonicalStringify(true)).toBe("true");
    expect(canonicalStringify(false)).toBe("false");
  });

  test("serializa null corretamente", () => {
    expect(canonicalStringify(null)).toBe("null");
  });

  // ── Objetos com chaves ordenadas ───────────────────────────────────────────

  test("ordena chaves de objeto alfabeticamente", () => {
    const obj = { z: 1, a: 2, m: 3 };
    expect(canonicalStringify(obj)).toBe('{"a":2,"m":3,"z":1}');
  });

  test("ordena chaves recursivamente em objetos aninhados", () => {
    const obj = { b: { z: 1, a: 2 }, a: { y: 3, x: 4 } };
    expect(canonicalStringify(obj)).toBe('{"a":{"x":4,"y":3},"b":{"a":2,"z":1}}');
  });

  test("dois objetos com mesmas chaves em ordens diferentes produzem mesmo resultado", () => {
    const a = { z: 1, a: 2 };
    const b = { a: 2, z: 1 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  // ── Arrays ─────────────────────────────────────────────────────────────────

  test("preserva ordem de arrays", () => {
    const arr = [3, 1, 2];
    expect(canonicalStringify(arr)).toBe("[3,1,2]");
  });

  test("arrays com mesmos elementos em ordens diferentes produzem resultados diferentes", () => {
    const a = [1, 2, 3];
    const b = [3, 2, 1];
    expect(canonicalStringify(a)).not.toBe(canonicalStringify(b));
  });

  test("array de objetos serializa cada objeto canonicamente", () => {
    const arr = [{ z: 1, a: 2 }, { b: 3 }];
    expect(canonicalStringify(arr)).toBe('[{"a":2,"z":1},{"b":3}]');
  });

  // ── Tipos inválidos ────────────────────────────────────────────────────────

  test("rejeita undefined", () => {
    expect(() => canonicalStringify(undefined)).toThrow(TypeError);
    expect(() => canonicalStringify(undefined)).toThrow("undefined");
  });

  test("rejeita function", () => {
    expect(() => canonicalStringify(() => {})).toThrow(TypeError);
    expect(() => canonicalStringify(() => {})).toThrow("function");
  });

  test("rejeita symbol", () => {
    expect(() => canonicalStringify(Symbol("test"))).toThrow(TypeError);
    expect(() => canonicalStringify(Symbol("test"))).toThrow("symbol");
  });

  test("rejeita bigint", () => {
    expect(() => canonicalStringify(BigInt(42))).toThrow(TypeError);
    expect(() => canonicalStringify(BigInt(42))).toThrow("bigint");
  });

  test("rejeita NaN", () => {
    expect(() => canonicalStringify(NaN)).toThrow(TypeError);
    expect(() => canonicalStringify(NaN)).toThrow("NaN");
  });

  test("rejeita Infinity", () => {
    expect(() => canonicalStringify(Infinity)).toThrow(TypeError);
    expect(() => canonicalStringify(Infinity)).toThrow("Infinity");
  });

  test("rejeita Date não convertida para string", () => {
    expect(() => canonicalStringify(new Date())).toThrow(TypeError);
    expect(() => canonicalStringify(new Date())).toThrow("ISO string");
  });

  test("aceita Date convertida para ISO string", () => {
    const iso = new Date("2025-01-01T00:00:00.000Z").toISOString();
    expect(() => canonicalStringify(iso)).not.toThrow();
    expect(canonicalStringify(iso)).toBe('"2025-01-01T00:00:00.000Z"');
  });

  // ── Não muta o objeto original ─────────────────────────────────────────────

  test("não muta o objeto original", () => {
    const obj = { z: 1, a: 2 };
    const original = { ...obj };
    canonicalStringify(obj);
    expect(obj).toEqual(original);
  });
});

describe("sha256", () => {
  test("produz hash hex de 64 caracteres", () => {
    const hash = sha256("test");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  test("mesma entrada produz mesmo hash", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
  });

  test("entradas diferentes produzem hashes diferentes", () => {
    expect(sha256("hello")).not.toBe(sha256("world"));
  });
});

describe("canonicalHash", () => {
  test("objetos com mesma estrutura em ordens diferentes produzem mesmo hash", () => {
    const a = { z: 1, a: 2 };
    const b = { a: 2, z: 1 };
    expect(canonicalHash(a)).toBe(canonicalHash(b));
  });

  test("alteração de qualquer campo muda o hash", () => {
    const base = { title: "Direito do Trabalho", confidence: 0.8 };
    const modified = { title: "Direito do Trabalho", confidence: 0.9 };
    expect(canonicalHash(base)).not.toBe(canonicalHash(modified));
  });

  test("fingerprints ordenados por materialId antes de hash produzem mesmo resultado", () => {
    const unsorted = [
      { materialId: "z-material", fingerprint: "hash-z" },
      { materialId: "a-material", fingerprint: "hash-a" },
    ];
    const sorted = [...unsorted].sort((a, b) => a.materialId.localeCompare(b.materialId));
    // Arrays preservam ordem, então precisamos ordenar antes de chamar canonicalHash
    expect(canonicalHash(sorted)).toBe(canonicalHash(sorted));
    // Arrays não ordenados produzem hash diferente
    expect(canonicalHash(unsorted)).not.toBe(canonicalHash(sorted));
  });
});
