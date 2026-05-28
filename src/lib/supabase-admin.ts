import { createClient } from "@supabase/supabase-js";

/**
 * Cria o cliente de administração do Supabase utilizando a Service Role Key.
 * ATENÇÃO: Esse cliente tem privilégios de bypass de RLS e NUNCA deve ser exposto ao frontend.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
