import { getCurrentUserId } from "@/lib/auth-mock";
import { prisma } from "@/lib/prisma";
import * as weeklyReviewService from "@/lib/services/weekly-review";
import { getNow } from "@/lib/clock";
import { handleGetPreferences, handlePatchPreferences } from "./handlers";

export const dynamic = "force-dynamic";

const deps = {
  getCurrentUserId,
  prisma,
  weeklyReviewService,
  getNow
};

export async function GET(request: Request) {
  return handleGetPreferences(request, deps);
}

export async function PATCH(request: Request) {
  return handlePatchPreferences(request, deps);
}
