"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, Loader2, ArrowRight, ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface RegisterClientProps {
  enableSignup: boolean;
}

export function RegisterClient({ enableSignup }: RegisterClientProps) {
  const router = useRouter();

  // Estados do formulário
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Estados de controle
  const [isLoading, setIsLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  
  // Cooldown de reenvio de e-mail (segundos)
  const [resendCooldown, setResendCooldown] = useState(0);

  // Efeito para decrementar o cronômetro do cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Se o cadastro estiver desabilitado, renderiza tela de cadastro restrito
  if (!enableSignup) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-brand-cream px-4 py-12 relative overflow-hidden select-none">
        {/* Elementos decorativos de fundo */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-sage-light/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-beige-soft/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md space-y-6 z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col items-center text-center space-y-2 mb-2">
            <BrandLockup variant="compact" className="scale-110 mb-2" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
              Plataforma de Estudos Premium
            </p>
          </div>

          <Card className="rounded-[2.5rem] border-accent/15 bg-card shadow-[0_12px_40px_rgba(111,138,112,0.06)] overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/30 via-brand-beige-soft/30 to-accent/30" />
            <CardContent className="p-8 md:p-10 space-y-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/20">
                <ShieldAlert className="h-6 w-6 text-rose-700 dark:text-rose-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold font-serif text-brand-sage-dark">Cadastro Restrito</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O cadastro está temporariamente restrito. Entre em contato com o administrador para solicitar acesso.
                </p>
              </div>

              <Link href="/login" passHref>
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl text-xs font-bold uppercase tracking-wider mt-4 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para o Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Se o cadastro foi realizado com sucesso, renderiza tela de confirmação pendente
  if (registeredEmail) {
    const handleResend = async () => {
      if (resendCooldown > 0) return;
      setIsResending(true);

      try {
        const response = await fetch("/api/auth/resend-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: registeredEmail })
        });

        const data = await response.json();

        if (!response.ok) {
          toast.error(data.error || "Erro ao reenviar confirmação.");
        } else {
          toast.success(data.message || "Link de confirmação enviado com sucesso!");
          setResendCooldown(60); // Inicia cooldown de 60 segundos
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
        {/* Elementos decorativos de fundo */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-sage-light/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-beige-soft/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md space-y-6 z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col items-center text-center space-y-2 mb-2">
            <BrandLockup variant="compact" className="scale-110 mb-2" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
              Plataforma de Estudos Premium
            </p>
          </div>

          <Card className="rounded-[2.5rem] border-accent/15 bg-card shadow-[0_12px_40px_rgba(111,138,112,0.06)] overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/30 via-brand-beige-soft/30 to-accent/30" />
            <CardContent className="p-8 md:p-10 space-y-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sage-light/20 border border-accent/20">
                <CheckCircle2 className="h-6 w-6 text-accent" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold font-serif text-brand-sage-dark">Conta criada!</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enviamos um link de confirmação para seu e-mail (<span className="font-bold text-foreground">{registeredEmail}</span>). 
                  Confirme seu endereço para ativar o acesso ao Kehl Study.
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <Link href="/login" passHref className="block">
                  <Button
                    variant="primary"
                    className="w-full h-11 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    Voltar para o Login
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  onClick={handleResend}
                  disabled={isResending || resendCooldown > 0}
                  className="w-full h-11 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Reenviando...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Aguarde ${resendCooldown}s`
                  ) : (
                    "Reenviar confirmação"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Formulário de Cadastro Principal (Visual Soft Premium)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações locais adicionais para feedback imediato e amigável
    if (!name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    if (!email.trim()) {
      toast.error("E-mail é obrigatório.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Ocorreu um erro ao criar a conta.");
        setIsLoading(false);
        return;
      }

      toast.success("Conta registrada com sucesso!");
      setRegisteredEmail(email.toLowerCase().trim());
      
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão ao servidor.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-brand-cream px-4 py-12 relative overflow-hidden select-none">
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-sage-light/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-beige-soft/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="flex flex-col items-center text-center space-y-2 mb-2">
          <BrandLockup variant="compact" className="scale-110 mb-2" />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            Plataforma de Estudos Premium
          </p>
        </div>

        {/* Card de Cadastro */}
        <Card className="rounded-[2.5rem] border-accent/15 bg-card shadow-[0_12px_40px_rgba(111,138,112,0.06)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/30 via-brand-beige-soft/30 to-accent/30" />
          
          <CardContent className="p-8 md:p-10 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold font-serif text-brand-sage-dark">Crie sua Conta</h2>
              <p className="text-xs text-muted-foreground">Preencha os campos para iniciar seus estudos</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Seu nome
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="name"
                    type="text"
                    required
                    placeholder="Ex: Gabriela Furtado"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-11 bg-muted/20 border-border/60 focus:border-accent"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  E-mail de cadastro
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

              {/* Senha */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Escolha uma senha
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

              {/* Confirmar Senha */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Confirme sua senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    placeholder="Confirme a senha escolhida"
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
                className="w-full h-11 rounded-xl text-xs font-bold uppercase tracking-wider mt-6 flex items-center justify-center gap-2 group transition-transform active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  <>
                    Registrar e Iniciar
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Link para voltar ao Login */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Já tem uma conta?{" "}
            <Link 
              href="/login" 
              className="font-bold text-accent hover:text-brand-sage-dark transition-colors hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
