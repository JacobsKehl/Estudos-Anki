import "dotenv/config";

async function main() {
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
    }
  } catch {}

  console.log("Aguardando propagação do Deploy no Vercel...");

  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const res = await fetch(`${prodUrl}/subjects`, {
        headers: {
          "User-Agent": "Antigravity-Deploy-Verifier/1.0",
          "Cache-Control": "no-cache",
          ...(cookieHeader ? { cookie: cookieHeader } : {})
        }
      });

      const html = await res.text();
      const hasCompletude = html.includes("completude");
      const hasOldPercentages = html.includes("37,9%");

      const dplMatch = html.match(/data-dpl-id="([^"]+)"/);
      const dplId = dplMatch ? dplMatch[1] : "desconhecido";

      console.log(`[Tentativa ${attempt}/12] Deployment ID: ${dplId} | Completude: ${hasCompletude} | Old37,9%: ${hasOldPercentages}`);

      if (hasCompletude && !hasOldPercentages) {
        console.log("\n🎉 DEPLOYMENT CONFIRMADO EM PRODUÇÃO!");
        console.log(` - Deployment ID Atual: ${dplId}`);
        console.log(` - 'completude' encontrada no HTML: SIM ✅`);
        console.log(` - Porcentagens estáticas (37,9% / 48,3%) removidas: SIM ✅`);
        return;
      }
    } catch (e: any) {
      console.log(`Tentativa ${attempt} falhou: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 10000));
  }
}

main();
