import {
  RouteDependencies,
  successResponse,
  errorResponse,
  mapWeeklyReviewDomainError,
  assertJsonRequest,
  assertSameOriginMutation,
  getSafeJsonBody
} from "@/lib/api/weekly-review-response";
import { parseId } from "@/lib/validation/weekly-review";

export async function handlePostSkipSession(
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

    const session = await deps.prisma.weeklyReviewSession.findUnique({
      where: { id: cleanSessionId }
    });

    if (!session || session.userId !== userId) {
      return errorResponse("NOT_FOUND", "Sessão não encontrada.", 404);
    }

    const skipped = await deps.weeklyReviewService.skipWeeklyReviewSession(
      {
        userId,
        sessionId: cleanSessionId
      },
      deps.prisma
    );

    return successResponse(skipped);
  } catch (error) {
    return mapWeeklyReviewDomainError(error);
  }
}
