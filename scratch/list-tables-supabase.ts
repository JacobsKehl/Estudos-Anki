import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  console.log("=== LISTANDO TABELAS DO SUPABASE VIA REST API ===");
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas");
    return;
  }

  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers });
    
    if (!res.ok) {
      throw new Error(`Erro na raiz do PostgREST (${res.status}): ${await res.text()}`);
    }

    const doc = await res.json();
    const tables = Object.keys(doc.paths || {})
      .filter(p => p !== "/" && !p.includes("{"))
      .map(p => p.replace(/^\//, ""));

    console.log("\nTabelas expostas no banco de dados do .env:");
    tables.forEach(t => console.log(`- ${t}`));
    
    // Testar se existe a tabela de materiais com outro nome
    console.log("\nProcurando tabelas relacionadas a materiais:");
    const match = tables.filter(t => t.toLowerCase().includes("material") || t.toLowerCase().includes("study"));
    console.log(match);
  } catch (err: any) {
    console.error("Erro ao listar tabelas:", err.message);
  }
}

main().catch(console.error);
