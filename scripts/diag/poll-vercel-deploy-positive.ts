import "dotenv/config";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const prodUrl = process.env.PRODUCTION_URL || process.env.NEXT_PUBLIC_APP_URL || "https://estudos-anki.vercel.app";
  const email = process.env.SMOKE_EMAIL || "gabriela.furtado.p@gmail.com";
  const password = process.env.SMOKE_PASSWORD || "123456";

  console.log("Polling Vercel para promover o commit 36d921b6 em Produção...");

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

  const initialDpl = "dpl_GufB5jBLnvxg7ZLUNt9LQVoC7u4D";

  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      const res = await fetch(`${prodUrl}/subjects`, {
        headers: {
          cookie: cookieHeader,
          "User-Agent": "Antigravity-Deploy-Poller/1.0",
          "Cache-Control": "no-cache"
        }
      });

      const html = await res.text();
      const dplMatch = html.match(/data-dpl-id="([^"]+)"/);
      const currentDpl = dplMatch ? dplMatch[1] : "desconhecido";

      const hasCompletude = html.includes("completude");
      const has379 = html.includes("37,9%");

      console.log(`[Tentativa ${attempt}/15] Deployment ID: ${currentDpl} | Completude: ${hasCompletude} | 37,9%: ${has379}`);

      if (currentDpl !== initialDpl || (hasCompletude && !has379)) {
        console.log("\n🎉 NOVO DEPLOYMENT PUBLICADO EM PRODUÇÃO!");
        console.log(` - Deployment ID Antigo: ${initialDpl}`);
        console.log(` - Deployment ID Novo:   ${currentDpl}`);
        console.log(` - 'completude' encontrada no HTML: ${hasCompletude}`);
        console.log(` - Porcentagem '37,9%' removida:    ${!has379}`);
        return;
      }
    } catch (err: any) {
      console.log(`Tentativa ${attempt} erro: ${err.message}`);
    }

    await sleep(10000);
  }
}

main();
