import { NextRequest, NextResponse } from "next/server";

interface MemoryLimit {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, MemoryLimit>();

// Limpeza periódica do store em memória a cada 60 segundos
if (typeof window === "undefined") {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (now > record.resetTime) {
        memoryStore.delete(key);
      }
    }
  }, 60000);
  // Evitar manter o processo do Node ativo em ambientes de teste/compilação
  if (interval && typeof interval.unref === "function") {
    interval.unref();
  }
}

let hasWarnedInMemoryRateLimit = false;

/**
 * Obtém o IP do cliente a partir dos cabeçalhos HTTP com fallbacks seguros
 */
export function getClientIp(req: NextRequest): string {
  // 1. x-forwarded-for: extrai o primeiro IP da lista
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((ip) => ip.trim());
    if (ips[0]) return ips[0];
  }

  // 2. x-real-ip
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  // 3. cf-connecting-ip (Cloudflare)
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  // 4. Fallback em desenvolvimento
  if (process.env.NODE_ENV === "development") {
    return "dev-local-ip";
  }

  // 5. Último fallback controlado
  return "unknown-ip";
}

/**
 * Limita requisições em memória (Fallback para Dev/Local ou Produção sem Upstash)
 */
function memoryRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();

  // Logar warning estruturado apenas uma vez por cold start
  if (!hasWarnedInMemoryRateLimit) {
    hasWarnedInMemoryRateLimit = true;
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[RateLimit] WARNING: Using in-memory rate limiter in production. " +
        "This is not distributed across serverless instances. " +
        "Configure Upstash Redis for reliable production rate limiting."
      );
    } else {
      console.info("[RateLimit] Info: Using in-memory rate limiter for local development.");
    }
  }

  const record = memoryStore.get(key);

  if (!record || now > record.resetTime) {
    const newRecord: MemoryLimit = {
      count: 1,
      resetTime: now + windowSeconds * 1000,
    };
    memoryStore.set(key, newRecord);
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: windowSeconds,
    };
  }

  record.count += 1;
  const remaining = Math.max(0, limit - record.count);
  const resetSeconds = Math.max(0, Math.ceil((record.resetTime - now) / 1000));

  return {
    success: record.count <= limit,
    limit,
    remaining,
    reset: resetSeconds,
  };
}

/**
 * Limita requisições usando Upstash Redis via API REST (zero dependências)
 */
async function redisRateLimit(key: string, limit: number, windowSeconds: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Upstash Redis credentials missing");
  }

  const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;

  // Incrementar a chave no Redis
  const incrRes = await fetch(`${cleanUrl}/incr/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!incrRes.ok) {
    throw new Error(`Upstash Redis INCR failed: ${incrRes.statusText}`);
  }

  const { result: count } = await incrRes.json();

  let ttl = windowSeconds;

  if (count === 1) {
    // Configura expiração na primeira tentativa
    await fetch(`${cleanUrl}/expire/${encodeURIComponent(key)}/${windowSeconds}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } else {
    // Obtém o TTL restante da janela de limitação
    const ttlRes = await fetch(`${cleanUrl}/ttl/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (ttlRes.ok) {
      const { result } = await ttlRes.json();
      if (result > 0) {
        ttl = result;
      }
    }
  }

  const remaining = Math.max(0, limit - count);

  return {
    success: count <= limit,
    limit,
    remaining,
    reset: ttl,
  };
}

let lastRateLimitFallbackWarningAt = 0;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Validador principal de Rate Limiting Híbrido
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const isRedisConfigured =
    !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

  if (isRedisConfigured) {
    try {
      return await redisRateLimit(key, limit, windowSeconds);
    } catch (err) {
      const now = Date.now();
      if (now - lastRateLimitFallbackWarningAt >= ONE_HOUR_MS) {
        lastRateLimitFallbackWarningAt = now;
        console.warn(
          "[RateLimit] WARNING: Upstash unavailable or quota exceeded. Falling back to in-memory limiter. Production protection is degraded.",
          JSON.stringify({
            source: "rate-limit",
            mode: "memory-fallback",
            environment: process.env.NODE_ENV || "production",
            throttleWindowMinutes: 60
          })
        );
      }
      // Fallback gracioso para memória caso o Upstash falhe ou sofra timeout
      return memoryRateLimit(key, limit, windowSeconds);
    }
  }

  return memoryRateLimit(key, limit, windowSeconds);
}

/**
 * Middleware/helper de resposta amigável de erro HTTP 429
 */
export function rateLimitErrorResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}
