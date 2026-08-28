import "dotenv/config";
import fs from "fs";
import path from "path";

async function main() {
  console.log("======================================================================");
  console.log("SMOKE TEST EM PRODUÇÃO: VERIFICAÇÃO DO BLOCO PRÉ-CREDITADO F1");
  console.log("======================================================================\n");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estudos-anki.vercel.app";
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;

  if (!email || !password) {
    throw new Error("SMOKE_EMAIL ou SMOKE_PASSWORD não configurados no .env!");
  }

  // 1. Fazer login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const cookieHeader = loginRes.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");

  // 2. Buscar o bloco pré-creditado
  const precreditBlockId = "cmss35g1r0009iyaobhjwwlbd";
  const targetUrl = `${baseUrl}/blocks/${precreditBlockId}`;

  const res = await fetch(targetUrl, {
    headers: { cookie: cookieHeader }
  });

  const html = await res.text();
  const tmpPath = path.join(process.cwd(), "tmp", "smoke", "anchor_precredited_prod.html");
  fs.writeFileSync(tmpPath, html, "utf-8");

  console.log(`✅ HTML de produção salvo em ${tmpPath} (${html.length} bytes).\n`);

  // Greps
  const hasLerEsteBloco = html.includes("Ler este bloco");
  const hasPrimeiraLeitura = html.includes("Primeira Leitura");
  const hasCreditadoHistorico = html.includes("Creditado pelo Histórico");

  console.log("----------------------------------------------------------------------");
  console.log("RESULTADO DOS GREPS NO HTML DE PRODUÇÃO:");
  console.log("----------------------------------------------------------------------");
  console.log(`1. 'Ler este bloco': ${hasLerEsteBloco ? "ENCONTRADO ✅" : "NÃO ENCONTRADO ❌"}`);
  console.log(`2. 'Primeira Leitura': ${hasPrimeiraLeitura ? "ENCONTRADO ✅" : "NÃO ENCONTRADO ❌"}`);
  console.log(`3. 'Creditado pelo Histórico': ${hasCreditadoHistorico ? "ENCONTRADO ✅" : "NÃO ENCONTRADO ❌"}`);

  if (hasLerEsteBloco && hasPrimeiraLeitura && hasCreditadoHistorico) {
    console.log("\n🎉 FRENTE 1 ENTREGUE E COMPROVADA EM PRODUÇÃO COM SUCESSO!");
  }
}

main().catch(console.error);
