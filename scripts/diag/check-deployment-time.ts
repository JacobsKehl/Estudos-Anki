import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, anonKey);

async function main() {
  const { data } = await supabase.auth.signInWithPassword({
    email: "gabriela.furtado.p@gmail.com",
    password: "12345678"
  });

  const accessToken = data?.session?.access_token || "";
  const refreshToken = data?.session?.refresh_token || "";
  const cookieHeader = `sb-access-token=${accessToken}; sb-refresh-token=${refreshToken}`;
  const prodUrl = "https://estudos-anki.vercel.app";

  console.log("Checking Vercel deployment of /api/flagged-blocks...");
  for (let i = 1; i <= 6; i++) {
    const res = await fetch(`${prodUrl}/api/flagged-blocks`, { headers: { cookie: cookieHeader } });
    console.log(`[Attempt ${i}] /api/flagged-blocks status: ${res.status}`);
    if (res.status === 200) {
      const json = await res.json();
      console.log("SUCCESS! Flagged blocks count:", json.count);
      break;
    }
    await new Promise(r => setTimeout(r, 5000));
  }

  const pageRes = await fetch(`${prodUrl}/subjects`, { headers: { cookie: cookieHeader } });
  const html = await pageRes.text();
  console.log("\n--- SSR /subjects HTML Inspection ---");
  console.log("HTML Length:", html.length);
  console.log("- 'Painel de Confirmação de Blocos' in HTML:", html.includes("Painel de Confirmação de Blocos"));
  console.log("- '14 pendentes' in HTML:", html.includes("14 pendentes"));
  console.log("- 'Atos Administrativos' in HTML:", html.includes("Atos Administrativos"));
  console.log("- 'Recursos Trabalhistas' in HTML:", html.includes("Recursos Trabalhistas"));
  console.log("- 'Teletrabalho' in HTML:", html.includes("Teletrabalho"));
}

main();
