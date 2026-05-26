import { NextResponse } from "next/server";
import { getSessionUser, createSupabaseClient, getSupabaseConfig } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    // 1. Validar se o usuário está autenticado na sessão
    const user = await getSessionUser();
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
      
      // Opcional: Atualizar updatedAt no Prisma
      await prisma.user.update({
        where: { email: user.email },
        data: { updatedAt: new Date() }
      });

      return NextResponse.json({ success: true, message: "Senha atualizada com sucesso (Simulado)" });
    }

    const client = createSupabaseClient();

    // 2. Se a senha atual foi informada, validar por segurança extra (reautenticação)
    if (currentPassword) {
      const { error: reauthError } = await client.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (reauthError) {
        return NextResponse.json({ error: "A senha atual está incorreta" }, { status: 400 });
      }
    }

    // 3. Atualizar a senha no Supabase Auth
    const { error: updateError } = await client.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error("Erro ao atualizar senha no Supabase:", updateError);
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
