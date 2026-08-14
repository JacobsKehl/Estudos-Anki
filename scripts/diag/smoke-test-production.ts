import "dotenv/config";
import fs from "fs";
import path from "path";

const PROD_BASE_URL = "https://estudos-anki.vercel.app";

async function main() {
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;

  if (!email || !password) {
    console.error("🛑 ERRO: Variáveis SMOKE_EMAIL e SMOKE_PASSWORD não encontradas no .env! Abortando.");
    process.exit(1);
  }

  console.log("======================================================================");
  console.log("           SMOKE TEST EM PRODUÇÃO COM SESSÃO AUTENTICADA              ");
  console.log("======================================================================\n");

  // 1. POST /api/auth/login
  console.log(`🔑 Autenticando em ${PROD_BASE_URL}/api/auth/login...`);
  const loginRes = await fetch(`${PROD_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe: true })
  });

  console.log(`   HTTP Response Code: ${loginRes.status} ${loginRes.statusText}`);
  const setCookieHeader = loginRes.headers.get("set-cookie");
  
  if (!loginRes.ok) {
    const errorBody = await loginRes.json().catch(() => ({}));
    console.error("❌ FALHA NO LOGIN EM PRODUÇÃO:");
    console.error(JSON.stringify(errorBody, null, 2));
    process.exit(1);
  }

  console.log("\n🍪 Cookies de Sessão Retornados pelo Login:");
  if (setCookieHeader) {
    const cookiePairs = setCookieHeader.split(/,(?=\s*sb-)/).map(c => c.trim());
    const cookieNames = cookiePairs.map(c => c.split("=")[0].trim());
    console.log(`   Nomes dos cookies: [${cookieNames.join(", ")}]`);
  } else {
    console.log("   ⚠️ NENHUM CABEÇALHO SET-COOKIE RECEBIDO.");
  }

  const rawCookies = setCookieHeader || "";

  const tmpDir = path.join(process.cwd(), "tmp", "smoke");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // 2. Requisitar as 4 telas e salvar HTML
  const screens = [
    { name: "subjects", path: "/subjects" },
    { name: "anchor_precredit", path: "/blocks/cmss35fow0007iyaoey50kzf4" },
    { name: "anchor_completed", path: "/blocks/cmss35g1r0009iyaobhjwwlbd" },
    { name: "schedule_today", path: "/schedule" }
  ];

  for (const s of screens) {
    console.log(`\n🌐 Baixando Tela: ${s.path}...`);
    const res = await fetch(`${PROD_BASE_URL}${s.path}`, {
      headers: { Cookie: rawCookies }
    });

    const html = await res.text();
    const filePath = path.join(tmpDir, `${s.name}.html`);
    fs.writeFileSync(filePath, html, "utf-8");

    const sizeBytes = fs.statSync(filePath).size;
    console.log(`   Status HTTP: ${res.status}`);
    console.log(`   Arquivo: tmp/smoke/${s.name}.html`);
    console.log(`   Tamanho: ${sizeBytes} bytes`);
  }
}

main().catch(console.error);
