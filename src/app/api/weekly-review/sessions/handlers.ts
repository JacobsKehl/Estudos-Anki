import {
  RouteDependencies,
  successResponse,
  errorResponse,
  mapWeeklyReviewDomainError,
  assertJsonRequest,
  assertSameOriginMutation,
  getSafeJsonBody
} from "@/lib/api/weekly-review-response";
import { parseCreateSessionInput } from "@/lib/validation/weekly-review";
import { getTodayRangeSP } from "@/lib/date-utils";

function calculateMostRecentOccurrence(today: Date, targetDayOfWeek: number): Date {
  const currentDayOfWeek = today.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  let diff = currentDayOfWeek - targetDayOfWeek;
  if (diff < 0) {
    diff += 7;
  }
  const occurrence = new Date(today.getTime());
  occurrence.setUTCDate(occurrence.getUTCDate() - diff);
  return occurrence;
}

export async function handlePostCreateSession(request: Request, deps: RouteDependencies) {
  try {
    assertJsonRequest(request);
    assertSameOriginMutation(request);

    const userId = await deps.getCurrentUserId();
    const body = await getSafeJsonBody(request);

    // Rejeitar expressamente o envio de 'userId' no payload
    if ("userId" in body) {
      return errorResponse("INVALID_INPUT", "O campo 'userId' é proibido.", 400);
    }

    const input = parseCreateSessionInput(body);

    // 1. Verificar se a preferência está ativada
    const prefs = await deps.prisma.userPreferences.findUnique({
      where: { userId }
    });
    if (!prefs || !prefs.weeklyReviewEnabled) {
      return errorResponse("WEEKLY_REVIEW_DISABLED", "A revisão semanal não está ativada.", 409);
    }

    // 2. Verificar se existe alguma sessão PENDING ou IN_PROGRESS
    const existingOpenSessions = await deps.prisma.weeklyReviewSession.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "IN_PROGRESS"] }
      },
      include: {
        topics: {
          include: { sources: true }
        }
      }
    });

    if (existingOpenSessions.length > 0) {
      // Ordenação determinística para retornar a mais prioritária
      existingOpenSessions.sort((a: any, b: any) => {
        const statusA = a.status === "IN_PROGRESS" ? 0 : 1;
        const statusB = b.status === "IN_PROGRESS" ? 0 : 1;
        if (statusA !== statusB) return statusA - statusB;

        const dateA = new Date(a.effectiveScheduledDate).getTime();
        const dateB = new Date(b.effectiveScheduledDate).getTime();
        if (dateA !== dateB) return dateA - dateB;

        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      return successResponse({ session: existingOpenSessions[0], created: false }, 200);
    }

    // 3. Calcular a ocorrência semanal válida
    const todayStr = getTodayRangeSP(deps.getNow()).dateString;
    const today = new Date(todayStr + "T12:00:00Z");
    const targetDayOfWeek = prefs.weeklyReviewDayOfWeek;
    const occurrence = calculateMostRecentOccurrence(today, targetDayOfWeek);
    const occurrenceStr = getTodayRangeSP(occurrence).dateString;

    // Se o cliente enviar originalScheduledDate, exigir igualdade com a calculada
    if (input.originalScheduledDate && input.originalScheduledDate !== occurrenceStr) {
      return errorResponse(
        "INVALID_SCHEDULED_DAY",
        `A data fornecida (${input.originalScheduledDate}) não coincide com a ocorrência válida mais recente calculada (${occurrenceStr}).`,
        409
      );
    }

    // Não permitir criação de ocorrência futura ou a mais de 7 dias do dia atual
    if (occurrence.getTime() > today.getTime()) {
      return errorResponse("INVALID_SCHEDULED_DAY", "A data da sessão não pode estar no futuro.", 409);
    }

    const diffDays = Math.round((today.getTime() - occurrence.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 7) {
      return errorResponse("INVALID_SCHEDULED_DAY", "A data de revisão calculada está a mais de 7 dias de distância.", 409);
    }

    // 4. Chamar o serviço
    const result = await deps.weeklyReviewService.createOrGetWeeklyReviewSession(
      {
        userId,
        originalScheduledDate: occurrence,
        timezone: "America/Sao_Paulo"
      },
      deps.prisma
    );

    return successResponse({ session: result.session, created: result.created }, result.created ? 201 : 200);
  } catch (error) {
    return mapWeeklyReviewDomainError(error);
  }
}
