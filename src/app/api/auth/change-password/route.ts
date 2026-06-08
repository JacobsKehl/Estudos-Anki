import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseConfig, createSupabaseClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    // 1. Validar se o usuário está autenticado na sessão (por cookies)
    let user = await getSessionUser();

    // Fallback: Se não encontrou por cookies (ex: bloqueados pelo navegador), tentar pelo header Authorization
    if (!user) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const { isConfigured } = getSupabaseConfig();
        if (isConfigured) {
          const client = createSupabaseClient();
          const { data: { user: supabaseUser }, error } = await client.auth.getUser(token);
          if (!error && supabaseUser) {
            user = supabaseUser;
            console.info("[CHANGE PASSWORD] Usuário autenticado via header Authorization backup:", user.email);
          } else if (error) {
            console.error("[CHANGE PASSWORD] Falha ao validar token do header Authorization:", error.message);
          }
        }
      }
    }

    if (!user || !user.email) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: "A nova senha deve conter pelo menos 8 caracteres" }, { status: 400 });
    }

    const { isConfigured } = getSupabaseConfig();

    if (!isConfigured) {
      // DEV MODE: Simulação local
      console.info(`[MOCK PASSWORD CHANGE] Senha alterada para o usuário: ${user.email}`);
      
      await prisma.user.update({
        where: { email: user.email },
        data: { updatedAt: new Date() }
      });

      return NextResponse.json({ success: true, message: "Senha atualizada com sucesso (Simulado)" });
    }

    // 2. Se a senha atual foi informada, validar por segurança extra (reautenticação)
    if (currentPassword) {
      const client = createSupabaseClient();
      const { error: reauthError } = await client.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (reauthError) {
        return NextResponse.json({ error: "A senha atual está incorreta" }, { status: 400 });
      }
    }

    // 3. Atualizar a senha no Supabase Auth usando o admin client (service role)
    //    O admin client é necessário porque o client anônimo não possui sessão ativa
    //    e client.auth.updateUser() requer uma sessão para funcionar.
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.error("[CHANGE PASSWORD ERROR] SUPABASE_SERVICE_ROLE_KEY ausente.");
      return NextResponse.json({ error: "Erro de configuração administrativa." }, { status: 500 });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: newPassword
    });

    if (updateError) {
      console.error("Erro ao atualizar senha no Supabase via admin:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // 4. Registrar alteração local no Prisma
    await prisma.user.update({
      where: { authUserId: user.id },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json({ success: true, message: "Sua senha foi alterada com sucesso!" });

  } catch (err) {
    console.error("Erro na rota de alteração de senha:", err);
    return NextResponse.json({ error: "Erro interno ao processar alteração de senha" }, { status: 500 });
  }
}

