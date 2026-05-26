import { NextResponse } from "next/server";
import { clearSessionCookies, createSupabaseClient, getSupabaseConfig } from "@/lib/supabase-server";

export async function POST() {
  try {
    const response = NextResponse.json({ success: true, message: "Sessão encerrada com sucesso" });
    
    // Limpar os cookies locais HTTP-Only
    clearSessionCookies(response);
    
    // Realizar logout no Supabase Auth se estiver configurado
    const { isConfigured } = getSupabaseConfig();
    if (isConfigured) {
      const client = createSupabaseClient();
      await client.auth.signOut();
    }
    
    return response;
  } catch (err) {
    console.error("Erro no processamento do logout:", err);
    return NextResponse.json({ error: "Erro interno ao processar logout" }, { status: 500 });
  }
}
