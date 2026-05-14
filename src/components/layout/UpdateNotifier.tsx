"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function UpdateNotifier() {
  const [status, setStatus] = useState<
    "idle" | "checking" | "available" | "downloading" | "downloaded" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    // Only run if window.electron is available
    if (!(window as any).electron) return;

    const { receive, send } = (window as any).electron;

    receive("checking_updates", () => setStatus("checking"));
    
    receive("update_available", (info: any) => {
      setStatus("available");
      toast.info(`Nova versão disponível: ${info.version}`, {
        description: "Deseja baixar agora?",
        action: {
          label: "Baixar",
          onClick: () => send("start-download"),
        },
      });
    });

    receive("download_progress", (progressObj: any) => {
      setStatus("downloading");
      setProgress(Math.round(progressObj.percent));
    });

    receive("update_downloaded", () => {
      setStatus("downloaded");
      toast.success("Atualização baixada!", {
        description: "O aplicativo precisa ser reiniciado para aplicar as mudanças.",
        action: {
          label: "Reiniciar",
          onClick: () => send("quit-and-install"),
        },
      });
    });

    receive("update_error", (err: string) => {
      setStatus("error");
      setError(err);
      toast.error("Erro na atualização", { description: err });
    });

    receive("update_not_available", () => setStatus("idle"));

  }, []);

  if (status === "idle" || status === "checking") return null;

  return (
    <div className="fixed bottom-20 right-6 z-[60] animate-in fade-in slide-in-from-right-4">
      {status === "downloading" && (
        <div className="bg-card border border-border shadow-2xl rounded-2xl p-4 w-72 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 text-accent rounded-lg animate-pulse">
              <Download className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Baixando Update</p>
              <p className="text-sm font-semibold">{progress}% concluído</p>
            </div>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-300" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
      )}

      {status === "downloaded" && (
        <div className="bg-emerald-50 border border-emerald-100 shadow-xl rounded-2xl p-4 w-72 space-y-3">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-bold">Update pronto!</p>
          </div>
          <Button 
            size="sm" 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2"
            onClick={() => (window as any).electron.send("quit-and-install")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reiniciar e Instalar
          </Button>
        </div>
      )}
    </div>
  );
}
