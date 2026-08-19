import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, anonKey);

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "gabriela.furtado.p@gmail.com",
    password: "12345678"
  });

  if (error) {
    console.error("Direct Supabase login error:", error);
    return;
  }

  console.log("Direct Supabase login SUCCESS!");
  console.log("Access Token:", data.session.access_token.substring(0, 30) + "...");

  const cookieHeader = `sb-access-token=${data.session.access_token}; sb-refresh-token=${data.session.refresh_token}`;

  const prodUrl = "https://estudos-anki.vercel.app";

  const apiRes = await fetch(`${prodUrl}/api/flagged-blocks`, {
    headers: { cookie: cookieHeader }
  });
  const apiText = await apiRes.text();
  console.log(`\nGET /api/flagged-blocks -> status ${apiRes.status}, body length: ${apiText.length}:`, apiText.substring(0, 300));

  const res = await fetch(`${prodUrl}/subjects`, {
    headers: {
      cookie: cookieHeader,
      "User-Agent": "Antigravity-Inspector/1.0"
    }
  });

  const html = await res.text();
  console.log(`HTTP ${res.status}, HTML length: ${html.length} bytes`);
  console.log(`- 'Painel de Confirmação de Blocos' in HTML: ${html.includes("Painel de Confirmação de Blocos")}`);
  console.log(`- '14 pendentes' in HTML: ${html.includes("14 pendentes")}`);
  console.log(`- 'Atos Administrativos' in HTML: ${html.includes("Atos Administrativos")}`);
  console.log(`- 'Recursos Trabalhistas' in HTML: ${html.includes("Recursos Trabalhistas")}`);
  console.log(`- 'Teletrabalho' in HTML: ${html.includes("Teletrabalho")}`);
  console.log(`- 'Já estudei' in HTML: ${html.includes("Já estudei")}`);
  console.log(`- 'Ainda não' in HTML: ${html.includes("Ainda não")}`);
  console.log(`- 'desta matéria' in HTML: ${html.includes("desta matéria")}`);
}

main();
