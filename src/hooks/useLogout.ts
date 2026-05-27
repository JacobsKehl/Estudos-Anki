import { useState } from "react";
import { toast } from "sonner";
import { logoutClientSideCleanup } from "@/lib/auth-client";

export function useLogout() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const performLogout = async () => {
    setIsLoggingOut(true);
    const toastId = toast.loading("Encerrando sessão de estudos...");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Falha ao comunicar com o servidor");
      }

      // Limpeza híbrida ativa
      logoutClientSideCleanup();
      
      toast.success("Sessão encerrada com sucesso!", { id: toastId });
      
      // Redireciona para /login
      window.location.href = "/login";
    } catch (err) {
      console.error("Erro no logout:", err);
      toast.error("Erro ao desconectar. Forçando logout local...", { id: toastId });
      
      // Fallback local caso o backend falhe
      logoutClientSideCleanup();
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return { performLogout, isLoggingOut };
}
