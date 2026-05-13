"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const router = useRouter();

  return (
    <Button 
      variant="link" 
      className="text-accent" 
      onClick={() => router.refresh()}
    >
      Atualizar para ver alterações
    </Button>
  );
}
