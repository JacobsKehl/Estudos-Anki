import { NextResponse } from "next/server";
import { WeeklyReviewValidationError } from "../validation/weekly-review";

const DEFAULT_HEADERS = {
  "Cache-Control": "no-store"
};

export function successResponse(data: any, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data
    },
    {
      status,
      headers: DEFAULT_HEADERS
    }
  );
}

export function errorResponse(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message
      }
    },
    {
      status,
      headers: DEFAULT_HEADERS
    }
  );
}

export function mapWeeklyReviewDomainError(error: any) {
  if (error instanceof WeeklyReviewValidationError) {
    return errorResponse("INVALID_INPUT", error.message, 400);
  }

  const msg = error.message || "";
  
  if (msg === "UNAUTHENTICATED") {
    return errorResponse("UNAUTHENTICATED", "Sessão inválida ou expirada.", 401);
  }
  if (msg === "SESSION_NOT_FOUND" || msg === "TOPIC_NOT_FOUND" || msg === "USER_NOT_FOUND") {
    return errorResponse("NOT_FOUND", "Recurso não encontrado.", 404);
  }
  if (
    msg === "WEEKLY_REVIEW_DISABLED" ||
    msg === "INVALID_SCHEDULED_DAY" ||
    msg === "INVALID_STATE_TRANSITION" ||
    msg === "CIRCULAR_CARRYOVER_DETECTED" ||
    msg === "SESSION_NOT_PENDING"
  ) {
    return errorResponse(msg, msg === "WEEKLY_REVIEW_DISABLED" ? "Revisão semanal desativada." : msg, 409);
  }
  if (msg === "NO_ELIGIBLE_TOPICS") {
    return errorResponse("NO_ELIGIBLE_TOPICS", "Nenhum assunto elegível encontrado para revisão nesta semana.", 422);
  }
  if (msg.includes("P2002")) {
    return errorResponse("CONFLICT", "Conflito de restrição de unicidade no banco.", 409);
  }
  if (msg === "UNSUPPORTED_MEDIA_TYPE" || msg === "MIME_TYPE_MISSING") {
    return errorResponse("UNSUPPORTED_MEDIA_TYPE", "Content-Type deve ser application/json.", 415);
  }
  if (msg === "ORIGIN_MISMATCH" || msg === "INVALID_ORIGIN") {
    return errorResponse("INVALID_ORIGIN", "Origem da requisição não permitida.", 400);
  }

  console.error("[WeeklyReview API Error]:", error);
  return errorResponse("INTERNAL_ERROR", "Ocorreu um erro interno no servidor.", 500);
}

// Verifica se o Content-Type do request mutável é application/json
export function assertJsonRequest(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType) {
    throw new Error("MIME_TYPE_MISSING");
  }

  // Extrair tipo MIME antes do ponto e vírgula
  const mimeType = contentType.split(";")[0].trim().toLowerCase();
  if (mimeType !== "application/json") {
    throw new Error("UNSUPPORTED_MEDIA_TYPE");
  }
}

// Verifica proteção Same-Origin
export function assertSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Se não há cabeçalho Origin (como requests HTTP diretos em scripts locais autorizados), permitimos passar
    return;
  }

  // Resolver origem canônica esperada
  const canonicalUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  let canonicalOrigin: string | null = null;
  if (canonicalUrl) {
    try {
      canonicalOrigin = new URL(canonicalUrl).origin;
    } catch {
      // Ignorar erros de parse
    }
  }

  // Resolver origem via cabeçalhos de proxy do request
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  let requestOrigin = "";
  if (host) {
    requestOrigin = `${proto}://${host}`;
  }

  // Lista de origens autorizadas oficiais
  const allowedOrigins = [
    "https://kehlstudy.com",
    "https://estudos-anki.vercel.app"
  ];
  if (canonicalOrigin) {
    allowedOrigins.push(canonicalOrigin);
  }
  if (requestOrigin) {
    try {
      allowedOrigins.push(new URL(requestOrigin).origin);
    } catch {}
  }

  try {
    const originUrl = new URL(origin);
    const originOrigin = originUrl.origin;

    // Verificar se existe correspondência exata de origin. origin.includes não é permitido.
    const isAllowed = allowedOrigins.some((allowed) => {
      try {
        return new URL(allowed).origin === originOrigin;
      } catch {
        return false;
      }
    });

    if (!isAllowed) {
      throw new Error("ORIGIN_MISMATCH");
    }
  } catch (e: any) {
    if (e.message === "ORIGIN_MISMATCH") {
      throw e;
    }
    throw new Error("INVALID_ORIGIN");
  }
}

// Helper seguro para obter o body JSON ou retornar um objeto vazio
export async function getSafeJsonBody(request: Request): Promise<any> {
  const text = await request.text();
  if (!text || text.trim() === "") {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new WeeklyReviewValidationError("JSON inválido no corpo da requisição.");
  }
}

export interface RouteDependencies {
  getCurrentUserId: () => Promise<string>;
  prisma: any;
  weeklyReviewService: any;
  getNow: () => Date;
}
