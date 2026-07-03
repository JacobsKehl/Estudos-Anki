import { getCurrentUserId } from "@/lib/auth-mock";
import { prisma } from "@/lib/prisma";
import * as weeklyReviewService from "@/lib/services/weekly-review";
import { getNow } from "@/lib/clock";
import { handlePatchTopicResult } from "./handlers";

export const dynamic = "force-dynamic";

const deps = {
  getCurrentUserId,
  prisma,
  weeklyReviewService,
  getNow
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; topicId: string }> }
) {
  const { sessionId, topicId } = await params;
  return handlePatchTopicResult(request, sessionId, topicId, deps);
}
