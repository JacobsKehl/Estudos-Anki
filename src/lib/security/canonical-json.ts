/**
 * src/lib/security/canonical-json.ts
 *
 * Serialização JSON canônica e determinística para uso em hashing e assinatura.
 *
 * Regras:
 *   - Chaves de objetos são ordenadas alfabeticamente em todos os níveis.
 *   - Arrays preservam a ordem original (a ordem é semanticamente relevante em arrays).
 *     Quem precisar de ordenação semântica (ex: fingerprints por materialId) deve
 *     ordenar o array ANTES de chamar canonicalStringify.
 *   - Valores inválidos para JSON são rejeitados com TypeError.
 *   - O objeto original nunca é mutado.
 */

import { createHash } from "crypto";

/** Tipos de valores JSON válidos */
type JsonPrimitive = string | number | boolean | null;
type JsonArray = JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonArray | JsonObject;

/**
 * Serializa um valor para JSON canônico determinístico.
 *
 * @throws TypeError para undefined, function, symbol, bigint, NaN, Infinity,
 *   ou datas não convertidas para string.
 */
export function canonicalStringify(value: unknown): string {
  return serializeValue(value, "$");
}

function serializeValue(value: unknown, path: string): string {
  // Reject invalid JSON types
  if (value === undefined) {
    throw new TypeError(`[canonical-json] undefined não é um valor JSON válido (em ${path})`);
  }
  if (typeof value === "function") {
    throw new TypeError(`[canonical-json] function não é um valor JSON válido (em ${path})`);
  }
  if (typeof value === "symbol") {
    throw new TypeError(`[canonical-json] symbol não é um valor JSON válido (em ${path})`);
  }
  if (typeof value === "bigint") {
    throw new TypeError(`[canonical-json] bigint não é um valor JSON válido (em ${path}). Converta para string ou number.`);
  }
  if (typeof value === "number" && (isNaN(value) || !isFinite(value))) {
    throw new TypeError(`[canonical-json] NaN e Infinity não são valores JSON válidos (em ${path})`);
  }

  // Date must be pre-converted
  if (value instanceof Date) {
    throw new TypeError(
      `[canonical-json] Date deve ser convertida para ISO string antes de serializar (em ${path}). Use value.toISOString()`
    );
  }

  // null
  if (value === null) return "null";

  // Primitives
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);

  // Array: preserve order (order is semantically meaningful)
  if (Array.isArray(value)) {
    const items = (value as unknown[]).map((item, i) =>
      serializeValue(item, `${path}[${i}]`)
    );
    return `[${items.join(",")}]`;
  }

  // Object: sort keys alphabetically
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map((k) => {
      const serializedKey = JSON.stringify(k);
      const serializedValue = serializeValue(obj[k], `${path}.${k}`);
      return `${serializedKey}:${serializedValue}`;
    });
    return `{${parts.join(",")}}`;
  }

  // Should never reach here
  throw new TypeError(`[canonical-json] Tipo desconhecido: ${typeof value} (em ${path})`);
}

/**
 * Calcula o SHA-256 de uma string e retorna o digest em hex.
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Converte qualquer valor serializável para SHA-256 canonicamente.
 * Atalho para: sha256(canonicalStringify(value))
 */
export function canonicalHash(value: unknown): string {
  return sha256(canonicalStringify(value));
}
