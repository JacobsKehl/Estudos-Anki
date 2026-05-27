import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { clearSessionCookies, getSupabaseConfig } from "@/lib/supabase-server";

export async function POST() {
  try {
    const response = NextResponse.json({ success: true, message: "Sessão encerrada com sucesso" });
    
    // Limpar os cookies locais HTTP-Only no backend
    clearSessionCookies(response);
    
    // Realizar logout/revogação real de sessão no Supabase Auth se estiver configurado
    const { isConfigured, supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
    if (isConfigured) {
      const cookieStore = await cookies();
      const accessToken = cookieStore.get("sb-access-token")?.value;
      if (accessToken) {
        // Instancia o cliente com cabeçalho de autorização para invalidar o token no Supabase
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        });
        await client.auth.signOut();
      }
    }
    
    return response;
  } catch (err) {
    console.error("Erro no processamento do logout:", err);
    return NextResponse.json({ error: "Erro interno ao processar logout" }, { status: 500 });
  }
}
