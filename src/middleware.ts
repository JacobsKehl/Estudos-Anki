import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Lista de rotas que exigem autenticação
const PRIVATE_ROUTES = [
  "/",
  "/profile",
  "/materials",
  "/schedule",
  "/subjects",
  "/flashcards",
  "/reviews",
  "/settings",
  "/blocks",
  "/stats"
];

// Lista de rotas públicas de autenticação
const PUBLIC_AUTH_ROUTES = [
  "/login",
  "/forgot-password"
];

/**
 * Decodifica o payload do JWT e valida se o token está expirado localmente (0ms latency)
 */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    
    // Decodificar base64url no middleware usando atob
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payloadDecoded = atob(payloadBase64);
    const payload = JSON.parse(payloadDecoded);
    
    if (payload && typeof payload.exp === "number") {
      // Deixar margem de 10 segundos de segurança
      return Date.now() >= (payload.exp * 1000 - 10000);
    }
    return true;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Obter cookies da sessão
  const accessToken = req.cookies.get("sb-access-token")?.value;
  const refreshToken = req.cookies.get("sb-refresh-token")?.value;
  let isLoggedIn = accessToken && !isTokenExpired(accessToken);

  let newAccessToken = null;
  let newRefreshToken = null;
  let newExpiresIn = null;
  let hasRefreshed = false;

  // Se o token estiver expirado/ausente, mas houver um refresh-token ativo, tenta renová-lo
  if (!isLoggedIn && refreshToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const refreshResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: {
            "apikey": supabaseAnonKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          newAccessToken = refreshData.access_token;
          newRefreshToken = refreshData.refresh_token;
          newExpiresIn = refreshData.expires_in;
          isLoggedIn = true;
          hasRefreshed = true;
        }
      } catch (err) {
        console.error("Erro ao renovar token no middleware:", err);
      }
    }
  }

  // 1. Verificar se a rota atual é privada
  const isPrivateRoute = PRIVATE_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isPrivateRoute) {
    if (!isLoggedIn) {
      // Redireciona para login guardando a URL de origem
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirectedFrom", pathname);
      
      const response = NextResponse.redirect(loginUrl);
      // Limpa cookies inválidos de sessão se existirem
      if (accessToken || refreshToken) {
        response.cookies.set("sb-access-token", "", { path: "/", maxAge: 0 });
        response.cookies.set("sb-refresh-token", "", { path: "/", maxAge: 0 });
      }
      return response;
    }
    
    const response = NextResponse.next();
    if (hasRefreshed && newAccessToken && newRefreshToken && newExpiresIn) {
      const isProd = process.env.NODE_ENV === "production";
      response.cookies.set("sb-access-token", newAccessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // Mantém ativo por 30 dias no dispositivo atual
      });
      response.cookies.set("sb-refresh-token", newRefreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    return response;
  }

  // 2. Redirecionar usuário logado tentando acessar login/forgot-password para a home
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some(route => pathname === route);
  if (isPublicAuthRoute && isLoggedIn) {
    const response = NextResponse.redirect(new URL("/", req.url));
    if (hasRefreshed && newAccessToken && newRefreshToken && newExpiresIn) {
      const isProd = process.env.NODE_ENV === "production";
      response.cookies.set("sb-access-token", newAccessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      response.cookies.set("sb-refresh-token", newRefreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    return response;
  }

  const response = NextResponse.next();
  if (hasRefreshed && newAccessToken && newRefreshToken && newExpiresIn) {
    const isProd = process.env.NODE_ENV === "production";
    response.cookies.set("sb-access-token", newAccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    response.cookies.set("sb-refresh-token", newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return response;
}

// Configurar o matcher para rodar o middleware apenas em páginas e APIs relevantes,
// evitando assets estáticos (_next, public, favicon, etc.)
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icon.png, apple-icon.png
     * - images, public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.css|.*\\.js|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg).*)",
  ],
};
