import { NextResponse } from "next/server";
import { createSupabaseClient, getSupabaseConfig } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "E-mail é obrigatório" }, { status: 400 });
    }

    const emailKey = email.toLowerCase().trim();
    const { isConfigured } = getSupabaseConfig();
    
    // Capturar a origem da requisição para redirecionar de volta após login no Supabase
    const { origin } = new URL(request.url);
    const redirectTo = `${origin}/auth/callback?next=/reset-password`;

    if (!isConfigured) {
      // DEV MODE: Simulação local
      const mockCallbackUrl = `${redirectTo}&code=mock-recovery-code-for-${emailKey}`;
      console.info(`\n=== [SIMULAÇÃO RECUPERAÇÃO DE SENHA] ===`);
      console.info(`Destinatário: ${emailKey}`);
      console.info(`Link de Redefinição: ${mockCallbackUrl}`);
      console.info(`========================================\n`);

      return NextResponse.json({ 
        success: true, 
        message: "Se houver uma conta com este e-mail, enviaremos as instruções de recuperação." 
      });
    }

    // FLUXO REAL: Supabase resetPasswordForEmail
    const client = createSupabaseClient();
    const { error } = await client.auth.resetPasswordForEmail(emailKey, {
      redirectTo
    });

    if (error) {
      // Registrar o erro internamente, mas retornar sucesso genérico para o cliente (evitando enumeração)
      console.warn(`[Forgot Password] Erro ao disparar redefinição no Supabase (silenciado):`, error.message);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Se houver uma conta com este e-mail, enviaremos as instruções de recuperação." 
    });

  } catch (err) {
    console.error("Erro na rota de recuperação de senha:", err);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
