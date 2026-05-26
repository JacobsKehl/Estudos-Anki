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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Obter cookies da sessão
  const accessToken = req.cookies.get("sb-access-token")?.value;
  const isLoggedIn = accessToken && !isTokenExpired(accessToken);

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
      if (accessToken) {
        response.cookies.set("sb-access-token", "", { path: "/", maxAge: 0 });
        response.cookies.set("sb-refresh-token", "", { path: "/", maxAge: 0 });
      }
      return response;
    }
    return NextResponse.next();
  }

  // 2. Redirecionar usuário logado tentando acessar login/forgot-password para a home
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some(route => pathname === route);
  if (isPublicAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
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
