const dotenv = require("dotenv");
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://msmdekjetxajcwuxmxps.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function queryCount(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Prefer": "count=exact",
      "Range": "0-0"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to query ${table}: ${res.status} ${text}`);
  }

  const contentRange = res.headers.get("content-range");
  if (contentRange) {
    // Content-Range: 0-0/412 -> extract 412
    const total = contentRange.split("/")[1];
    return parseInt(total, 10);
  }
  return 0;
}

async function queryMaterials() {
  // Query all materials to sum their totalPages
  const res = await fetch(`${url}/rest/v1/StudyMaterial?select=fileName,totalPages,processingStatus`, {
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to query StudyMaterial: ${res.status} ${text}`);
  }

  return await res.json();
}

async function main() {
  console.log("Conectando ao Supabase via API HTTPS (Porta 443)...");
  try {
    const extractedCount = await queryCount("ExtractedContent");
    const materials = await queryMaterials();

    const processedMaterials = materials.filter(m => m.processingStatus === "PROCESSED");
    const totalPagesProcessed = processedMaterials.reduce((sum, m) => sum + (m.totalPages || 0), 0);

    console.log(`\n=== ESTATÍSTICA DE PÁGINAS LIDAS ===`);
    console.log(`Total de páginas com texto extraído (ExtractedContent): ${extractedCount}`);
    console.log(`Total de páginas de PDFs totalmente processados (PROCESSED): ${totalPagesProcessed}`);
    console.log(`\nDetalhes por arquivo processado:`);
    processedMaterials.forEach(m => {
      console.log(`• ${m.fileName}: ${m.totalPages || 0} páginas`);
    });
  } catch (err) {
    console.error("Erro ao consultar a API do Supabase:", err);
  }
}

main();
