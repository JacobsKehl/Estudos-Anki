import {
  RouteDependencies,
  successResponse,
  errorResponse,
  mapWeeklyReviewDomainError,
  assertJsonRequest,
  assertSameOriginMutation,
  getSafeJsonBody
} from "@/lib/api/weekly-review-response";
import { parsePreferencesInput } from "@/lib/validation/weekly-review";

export async function handleGetPreferences(request: Request, deps: RouteDependencies) {
  try {
    const userId = await deps.getCurrentUserId();
    
    let prefs = await deps.prisma.userPreferences.findUnique({
      where: { userId }
    });

    if (!prefs) {
      prefs = {
        weeklyReviewEnabled: false,
        weeklyReviewDayOfWeek: 0,
        weeklyReviewMissedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
      };
    }

    const openSessionCount = await deps.prisma.weeklyReviewSession.count({
      where: {
        userId,
        status: { in: ["PENDING", "IN_PROGRESS"] }
      }
    });

    return successResponse({
      enabled: prefs.weeklyReviewEnabled,
      dayOfWeek: prefs.weeklyReviewDayOfWeek,
      missedBehavior: prefs.weeklyReviewMissedBehavior,
      hasOpenSession: openSessionCount > 0
    });
  } catch (error) {
    return mapWeeklyReviewDomainError(error);
  }
}

export async function handlePatchPreferences(request: Request, deps: RouteDependencies) {
  try {
    assertJsonRequest(request);
    assertSameOriginMutation(request);

    const userId = await deps.getCurrentUserId();
    const body = await getSafeJsonBody(request);

    // Rejeitar expressamente o envio de 'userId' no payload
    if ("userId" in body) {
      return errorResponse("INVALID_INPUT", "O campo 'userId' é proibido.", 400);
    }

    const input = parsePreferencesInput(body);

    const updateData: any = {};
    if (input.enabled !== undefined) updateData.weeklyReviewEnabled = input.enabled;
    if (input.dayOfWeek !== undefined) updateData.weeklyReviewDayOfWeek = input.dayOfWeek;
    if (input.missedBehavior !== undefined) updateData.weeklyReviewMissedBehavior = input.missedBehavior;

    // Tentar obter preferências existentes
    const existing = await deps.prisma.userPreferences.findUnique({
      where: { userId }
    });

    let prefs;
    if (!existing) {
      // Se não existir, criar com os defaults do prisma e os campos enviados
      prefs = await deps.prisma.userPreferences.create({
        data: {
          userId,
          weeklyReviewEnabled: updateData.weeklyReviewEnabled ?? false,
          weeklyReviewDayOfWeek: updateData.weeklyReviewDayOfWeek ?? 0,
          weeklyReviewMissedBehavior: updateData.weeklyReviewMissedBehavior ?? "MOVE_TO_NEXT_AVAILABLE_DAY"
        }
      });
    } else {
      prefs = await deps.prisma.userPreferences.update({
        where: { userId },
        data: updateData
      });
    }

    const openSessionCount = await deps.prisma.weeklyReviewSession.count({
      where: {
        userId,
        status: { in: ["PENDING", "IN_PROGRESS"] }
      }
    });

    return successResponse({
      enabled: prefs.weeklyReviewEnabled,
      dayOfWeek: prefs.weeklyReviewDayOfWeek,
      missedBehavior: prefs.weeklyReviewMissedBehavior,
      hasOpenSession: openSessionCount > 0
    });
  } catch (error) {
    return mapWeeklyReviewDomainError(error);
  }
}
