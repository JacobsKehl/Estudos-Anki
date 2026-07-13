/**
 * src/lib/security/hybrid-preview-token.ts
 *
 * Geração e validação do previewToken HMAC-SHA256 para o fluxo de criação
 * de blocos híbridos 80/20.
 *
 * SEGURANÇA:
 *   - A variável HYBRID_PREVIEW_SIGNING_SECRET é servidor-only.
 *   - Nunca deve ser nomeada com prefixo NEXT_PUBLIC_.
 *   - Nunca deve ser impressa em log ou retornada ao cliente.
 *   - O token completo nunca deve ser logado.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { canonicalStringify, sha256 } from "./canonical-json";

/** Duração de validade do token em milissegundos (30 minutos) */
const TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * Payload do token de preview.
 * Todos os campos são incluídos no HMAC — qualquer adulteração invalida o token.
 */
export interface PreviewTokenPayload {
  userId: string;
  subjectId: string;
  generationRunId: string;
  /** SHA-256 do HybridBlockOutput completo via canonicalStringify */
  previewHash: string;
  /** Unix timestamp em milissegundos */
  issuedAt: number;
  /** Unix timestamp em milissegundos (issuedAt + 30 min) */
  expiresAt: number;
}

/** Estrutura wire do token: payload + signature separados por "." */
interface WireToken {
  payload: PreviewTokenPayload;
  signature: string;
}

/**
 * Obtém o segredo de assinatura.
 * Falha explicitamente (throw) se a variável não estiver definida.
 */
function getSigningSecret(): string {
  const secret = process.env.HYBRID_PREVIEW_SIGNING_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error(
      "[hybrid-preview-token] HYBRID_PREVIEW_SIGNING_SECRET não está definida. " +
        "Configure a variável de ambiente no servidor antes de usar endpoints híbridos."
    );
  }
  return secret;
}

/**
 * Gera o HMAC-SHA256 do payload canônico.
 * O payload é serializado canonicamente para garantir determinismo.
 */
function signPayload(payload: PreviewTokenPayload, secret: string): string {
  const canonical = canonicalStringify(payload as unknown as Record<string, unknown>);
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

/**
 * Calcula o previewHash a partir do HybridBlockOutput completo.
 * O objeto `preview` é serializado canonicamente antes do hash.
 *
 * @param preview - O HybridBlockOutput completo retornado pela engine.
 */
export function computePreviewHash(preview: unknown): string {
  return sha256(canonicalStringify(preview));
}

/**
 * Gera um previewToken assinado vinculando userId, subjectId,
 * generationRunId e o hash completo do preview.
 */
export function generatePreviewToken(params: {
  userId: string;
  subjectId: string;
  generationRunId: string;
  preview: unknown;
}): string {
  const secret = getSigningSecret();
  const now = Date.now();

  const payload: PreviewTokenPayload = {
    userId: params.userId,
    subjectId: params.subjectId,
    generationRunId: params.generationRunId,
    previewHash: computePreviewHash(params.preview),
    issuedAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  };

  const signature = signPayload(payload, secret);
  const wire: WireToken = { payload, signature };

  // Token é base64url do JSON do wire object
  return Buffer.from(JSON.stringify(wire)).toString("base64url");
}

export interface TokenValidationResult {
  valid: true;
  payload: PreviewTokenPayload;
}

export interface TokenValidationError {
  valid: false;
  reason: string;
}

/**
 * Valida um previewToken e retorna o payload se a assinatura e expiração forem corretas.
 *
 * Nunca loga o token completo — apenas o generationRunId em caso de erro.
 */
export function validatePreviewToken(
  token: string
): TokenValidationResult | TokenValidationError {
  const secret = getSigningSecret();

  let wire: WireToken;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") {
      return { valid: false, reason: "Token malformado (não é objeto JSON)" };
    }
    wire = parsed as WireToken;
  } catch {
    return { valid: false, reason: "Token malformado (não é base64url JSON válido)" };
  }

  const { payload, signature } = wire;

  if (
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return {
      valid: false,
      reason: "Assinatura do token inválida",
    };
  }

  if (
    !payload ||
    typeof payload.userId !== "string" ||
    typeof payload.subjectId !== "string" ||
    typeof payload.generationRunId !== "string" ||
    typeof payload.previewHash !== "string" ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.expiresAt !== "number"
  ) {
    return { valid: false, reason: "Payload do token incompleto ou inválido" };
  }

  // Verificar assinatura antes de qualquer outra coisa (usando timingSafeEqual)
  const expectedSignature = signPayload(payload, secret);
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: "Assinatura do token inválida" };
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, reason: "Assinatura do token inválida" };
  }

  // Verificar expiração
  if (Date.now() > payload.expiresAt) {
    return {
      valid: false,
      reason: `Token expirado (generationRunId: ${payload.generationRunId})`,
    };
  }

  return { valid: true, payload };
}

/**
 * Verifica se o previewHash no token corresponde ao hash do preview recebido.
 * Deve ser chamado após validatePreviewToken retornar { valid: true }.
 */
export function verifyPreviewIntegrity(
  payload: PreviewTokenPayload,
  receivedPreview: unknown
): boolean {
  const receivedHash = computePreviewHash(receivedPreview);
  return payload.previewHash === receivedHash;
}
