import "dotenv/config";

async function main() {
  console.log("======================================================================");
  console.log("    VERIFICAÇÃO DE DEPLOY E GREP NO HTML DE PRODUÇÃO (BLOCO A)        ");
  console.log("======================================================================\n");

  const prodUrl = process.env.PRODUCTION_URL || process.env.NEXT_PUBLIC_APP_URL || "https://estudos-anki.vercel.app";
  const email = process.env.SMOKE_EMAIL || "gabriela.furtado.p@gmail.com";
  const password = process.env.SMOKE_PASSWORD || "123456";

  console.log(`Buscando HTML de Produção em: ${prodUrl} (Usuário: ${email})`);

  let cookieHeader = "";
  try {
    const loginRes = await fetch(`${prodUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (loginRes.ok) {
      cookieHeader = loginRes.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
      console.log("✅ Login efetuado com sucesso em produção.");
    }
  } catch (err: any) {
    console.warn("Aviso ao fazer login:", err.message);
  }

  try {
    const res = await fetch(prodUrl, {
      headers: {
        "User-Agent": "Antigravity-Deploy-Verifier/1.0",
        ...(cookieHeader ? { cookie: cookieHeader } : {})
      }
    });

    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    const html = await res.text();

    console.log(`Tamanho do HTML retornado: ${html.length} bytes`);

    // 1. Grep por completude vs complitude
    const hasCompletude = html.includes("completude");
    const hasComplitude = html.includes("complitude");
    console.log(`\n1. GREP GRAFIA:`);
    console.log(` - Contém 'completude': ${hasCompletude ? "YES ✅" : "NO"}`);
    console.log(` - Contém 'complitude': ${hasComplitude ? "YES ❌" : "NO (Corrigido ✅)"}`);

    // 2. Grep por porcentagens estáticas (37,9% / 48,3%)
    const has379 = html.includes("37,9%");
    const has483 = html.includes("48,3%");
    console.log(`\n2. GREP PORCENTAGENS HARDCODED:`);
    console.log(` - Contém '37,9%': ${has379 ? "YES ❌" : "NO (Removido ✅)"}`);
    console.log(` - Contém '48,3%': ${has483 ? "YES ❌" : "NO (Removido ✅)"}`);

    // 3. Deployment ID / Build Hash
    const dplMatch = html.match(/data-dpl-id="([^"]+)"/);
    if (dplMatch) {
      console.log(`\n3. DEPLOYMENT ID DETECTADO EM PRODUÇÃO: ${dplMatch[1]}`);
    }

    // 4. Verificação na página de Matérias (/subjects)
    const subjectsRes = await fetch(`${prodUrl}/subjects`, {
      headers: {
        "User-Agent": "Antigravity-Deploy-Verifier/1.0",
        ...(cookieHeader ? { cookie: cookieHeader } : {})
      }
    });

    const subjectsHtml = await subjectsRes.text();
    console.log(`\n4. VERIFICAÇÃO NA PÁGINA /subjects (${subjectsRes.status} ${subjectsRes.statusText}):`);
    console.log(` - Tamanho HTML /subjects: ${subjectsHtml.length} bytes`);
    console.log(` - Contém 'Gerar todos Flashcards': ${subjectsHtml.includes("Gerar todos Flashcards") ? "YES ✅" : "NO"}`);
    console.log(` - Contém 'completude': ${subjectsHtml.includes("completude") ? "YES ✅" : "NO"}`);
    console.log(` - Contém 'complitude': ${subjectsHtml.includes("complitude") ? "YES ❌" : "NO (Corrigido ✅)"}`);
    console.log(` - Contém '37,9%': ${subjectsHtml.includes("37,9%") ? "YES ❌" : "NO (Removido ✅)"}`);
  } catch (err: any) {
    console.error("Erro ao verificar produção via HTTP:", err.message);
  }
}

main();
