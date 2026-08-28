import "dotenv/config";
import fs from "fs";
import path from "path";

const PROD_BASE_URL = "https://estudos-anki.vercel.app";

async function main() {
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;

  if (!email || !password) {
    console.error("🛑 ERRO: Variáveis SMOKE_EMAIL e SMOKE_PASSWORD não encontradas!");
    process.exit(1);
  }

  // Login
  const loginRes = await fetch(`${PROD_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe: true })
  });

  if (!loginRes.ok) {
    console.error("Login falhou");
    process.exit(1);
  }

  const cookies = loginRes.headers.get("set-cookie") || "";
  const tmpDir = path.join(process.cwd(), "tmp", "smoke");

  const targets = [
    { name: "anchor_precredit.html", path: "/blocks/cmss35fow0007iyaoey50kzf4" },
    { name: "anchor_completed.html", path: "/blocks/cmss35g1r0009iyaobhjwwlbd" },
    { name: "schedule_today.html", path: "/schedule" }
  ];

  for (const t of targets) {
    console.log(`Downloading full stream for ${t.path}...`);
    const res = await fetch(`${PROD_BASE_URL}${t.path}`, {
      headers: {
        "Cookie": cookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullHtml = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullHtml += decoder.decode(value, { stream: true });
      }
    } else {
      fullHtml = await res.text();
    }

    const filePath = path.join(tmpDir, t.name);
    fs.writeFileSync(filePath, fullHtml, "utf-8");
    console.log(`Saved ${t.name} (${fs.statSync(filePath).size} bytes)`);
  }
}

main().catch(console.error);
