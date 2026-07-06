import type { Metadata } from "next";
import { WeeklyReviewClient } from "@/components/weekly-review/WeeklyReviewClient";

export const metadata: Metadata = {
  title: "Revisão Semanal — Kehl Study",
  description:
    "Execute sua revisão semanal de estudos com questões direcionadas sobre os principais assuntos.",
};

export default function WeeklyReviewPage() {
  return (
    <main className="min-h-screen pb-24">
      <WeeklyReviewClient />
    </main>
  );
}
