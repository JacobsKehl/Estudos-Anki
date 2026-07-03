import {
  RouteDependencies,
  successResponse,
  errorResponse,
  mapWeeklyReviewDomainError,
  assertJsonRequest,
  assertSameOriginMutation,
  getSafeJsonBody
} from "@/lib/api/weekly-review-response";
import { parseId, parseCarrySessionInput } from "@/lib/validation/weekly-review";
import { getTodayRangeSP } from "@/lib/date-utils";

export async function handlePostCarrySession(
  request: Request,
  sessionId: string,
  deps: RouteDependencies
) {
  try {
    assertJsonRequest(request);
    assertSameOriginMutation(request);

    const userId = await deps.getCurrentUserId();
    const cleanSessionId = parseId(sessionId, "sessionId");
    const body = await getSafeJsonBody(request);

    // Rejeitar expressamente o envio de 'userId' no payload
    if ("userId" in body) {
      return errorResponse("INVALID_INPUT", "O campo 'userId' é proibido.", 400);
    }

    const input = parseCarrySessionInput(body);

    const session = await deps.prisma.weeklyReviewSession.findUnique({
      where: { id: cleanSessionId }
    });

    if (!session || session.userId !== userId) {
      return errorResponse("NOT_FOUND", "Sessão não encontrada.", 404);
    }

    // 1. A sessão deve estar PENDING
    if (session.status !== "PENDING") {
      return errorResponse("INVALID_STATE_TRANSITION", "Apenas sessões PENDING podem ser transferidas.", 409);
    }

    // 2. missedBehavior deve ser MOVE_TO_NEXT_AVAILABLE_DAY
    if (session.missedBehavior !== "MOVE_TO_NEXT_AVAILABLE_DAY") {
      return errorResponse("INVALID_STATE_TRANSITION", "Apenas sessões configuradas com MOVE_TO_NEXT_AVAILABLE_DAY podem ser transferidas.", 409);
    }

    // 3. Validação de datas
    const todayStr = getTodayRangeSP(deps.getNow()).dateString;
    const currentDateStr = getTodayRangeSP(session.effectiveScheduledDate).dateString;
    const newDateStr = input.newEffectiveScheduledDate;

    if (newDateStr <= currentDateStr) {
      return errorResponse("INVALID_INPUT", "A nova data deve ser posterior à data agendada atual da sessão.", 400);
    }

    if (newDateStr < todayStr) {
      return errorResponse("INVALID_INPUT", "A nova data não pode ser anterior à data de hoje.", 400);
    }

    // Calcular limite máximo de 14 dias a partir da effectiveScheduledDate atual
    const currentEff = new Date(currentDateStr + "T12:00:00Z");
    const limitDate = new Date(currentEff.getTime() + 14 * 24 * 60 * 60 * 1000);
    const limitDateStr = getTodayRangeSP(limitDate).dateString;

    if (newDateStr > limitDateStr) {
      return errorResponse("INVALID_INPUT", `A nova data não pode exceder o limite de 14 dias a partir da data agendada atual (${limitDateStr}).`, 400);
    }

    const carried = await deps.weeklyReviewService.carryWeeklyReviewSession(
      cleanSessionId,
      new Date(newDateStr + "T12:00:00Z"),
      deps.prisma
    );

    return successResponse(carried);
  } catch (error) {
    return mapWeeklyReviewDomainError(error);
  }
}
