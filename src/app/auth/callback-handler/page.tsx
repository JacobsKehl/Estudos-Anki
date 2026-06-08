"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Página intermediária client-side que captura tokens do hash fragment (#access_token=...&refresh_token=...)
 * e os encaminha para o callback server-side (/auth/callback) como query params.
 * 
 * Necessária porque:
 * - O Supabase envia tokens de recovery/invite no hash fragment da URL
 * - Hash fragments (#...) NÃO são enviados ao servidor em requests HTTP
 * - O route handler /auth/callback é server-side e nunca recebe esses tokens
 * - Esta página roda no browser, captura o hash, e redireciona com os tokens nos query params
 * 
 * Fluxo:
 * 1. Supabase redireciona para /auth/callback-handler?next=/reset-password#access_token=...&refresh_token=...
 * 2. Esta página captura o hash fragment no browser
 * 3. Redireciona para /auth/callback?access_token=...&refresh_token=...&next=/reset-password
 * 4. O route handler server-side grava os cookies e redireciona para /reset-password
 */
export default function AuthCallbackHandlerPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const next = url.searchParams.get("next") || "/";
    const hashIndex = window.location.href.indexOf("#");

    if (hashIndex !== -1) {
      const hash = window.location.href.substring(hashIndex + 1);
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const expiresIn = hashParams.get("expires_in") || "3600";

      if (accessToken && refreshToken) {
        // Backup client-side dos tokens em localStorage caso cookies sejam bloqueados/rejeitados
        localStorage.setItem("sb-access-token", accessToken);
        localStorage.setItem("sb-refresh-token", refreshToken);

        // Encaminhar para o callback server-side com tokens como query params
        const callbackUrl = `/auth/callback?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&expires_in=${encodeURIComponent(expiresIn)}&next=${encodeURIComponent(next)}`;
        window.location.href = callbackUrl;
        return;
      }
    }

    // Se não houver hash fragment, verificar se há um code no query param
    const code = url.searchParams.get("code");
    if (code) {
      const callbackUrl = `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
      window.location.href = callbackUrl;
      return;
    }

    // Fallback: se não houver tokens nem código, redirecionar para login
    window.location.href = `/login?error=${encodeURIComponent("Link de recuperação inválido ou expirado. Solicite um novo.")}`;
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-brand-cream gap-4">
      <Loader2 className="w-8 h-8 text-accent animate-spin" />
      <p className="text-sm text-muted-foreground font-medium">
        Validando seu acesso seguro...
      </p>
    </div>
  );
}
