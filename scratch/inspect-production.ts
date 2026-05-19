import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  console.log("=== INICIANDO DIAGNÓSTICO AUTOMÁTICO DE PRODUÇÃO (VIA API HTTPS) ===");
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não estão configuradas no .env");
    return;
  }

  console.log(`Conectando a: ${SUPABASE_URL}`);
  
  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json"
  };

  try {
    // 1. Consultar todos os materiais cujo nome contenha 'civil' ou que tenham sido criados recentemente
    const url = `${SUPABASE_URL}/rest/v1/StudyMaterial?select=id,fileName,originalFileName,organizationStatus,processingStatus,processingError,totalPages,createdAt&order=createdAt.desc`;
    
    console.log("Buscando registros da tabela StudyMaterial na nuvem...");
    const res = await fetch(url, { headers });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro na API do Supabase (${res.status}): ${errText}`);
    }

    const materials: any[] = await res.json();
    
    console.log(`\nRegistros retornados: ${materials.length}`);
    
    if (materials.length === 0) {
      console.log("Nenhum material encontrado no banco de dados.");
      return;
    }

    const civilMaterials = materials.filter(m => 
      (m.fileName && m.fileName.toLowerCase().includes("civil")) ||
      (m.originalFileName && m.originalFileName.toLowerCase().includes("civil"))
    );

    console.log("\n=== MATERIAIS FILTRADOS COM 'CIVIL' NO NOME ===");
    if (civilMaterials.length === 0) {
      console.log("Nenhum material contendo 'civil' no nome foi localizado.");
      console.log("\nTodos os materiais disponíveis na nuvem:");
      materials.slice(0, 10).forEach(m => {
        console.log(`- [${m.createdAt}] ID: ${m.id} | Nome: ${m.fileName} | Status: ${m.processingStatus}`);
      });
    } else {
      civilMaterials.forEach((m, idx) => {
        console.log(`\n[Material ${idx + 1}]`);
        console.log(`  - ID: ${m.id}`);
        console.log(`  - Nome do Arquivo: ${m.fileName}`);
        console.log(`  - Nome Original: ${m.originalFileName || "N/A"}`);
        console.log(`  - Criado Em: ${m.createdAt}`);
        console.log(`  - Total de Páginas Mapeadas: ${m.totalPages || "N/A"}`);
        console.log(`  - Status de Organização: ${m.organizationStatus}`);
        console.log(`  - Status de Processamento: ${m.processingStatus}`);
        console.log(`  - Erro Gravado (processingError): "${m.processingError || "Nenhum erro registrado"}"`);
      });
    }

  } catch (error: any) {
    console.error("Erro fatal ao rodar diagnóstico:", error.message);
  }
}

main().catch(console.error);
