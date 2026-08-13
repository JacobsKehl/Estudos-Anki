/* eslint-disable @typescript-eslint/no-var-requires */
require("dotenv").config();
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  console.log("=======================================================================");
  console.log(" USUÁRIOS NO BANCO DE DADOS (ANTES DA RENOMEAÇÃO)");
  console.log("=======================================================================");
  for (const u of users) {
    console.log(`ID: ${u.id} | Email: ${u.email || "N/A"} | Name: ${u.name || "N/A"}`);
  }

  const gabrielaEmail = "gabriela.furtado.p@gmail.com";

  for (const u of users) {
    if (u.email === gabrielaEmail) {
      console.log(`\nManter conta da Gabriela (${u.email}) intacta.`);
      continue;
    }

    let newName = "[TESTE] Dev";
    if (u.email?.includes("henrique") || u.id === "cmp8oczk70000iybk41u7173z") {
      newName = "[TESTE] Henrique";
    }

    await prisma.user.update({
      where: { id: u.id },
      data: { name: newName },
    });
    console.log(`Atualizada conta ID ${u.id} (${u.email}) -> Nome: "${newName}"`);
  }

  const updatedUsers = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  console.log("\n=======================================================================");
  console.log(" USUÁRIOS NO BANCO DE DADOS (APÓS A RENOMEAÇÃO)");
  console.log("=======================================================================");
  for (const u of updatedUsers) {
    console.log(`ID: ${u.id} | Email: ${u.email || "N/A"} | Name: ${u.name || "N/A"}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
