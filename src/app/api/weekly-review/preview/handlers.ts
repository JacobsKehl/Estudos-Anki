import {
  RouteDependencies,
  successResponse,
  errorResponse,
  mapWeeklyReviewDomainError,
  assertJsonRequest,
  assertSameOriginMutation,
  getSafeJsonBody
} from "@/lib/api/weekly-review-response";
import { parsePreviewInput } from "@/lib/validation/weekly-review";
import { getTodayRangeSP } from "@/lib/date-utils";

export async function handlePostPreview(request: Request, deps: RouteDependencies) {
  try {
    assertJsonRequest(request);
    assertSameOriginMutation(request);

    const userId = await deps.getCurrentUserId();
    const body = await getSafeJsonBody(request);

    // Rejeitar expressamente o envio de 'userId' no payload
    if ("userId" in body) {
      return errorResponse("INVALID_INPUT", "O campo 'userId' é proibido.", 400);
    }

    const input = parsePreviewInput(body);

    // Determinar a data de referência no fuso de SP
    const referenceDateStr = input.referenceDate || getTodayRangeSP(deps.getNow()).dateString;

    // Obter se a funcionalidade está habilitada
    const prefs = await deps.prisma.userPreferences.findUnique({
      where: { userId }
    });
    const weeklyReviewEnabled = prefs ? prefs.weeklyReviewEnabled : false;

    // Construir a prévia (estritamente de leitura)
    const preview = await deps.weeklyReviewService.buildWeeklyReviewPreview(
      userId,
      referenceDateStr,
      "America/Sao_Paulo",
      input.availableMinutes,
      deps.prisma
    );

    return successResponse({
      preview,
      weeklyReviewEnabled
    });
  } catch (error) {
    return mapWeeklyReviewDomainError(error);
  }
}
