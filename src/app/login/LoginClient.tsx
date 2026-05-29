"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface LoginClientProps {
  enableSignup: boolean;
}

export function LoginClient({ enableSignup }: LoginClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showResendForEmail, setShowResendForEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  // Interceptar convites implícitos (fragmento de hash com access_token) no cliente
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const expiresIn = params.get("expires_in");

      if (accessToken && refreshToken) {
        setIsLoading(true);
        const toastId = toast.loading("Configurando sua conta exclusiva... Bem-vindo!");
        
        // Encaminhar tokens de acesso na query de forma segura para o callback definir cookies e sincronizar
        const callbackUrl = `/auth/callback?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&expires_in=${expiresIn || "3600"}`;
        
        // Redirecionamento completo do navegador para atualizar os cookies de sessão de forma síncrona
        window.location.href = callbackUrl;
      }
    }
  }, []);

  // Mensagens vindas do redirect
  useEffect(() => {
    const errorParam = searchParams.get("error");
    const redirectedParam = searchParams.get("redirectedFrom");
    const successParam = searchParams.get("success");

    if (errorParam) {
      toast.error(errorParam);
    }
    if (redirectedParam) {
      toast.info("Por favor, faça login para acessar esta página.");
    }
    if (successParam) {
      toast.success(successParam);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setShowResendForEmail(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "email_not_confirmed") {
          setShowResendForEmail(data.email || email);
        }
        toast.error(data.error || "E-mail ou senha incorretos.");
        setIsLoading(false);
        return;
      }

      toast.success("Login realizado com sucesso! Bons estudos!");
      
      const redirectPath = searchParams.get("redirectedFrom") || "/";
      router.push(redirectPath);
      router.refresh();
      
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão ao servidor.");
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!showResendForEmail) return;
    setIsResending(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: showResendForEmail })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao reenviar e-mail de confirmação.");
      } else {
        toast.success(data.message || "Link de confirmação enviado com sucesso!");
        setShowResendForEmail(null);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão ao servidor.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-brand-cream px-4 py-12 relative overflow-hidden select-none">
      {/* Elementos decorativos de fundo com opacidade sutil */}
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

        {/* Card de Login */}
        <Card className="rounded-[2.5rem] border-accent/15 bg-card shadow-[0_12px_40px_rgba(111,138,112,0.06)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/30 via-brand-beige-soft/30 to-accent/30" />
          
          <CardContent className="p-8 md:p-10 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold font-serif text-brand-sage-dark">Boas-vindas ao Kehl Study</h2>
              <p className="text-xs text-muted-foreground">Insira suas credenciais para continuar</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  E-mail de acesso
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="estudante@kehl.study"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-muted/20 border-border/60 focus:border-accent"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Sua senha
                  </Label>
                  <Link 
                    href="/forgot-password" 
                    className="text-[11px] font-bold text-accent hover:text-brand-sage-dark transition-colors"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="password"
                    type="password"
                    required
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 bg-muted/20 border-border/60 focus:border-accent"
                  />
                </div>
              </div>

              {/* Banner de reenvio de confirmação de e-mail */}
              {showResendForEmail && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/15 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-rose-700 dark:text-rose-300 leading-relaxed">
                    Seu e-mail ainda não foi verificado. Clique abaixo para receber um novo link de confirmação no seu e-mail.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="w-full text-xs font-bold h-9 rounded-xl border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 active:scale-[0.98] transition-transform"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Reenviando...
                      </>
                    ) : (
                      "Reenviar confirmação"
                    )}
                  </Button>
                </div>
              )}

              {/* Permanecer conectado */}
              <div className="flex items-center space-x-2.5 py-1 select-none">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4.5 h-4.5 rounded-[6px] border-border/70 text-accent focus:ring-accent bg-muted/15 cursor-pointer accent-accent"
                />
                <Label htmlFor="rememberMe" className="text-xs font-semibold text-muted-foreground cursor-pointer transition-colors hover:text-foreground">
                  Permanecer conectada neste dispositivo
                </Label>
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
                    Autenticando...
                  </>
                ) : (
                  <>
                    Acessar Plataforma
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info com acesso dinâmico de cadastro */}
        {enableSignup ? (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Não tem uma conta?{" "}
              <Link 
                href="/register" 
                className="font-bold text-accent hover:text-brand-sage-dark transition-colors hover:underline"
              >
                Criar conta
              </Link>
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground">
              Acesso exclusivo para estudantes convidados. <span className="font-bold text-brand-sage-dark">Cadastro restrito.</span>
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
