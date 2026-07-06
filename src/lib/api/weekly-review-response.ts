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

  // 404 NOT_FOUND
  if (
    msg === "SESSION_NOT_FOUND" ||
    msg === "TOPIC_NOT_FOUND" ||
    msg === "USER_NOT_FOUND" ||
    msg === "TOPIC_NOT_FOUND_IN_SESSION"
  ) {
    return errorResponse("NOT_FOUND", "Recurso não encontrado.", 404);
  }

  // 409 CONFLICT / INVALID STATE
  if (
    msg === "WEEKLY_REVIEW_DISABLED" ||
    msg === "INVALID_SCHEDULED_DAY" ||
    msg === "INVALID_STATE_TRANSITION" ||
    msg === "CIRCULAR_CARRYOVER_DETECTED" ||
    msg === "SESSION_NOT_PENDING" ||
    msg === "INVALID_SESSION_STATUS" ||
    msg === "SESSION_NOT_IN_PROGRESS" ||
    msg === "CARRYOVER_NOT_ALLOWED_BY_BEHAVIOR"
  ) {
    let friendlyMessage = "Operação inválida para o estado atual da revisão.";
    if (msg === "WEEKLY_REVIEW_DISABLED") {
      friendlyMessage = "Revisão semanal desativada.";
    } else if (msg === "INVALID_SCHEDULED_DAY") {
      friendlyMessage = "Dia inválido para revisão semanal.";
    }
    return errorResponse(msg, friendlyMessage, 409);
  }

  // 400 INVALID_INPUT
  if (
    msg === "SESSION_ALREADY_IN_PROGRESS_WITH_DIFFERENT_PARAMS" ||
    msg === "INVALID_CARRYOVER_DATE" ||
    msg === "INVALID_AVAILABLE_MINUTES" ||
    msg === "INVALID_TARGET_QUESTION_COUNT" ||
    msg === "INVALID_ACTUAL_QUESTION_COUNT" ||
    msg === "INVALID_RESULT" ||
    msg === "NOTES_TOO_LONG" ||
    msg === "NO_RESULTS_RECORDED"
  ) {
    return errorResponse("INVALID_INPUT", `Entrada inválida: ${msg}`, 400);
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

  console.error("[WeeklyReview API Error]", {
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode: typeof error?.code === "string" ? error.code : "INTERNAL_ERROR",
    timestamp: new Date().toISOString()
  });
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

  const isProd = process.env.NODE_ENV === "production";

  // Resolver origens autorizadas oficiais
  const allowedOrigins: string[] = [
    "https://kehlstudy.com",
    "https://estudos-anki.vercel.app"
  ];

  if (process.env.APP_URL) {
    try {
      allowedOrigins.push(new URL(process.env.APP_URL).origin);
    } catch {}
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      allowedOrigins.push(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
    } catch {}
  }

  // Em desenvolvimento, podemos aceitar localhost, 127.0.0.1, nextUrl.origin e headers de Host dinâmicos
  if (!isProd) {
    allowedOrigins.push("http://localhost");
    allowedOrigins.push("http://127.0.0.1");

    // Adiciona localhost com portas comuns
    for (const port of ["3000", "3001", "3002", "4000"]) {
      allowedOrigins.push(`http://localhost:${port}`);
      allowedOrigins.push(`http://127.0.0.1:${port}`);
    }

    // Aceitar nextUrl.origin se disponível
    const nextUrlOrigin = (request as any).nextUrl?.origin;
    if (nextUrlOrigin) {
      try {
        allowedOrigins.push(new URL(nextUrlOrigin).origin);
      } catch {}
    }

    // Aceitar Host e X-Forwarded-Host dinâmicos
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
    if (host) {
      try {
        allowedOrigins.push(new URL(`${proto}://${host}`).origin);
      } catch {}
    }
  }

  try {
    const originOrigin = new URL(origin).origin;

    // Verificar se existe correspondência exata de origin.
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

import { PrismaClient, Prisma } from "@prisma/client";
import type * as WeeklyReviewService from "@/lib/services/weekly-review";

export interface RouteDependencies {
  getCurrentUserId: () => Promise<string>;
  prisma: PrismaClient | Prisma.TransactionClient;
  weeklyReviewService: typeof WeeklyReviewService;
  getNow: () => Date;
}
