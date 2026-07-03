import {
  RouteDependencies,
  successResponse,
  mapWeeklyReviewDomainError
} from "@/lib/api/weekly-review-response";

export async function handleGetActiveSession(request: Request, deps: RouteDependencies) {
  try {
    const userId = await deps.getCurrentUserId();

    const sessions = await deps.prisma.weeklyReviewSession.findMany({
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

    const openSessionCount = sessions.length;

    if (sessions.length > 0) {
      // Ordenação determinística:
      // 1. IN_PROGRESS primeiro (status: 0 para IN_PROGRESS, 1 para PENDING)
      // 2. data efetiva mais antiga
      // 3. createdAt mais antigo
      sessions.sort((a: any, b: any) => {
        const statusA = a.status === "IN_PROGRESS" ? 0 : 1;
        const statusB = b.status === "IN_PROGRESS" ? 0 : 1;
        if (statusA !== statusB) return statusA - statusB;

        const dateA = new Date(a.effectiveScheduledDate).getTime();
        const dateB = new Date(b.effectiveScheduledDate).getTime();
        if (dateA !== dateB) return dateA - dateB;

        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      return successResponse({
        session: sessions[0],
        openSessionCount
      });
    }

    return successResponse({
      session: null,
      openSessionCount: 0
    });
  } catch (error) {
    return mapWeeklyReviewDomainError(error);
  }
}
