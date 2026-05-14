"use client";

import { FlashcardSession } from "@/components/flashcards/FlashcardSession";
import { useRouter } from "next/navigation";

export function ReviewSessionClient({ cards }: { cards: any[] }) {
  const router = useRouter();

  return (
    <FlashcardSession 
      mode="review"
      title="Sessão de Revisão SRS"
      cards={cards} 
      onComplete={() => {
        router.push("/");
        router.refresh();
      }} 
    />
  );
}
