/**
 * Limpa todos os resíduos de autenticação/sessão do navegador,
 * preservando as preferências legítimas do Kehl Study.
 */
export function logoutClientSideCleanup() {
  if (typeof window === "undefined") return;

  // 1. Identificar chaves de autenticação no localStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const isAuthKey = 
        key.startsWith("sb-") || 
        key.startsWith("supabase.auth") || 
        key.toLowerCase().includes("supabase") || 
        key.toLowerCase().includes("auth-token");
      
      // NUNCA remover preferências do Kehl Study ou cooldown de verificação
      if (isAuthKey && 
          key !== "kehl_study_preferences" && 
          key !== "kehl_resend_verification_timestamp") {
        keysToRemove.push(key);
      }
    }
  }

  // 2. Remover do localStorage
  keysToRemove.forEach((key) => localStorage.removeItem(key));

  // 3. Identificar chaves de autenticação no sessionStorage
  const sessionKeysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key) {
      const isAuthKey = 
        key.startsWith("sb-") || 
        key.startsWith("supabase.auth") || 
        key.toLowerCase().includes("supabase") || 
        key.toLowerCase().includes("auth-token");
      
      if (isAuthKey && 
          key !== "kehl_study_preferences" && 
          key !== "kehl_resend_verification_timestamp") {
        sessionKeysToRemove.push(key);
      }
    }
  }

  // 4. Remover do sessionStorage
  sessionKeysToRemove.forEach((key) => sessionStorage.removeItem(key));

  // 5. Gravar evento de logout no localStorage para sincronizar outras abas
  localStorage.setItem("kehl_auth_logout_event", Date.now().toString());
}
