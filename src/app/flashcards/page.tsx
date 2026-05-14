/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logo } from "@/components/ui/logo";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { FlashcardRepository } from "@/components/flashcards/FlashcardRepository";

import { BrainCircuit } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default async function FlashcardsPage({ searchParams }: { searchParams: { blockId?: string } }) {
  const mockUserId = await getMockUserId();
  const { blockId } = await searchParams;

  let flashcards: any[] = [];
  try {
    flashcards = await (prisma as any).flashcard.findMany({
      where: { 
        userId: mockUserId,
        ...(blockId ? { studyBlockId: blockId } : {})
      },
      include: {
        subject: { select: { name: true } },
        material: { select: { fileName: true } },
        studyBlock: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  } catch (error) {
    console.error("Failed to fetch flashcards:", error);
  }

  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-700 slide-in-from-bottom-4 pb-20">
      <PageHeader 
        icon={BrainCircuit}
        title="Repositório de Flashcards"
        description="Área de edição e gerenciamento dos cards gerados automaticamente."
      />

      <FlashcardRepository initialFlashcards={flashcards} />
    </div>
  );
}
