import {
  RouteDependencies,
  successResponse,
  errorResponse,
  mapWeeklyReviewDomainError
} from "@/lib/api/weekly-review-response";
import { parseId } from "@/lib/validation/weekly-review";

export async function handleGetSessionById(
  request: Request,
  sessionId: string,
  deps: RouteDependencies
) {
  try {
    const userId = await deps.getCurrentUserId();
    const cleanSessionId = parseId(sessionId, "sessionId");

    const session = await deps.prisma.weeklyReviewSession.findUnique({
      where: { id: cleanSessionId },
      include: {
        topics: {
          orderBy: { priorityRank: "asc" },
          include: { sources: true }
        }
      }
    });

    if (!session || session.userId !== userId) {
      return errorResponse("NOT_FOUND", "Sessão não encontrada.", 404);
    }

    return successResponse(session);
  } catch (error) {
    return mapWeeklyReviewDomainError(error);
  }
}
