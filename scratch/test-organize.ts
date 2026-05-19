import { prisma } from "../src/lib/prisma";
import dotenv from "dotenv";
dotenv.config();

// We need to simulate processMaterial. But processMaterial is a private function in /api/materials/organize-all/route.ts.
// Let's call the POST handler of /api/materials/organize-all/route.ts directly!
import { POST } from "../src/app/api/materials/organize-all/route";
import { NextRequest } from "next/server";

async function main() {
  console.log("Fetching specified material...");
  const material = await prisma.studyMaterial.findUnique({
    where: { id: "cmpah8enm0001jj04623eqhn4" }
  });

  if (!material) {
    console.log("No imported material found.");
    return;
  }

  console.log(`Found material: ${material.fileName} (${material.id})`);
  
  // Create NextRequest
  const req = new NextRequest("http://localhost:3000/api/materials/organize-all", {
    method: "POST",
    body: JSON.stringify({
      force: true,
      materialId: material.id
    })
  });

  console.log("Calling POST /api/materials/organize-all...");
  const res = await POST(req);
  const data = await res.json();
  console.log("Response Status:", res.status);
  console.log("Response Data:", JSON.stringify(data, null, 2));

  // Let's query the created blocks for this material
  const blocks = await prisma.studyBlock.findMany({
    where: { materialId: material.id },
    include: { subject: true }
  });
  console.log(`\nCreated ${blocks.length} blocks for this material:`);
  for (const b of blocks) {
    console.log(`- Block: "${b.title}" | Subject: "${b.subject?.name}"`);
  }
}

main().catch(console.error);
