/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logo } from "@/components/ui/logo";
import { prisma } from "@/lib/prisma";
import { FlashcardCuration } from "@/components/flashcards/FlashcardCuration";

import { PageHeader } from "@/components/ui/page-header";

export default async function FlashcardsPage({ searchParams }: { searchParams: { blockId?: string } }) {
  const mockUserId = "cm39k012x0001k93jqwerty12";
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
        icon={Logo}
        title="Flashcards Inteligentes"
        description="Revise conceitos gerados por IA. Aprove os melhores cards para sua revisão diária."
      />

      <FlashcardCuration initialFlashcards={flashcards} />
    </div>
  );
}
