import { getCurrentUserId } from "@/lib/auth-mock";
import { prisma } from "@/lib/prisma";
import * as weeklyReviewService from "@/lib/services/weekly-review";
import { getNow } from "@/lib/clock";
import { handlePostCreateSession } from "./handlers";

export const dynamic = "force-dynamic";

const deps = {
  getCurrentUserId,
  prisma,
  weeklyReviewService,
  getNow
};

export async function POST(request: Request) {
  return handlePostCreateSession(request, deps);
}
