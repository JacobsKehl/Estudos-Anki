"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface OrganizeAllButtonProps {
  unorganizedCount: number;
}

export function OrganizeAllButton({ unorganizedCount }: OrganizeAllButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleOrganizeAll = async () => {
    if (unorganizedCount === 0) {
      toast.info("Tudo organizado por aqui. Seus PDFs já foram analisados.");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Organizando seus estudos com IA...");

    try {
      const res = await fetch("/api/materials/organize-all", {
        method: "POST",
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      if (data.results?.success > 0) {
        setIsSuccess(true);
        toast.success(data.message, { id: toastId });
        router.refresh();
        
        // Reset success state after 5 seconds
        setTimeout(() => setIsSuccess(false), 5000);
      } else {
        toast.info(data.message, { id: toastId });
      }
    } catch (error: any) {
      toast.error(error.message || "Não conseguimos organizar seus estudos agora.", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  if (unorganizedCount === 0) {
    return (
      <Button 
        variant="outline"
        className="rounded-2xl h-14 px-8 border-green-200 text-green-700 bg-green-50/50 hover:bg-green-50 cursor-default"
        disabled
      >
        <CheckCircle2 className="w-5 h-5 mr-2" />
        Tudo Organizado
      </Button>
    );
  }

  return (
    <Button 
      className="rounded-2xl h-14 px-10 bg-accent text-white hover:bg-accent/90 shadow-xl shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98] font-bold text-lg"
      disabled={isLoading || isSuccess}
      onClick={handleOrganizeAll}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 mr-3 animate-spin" />
          Organizando...
        </>
      ) : isSuccess ? (
        <>
          <CheckCircle2 className="w-5 h-5 mr-3" />
          Sucesso!
        </>
      ) : (
        <>
          <Sparkles className="w-5 h-5 mr-3" />
          Organizar meus estudos ({unorganizedCount})
        </>
      )}
    </Button>
  );
}
