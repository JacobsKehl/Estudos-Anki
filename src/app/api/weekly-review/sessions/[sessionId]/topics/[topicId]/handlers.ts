import {
  RouteDependencies,
  successResponse,
  errorResponse,
  mapWeeklyReviewDomainError,
  assertJsonRequest,
  assertSameOriginMutation,
  getSafeJsonBody
} from "@/lib/api/weekly-review-response";
import { parseId, parseTopicResultInput } from "@/lib/validation/weekly-review";

export async function handlePatchTopicResult(
  request: Request,
  sessionId: string,
  topicId: string,
  deps: RouteDependencies
) {
  try {
    assertJsonRequest(request);
    assertSameOriginMutation(request);

    const userId = await deps.getCurrentUserId();
    const cleanSessionId = parseId(sessionId, "sessionId");
    const cleanTopicId = parseId(topicId, "topicId");
    const body = await getSafeJsonBody(request);

    // Rejeitar expressamente o envio de 'userId' no payload
    if ("userId" in body) {
      return errorResponse("INVALID_INPUT", "O campo 'userId' é proibido.", 400);
    }

    const input = parseTopicResultInput(body);

    // Validar propriedade da sessão
    const session = await deps.prisma.weeklyReviewSession.findUnique({
      where: { id: cleanSessionId }
    });
    if (!session || session.userId !== userId) {
      return errorResponse("NOT_FOUND", "Sessão não encontrada.", 404);
    }

    // Validar se o tópico pertence à sessão
    const topic = await deps.prisma.weeklyReviewTopic.findUnique({
      where: { id: cleanTopicId }
    });
    if (!topic || topic.weeklyReviewSessionId !== cleanSessionId) {
      return errorResponse("NOT_FOUND", "Tópico não encontrado.", 404);
    }

    const updated = await deps.weeklyReviewService.recordWeeklyReviewTopicResult(
      {
        userId,
        sessionId: cleanSessionId,
        topicId: cleanTopicId,
        result: input.result,
        notes: input.notes
      },
      deps.prisma
    );

    return successResponse(updated);
  } catch (error) {
    return mapWeeklyReviewDomainError(error);
  }
}
