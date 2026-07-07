import {
  RouteDependencies,
  successResponse,
  errorResponse,
  mapWeeklyReviewDomainError,
  assertJsonRequest,
  assertSameOriginMutation,
  getSafeJsonBody
} from "@/lib/api/weekly-review-response";
import { parseId, parseCompleteSessionInput } from "@/lib/validation/weekly-review";

export async function handlePostCompleteSession(
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

    const input = parseCompleteSessionInput(body);

    const session = await deps.prisma.weeklyReviewSession.findUnique({
      where: { id: cleanSessionId }
    });

    if (!session || session.userId !== userId) {
      return errorResponse("NOT_FOUND", "Sessão não encontrada.", 404);
    }

    const completed = await deps.weeklyReviewService.completeWeeklyReviewSession(
      {
        userId,
        sessionId: cleanSessionId,
        actualQuestionCount: input.actualQuestionCount
      },
      deps.prisma
    );

    return successResponse(completed);
  } catch (error) {
    return mapWeeklyReviewDomainError(error);
  }
}
