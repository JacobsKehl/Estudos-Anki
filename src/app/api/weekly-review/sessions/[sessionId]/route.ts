import { getCurrentUserId } from "@/lib/auth-mock";
import { prisma } from "@/lib/prisma";
import * as weeklyReviewService from "@/lib/services/weekly-review";
import { getNow } from "@/lib/clock";
import { handleGetSessionById } from "./handlers";

export const dynamic = "force-dynamic";

const deps = {
  getCurrentUserId,
  prisma,
  weeklyReviewService,
  getNow
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  return handleGetSessionById(request, sessionId, deps);
}
