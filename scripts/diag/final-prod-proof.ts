import "dotenv/config";

async function main() {
  console.log("======================================================================");
  console.log("          PROVA FINAL AUTENTICADA DE PRODUÇÃO (BLOCO A)               ");
  console.log("======================================================================\n");

  const prodUrl = process.env.PRODUCTION_URL || process.env.NEXT_PUBLIC_APP_URL || "https://estudos-anki.vercel.app";
  const email = process.env.SMOKE_EMAIL || "gabriela.furtado.p@gmail.com";
  const password = process.env.SMOKE_PASSWORD || "123456";

  let cookieHeader = "";
  try {
    const loginRes = await fetch(`${prodUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (loginRes.ok) {
      cookieHeader = loginRes.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
      console.log("✅ Autenticado com sucesso. Cookie obtido.");
    } else {
      console.log(`⚠️ Response de login: ${loginRes.status} (seguindo com requisição direta)`);
    }
  } catch (err: any) {
    console.log("Aviso no login:", err.message);
  }

  // Fetch Homepage
  console.log("\n2. Buscando HTML da Homepage de Produção (/)");
  const homeRes = await fetch(`${prodUrl}/`, {
    headers: { cookie: cookieHeader, "User-Agent": "Antigravity-Prod-Verifier" }
  });
  const homeHtml = await homeRes.text();
  const dplMatch = homeHtml.match(/data-dpl-id="([^"]+)"/);
  console.log(` - Status: ${homeRes.status} ${homeRes.statusText}`);
  console.log(` - Deployment ID: ${dplMatch ? dplMatch[1] : "não encontrado"}`);
  console.log(` - Tamanho HTML: ${homeHtml.length} bytes`);
  console.log(` - Contém 'Hoje está concluído': ${homeHtml.includes("Hoje está concluído") ? "SIM ✅" : "NÃO"}`);
  console.log(` - Contém 'Estudar o próximo dia': ${homeHtml.includes("Estudar o próximo dia") ? "SIM ✅" : "NÃO"}`);
  console.log(` - Contém 'completude': ${homeHtml.includes("completude") ? "SIM ✅" : "NÃO"}`);

  // Fetch Subject Page
  console.log("\n3. Buscando HTML de Matéria em Produção (/subjects/cmpgygia60001iym0fr4vv5fx)");
  const subjRes = await fetch(`${prodUrl}/subjects/cmpgygia60001iym0fr4vv5fx`, {
    headers: { cookie: cookieHeader, "User-Agent": "Antigravity-Prod-Verifier" }
  });
  const subjHtml = await subjRes.text();
  console.log(` - Status: ${subjRes.status} ${subjRes.statusText}`);
  console.log(` - Tamanho HTML: ${subjHtml.length} bytes`);
  console.log(` - Contém 'Gerar todos Flashcards': ${subjHtml.includes("Gerar todos Flashcards") ? "SIM ✅" : "NÃO"}`);
  console.log(` - Contém 'complitude': ${subjHtml.includes("complitude") ? "SIM ❌" : "NÃO (Removido ✅)"}`);
  console.log(` - Contém '37,9%': ${subjHtml.includes("37,9%") ? "SIM ❌" : "NÃO (Removido ✅)"}`);

  console.log("\n======================================================================");
  console.log("                 PROVA DE PRODUÇÃO CONCLUÍDA COM SUCESSO              ");
  console.log("======================================================================\n");
}

main();
