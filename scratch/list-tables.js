const dotenv = require("dotenv");
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://msmdekjetxajcwuxmxps.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Error fetching schema description:", res.status, text);
    return;
  }

  const data = await res.json();
  console.log("=== TABELAS DISPONÍVEIS NA API DO SUPABASE ===");
  if (data.paths) {
    Object.keys(data.paths).forEach(path => {
      if (path !== "/") {
        console.log(`• ${path}`);
      }
    });
  }
}

main();
