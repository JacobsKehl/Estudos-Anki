"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Capturar tokens da URL e salvar no localStorage como backup client-side
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const accessToken = url.searchParams.get("access_token");
    const refreshToken = url.searchParams.get("refresh_token");

    if (accessToken && refreshToken) {
      localStorage.setItem("sb-access-token", accessToken);
      localStorage.setItem("sb-refresh-token", refreshToken);

      // Limpar a URL para segurança e estética (removendo tokens da barra de endereço)
      url.searchParams.delete("access_token");
      url.searchParams.delete("refresh_token");
      window.history.replaceState({}, document.title, url.pathname + url.search);
      
      toast.info("Conexão segura estabelecida.");
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("A senha deve conter no mínimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As senhas não coincidem. Verifique e tente novamente.");
      return;
    }

    setIsLoading(true);

    try {
      // O endpoint change-password atualiza a senha da sessão ativa.
      // Caso os cookies HttpOnly sejam bloqueados, enviamos o token no header Authorization
      const localToken = typeof window !== "undefined" ? localStorage.getItem("sb-access-token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (localToken) {
        headers["Authorization"] = `Bearer ${localToken}`;
      }

      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers,
        body: JSON.stringify({ newPassword: password })
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Erro ao redefinir sua senha. O link pode ter expirado.");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      toast.success("Sua senha foi redefinida com sucesso!");
      
      // Limpar os parâmetros e redirecionar após 3 segundos
      setTimeout(() => {
        router.push("/login?success=Sua senha foi redefinida. Faça login com sua nova senha.");
      }, 3000);
      
    } catch (err) {
      console.error(err);
      setErrorMessage("Erro de conexão ao servidor.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-brand-cream px-4 py-12 relative overflow-hidden select-none">
      {/* Decorative background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-sage-light/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-beige-soft/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Brand Logo Lockup */}
        <div className="flex flex-col items-center text-center space-y-2 mb-2">
          <BrandLockup variant="compact" className="scale-110 mb-2" />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            Plataforma de Estudos Premium
          </p>
        </div>

        {/* Card Content */}
        <Card className="rounded-[2.5rem] border-accent/15 bg-card shadow-[0_12px_40px_rgba(111,138,112,0.06)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/30 via-brand-beige-soft/30 to-accent/30" />
          
          <CardContent className="p-8 md:p-10 space-y-6">
            {!isSuccess ? (
              <>
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold font-serif text-brand-sage-dark">Nova Senha</h2>
                  <p className="text-xs text-muted-foreground">
                    Defina sua nova credencial de acesso seguro
                  </p>
                </div>

                <form onSubmit={handleReset} className="space-y-4">
                  {errorMessage && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Nova Senha (mín. 8 caracteres)
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60" />
                      <Input
                        id="password"
                        type="password"
                        required
                        placeholder="Mínimo 8 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 h-11 bg-muted/20 border-border/60 focus:border-accent"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Confirmar Nova Senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        required
                        placeholder="Repita sua senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 h-11 bg-muted/20 border-border/60 focus:border-accent"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl text-xs font-bold uppercase tracking-wider mt-4 flex items-center justify-center gap-2 group transition-transform active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Atualizando senha...
                      </>
                    ) : (
                      "Redefinir e Salvar"
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center space-y-4 py-4 animate-in fade-in zoom-in-95 duration-350">
                <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <CheckCircle2 className="w-6 h-6 animate-pulse" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-lg font-bold font-serif text-brand-sage-dark">Senha Redefinida!</h2>
                  <p className="text-xs text-muted-foreground">
                    Sua nova senha foi salva. Redirecionando para o login...
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-2">
              <Link 
                href="/login" 
                className="text-xs font-bold text-muted-foreground hover:text-accent transition-colors"
              >
                Voltar ao Login
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center">
          <p className="text-[11px] text-muted-foreground">
            Acesso seguro criptografado por Supabase.
          </p>
        </div>

      </div>
    </div>
  );
}
