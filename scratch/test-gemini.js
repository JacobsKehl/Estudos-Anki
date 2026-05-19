const { identifySubject } = require("../src/lib/ai/organizer");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const sampleText = "Aula 06  TRT-RS 4ª Região (Analista Judiciário -  Área Judiciária) Direito Processual do  Trabalho  Autor:  Bruno Klippel  27 de Janeiro de 2026";
  const fileName = "processual do trabalho 6.pdf";
  
  console.log("Calling identifySubject...");
  try {
    const res = await identifySubject(sampleText, fileName);
    console.log("Result:", res);
  } catch (err) {
    console.error("Fatal Error:", err);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
