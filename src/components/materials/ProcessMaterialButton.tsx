"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProcessMaterialButtonProps {
  materialId: string;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "ERROR";
}

export function ProcessMaterialButton({ materialId, status: initialStatus }: ProcessMaterialButtonProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = React.useState(initialStatus === "PROCESSING");
  const [currentStatus, setCurrentStatus] = React.useState(initialStatus);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);

  // Sync with prop if it changes from outside
  React.useEffect(() => {
    setCurrentStatus(initialStatus);
    setIsProcessing(initialStatus === "PROCESSING");
  }, [initialStatus]);

  // Polling logic
  React.useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isProcessing) {
      // Simulate progress while polling
      const progressInterval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + Math.random() * 5 : prev));
      }, 2000);

      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/materials/${materialId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.processingStatus !== "PROCESSING") {
              setCurrentStatus(data.processingStatus);
              setIsProcessing(false);
              setProgress(data.processingStatus === "PROCESSED" ? 100 : 0);
              clearInterval(interval);
              clearInterval(progressInterval);
              router.refresh();
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);

      return () => {
        clearInterval(interval);
        clearInterval(progressInterval);
      };
    }
  }, [isProcessing, materialId, router]);

  const handleProcess = async () => {
    setIsProcessing(true);
    setProgress(5);
    setError(null);

    try {
      // Trigger process but don't wait for it if it's too long (it might timeout)
      // The polling will pick up the result
      fetch(`/api/materials/${materialId}/process`, {
        method: "POST",
      }).catch(err => console.error("Initial request error:", err));
      
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || "Falha na conexão.");
      setIsProcessing(false);
    }
  };

  if (currentStatus === "PROCESSED") {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-[200px]">
      <Button 
        onClick={handleProcess} 
        disabled={isProcessing}
        className="rounded-xl font-medium shadow-sm transition-all bg-accent hover:bg-accent/90 text-white w-full"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processando...
          </>
        ) : currentStatus === "ERROR" ? (
          <>
            <RotateCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 mr-2" />
            Extrair Texto
          </>
        )}
      </Button>

      {isProcessing && (
        <div className="space-y-1.5 animate-in fade-in duration-500">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-500 ease-out" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center font-medium animate-pulse">
            Extraindo conhecimento...
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}

