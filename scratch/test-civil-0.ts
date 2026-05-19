import { prisma } from "../src/lib/prisma";
import dotenv from "dotenv";
dotenv.config();

import { POST } from "../src/app/api/materials/organize-all/route";
import { NextRequest } from "next/server";

async function main() {
  console.log("=== BUSCANDO MATERIAL DE PROCESSO CIVIL ===");
  const materials = await prisma.studyMaterial.findMany({
    include: { subject: true }
  });

  const civilMaterial = materials.find(m => 
    m.fileName.toLowerCase().includes("processual civil") ||
    (m.originalFileName && m.originalFileName.toLowerCase().includes("processual civil"))
  );

  if (!civilMaterial) {
    console.log("Nenhum material de Processo Civil encontrado no banco de dados. Materiais disponíveis:");
    for (const m of materials) {
      console.log(`- ID: ${m.id} | Name: ${m.fileName}`);
    }
    return;
  }

  console.log(`\nMaterial Encontrado:`);
  console.log(`- ID: ${civilMaterial.id}`);
  console.log(`- Nome: ${civilMaterial.fileName}`);
  console.log(`- Status de Organização: ${civilMaterial.organizationStatus}`);
  console.log(`- Matéria associada: ${civilMaterial.subject?.name || "Nenhuma"}`);

  // Disparar o pipeline de fatiamento utilizando nossa rota de API
  console.log("\n=== DISPARANDO ORGANIZAÇÃO COM O NOVO PIPELINE ===");
  const req = new NextRequest("http://localhost:3000/api/materials/organize-all", {
    method: "POST",
    body: JSON.stringify({
      force: true,
      materialId: civilMaterial.id
    })
  });

  const res = await POST(req);
  const data = await res.json();
  console.log("HTTP Status:", res.status);
  console.log("Response:", JSON.stringify(data, null, 2));

  // Consultar blocos resultantes no banco
  console.log("\n=== BLOCOS FINAIS RESULTANTES NO BANCO ===");
  const blocks = await prisma.studyBlock.findMany({
    where: { materialId: civilMaterial.id },
    orderBy: { orderIndex: "asc" },
    include: {
      supportMaterials: {
        include: { material: true }
      }
    }
  });

  console.log(`Total de blocos criados: ${blocks.length}`);
  for (const b of blocks) {
    console.log(`\n[${b.createdBy}] Bloco: "${b.title}" (p. ${b.pageStart} - ${b.pageEnd})`);
    console.log(`  - Seção Original: ${b.sourceHeading || "Não especificada"}`);
    console.log(`  - Tópico do Edital: ${b.officialTopicName || "Não identificado"}`);
    console.log(`  - Tempo Estimado: ${b.estimatedStudyMinutes} min`);
    
    if (b.supportMaterials.length > 0) {
      console.log(`  - Materiais de Apoio Vinculados (${b.supportMaterials.length}):`);
      for (const s of b.supportMaterials) {
        console.log(`    * [${s.supportType}] ${s.material.fileName} (p. ${s.pageStart} - ${s.pageEnd})`);
      }
    }
  }
}

main().catch(console.error);
