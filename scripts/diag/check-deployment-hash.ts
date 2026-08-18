import "dotenv/config";

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estudos-anki.vercel.app";
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const cookieHeader = loginRes.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");

  const res = await fetch(`${baseUrl}/blocks/cmss361lj004hiyaodwrvf1xa`, {
    headers: { cookie: cookieHeader }
  });

  const html = await res.text();
  console.log("Status HTTP:", res.status);
  console.log("Tamanho HTML:", html.length);
  
  // Extrair o dpl-id
  const dplMatch = html.match(/data-dpl-id="([^"]+)"/);
  console.log("Vercel Deployment ID:", dplMatch ? dplMatch[1] : "não encontrado");

  // Procurar trechos do HTML
  console.log("Procurando 'Recursos Trabalhistas':", html.includes("Recursos Trabalhistas"));
  console.log("Procurando 'cobre':", html.includes("cobre"));
  console.log("Procurando 'Agravo':", html.includes("Agravo"));
  console.log("Procurando 'Súmula':", html.includes("Súmula"));
}

main();
