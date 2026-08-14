import { PrismaClient } from "@prisma/client";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { GapNoteSection } from "@/components/blocks/GapNoteSection";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  console.log("======================================================================");
  console.log("VERIFICAÇÃO SSR DAS SEÇÕES 'O que o CFC não cobre'");
  console.log("======================================================================\n");

  // 1. Bloco READY: Recursos Trabalhistas
  const blockReady = await prisma.studyBlock.findUnique({
    where: { id: "cmss361lj004hiyaodwrvf1xa" },
    include: { gapNote: true }
  });

  if (!blockReady || !blockReady.gapNote) throw new Error("Bloco Recursos Trabalhistas ou gapNote não encontrado");

  const htmlReady = ReactDOMServer.renderToString(
    React.createElement(GapNoteSection, { gapNote: blockReady.gapNote })
  );

  console.log("1. BLOCOR READY (Recursos Trabalhistas):");
  console.log(`- Contém "O que o CFC não cobre": ${htmlReady.includes("O que o CFC não cobre")}`);
  console.log(`- Contém "Agravo Interno": ${htmlReady.includes("Agravo Interno")}`);
  console.log(`- Contém "Súmula 283": ${htmlReady.includes("Súmula 283")}`);
  console.log(`\nHTML Gerado (READY):\n${htmlReady}\n`);

  // 2. Bloco NOT_REQUIRED: Glossário de Siglas
  const blockNotReq = await prisma.studyBlock.findUnique({
    where: { id: "cmss35erb0001iyao49fdckao" },
    include: { gapNote: true }
  });

  if (!blockNotReq || !blockNotReq.gapNote) throw new Error("Bloco NOT_REQUIRED não encontrado");

  const htmlNotReq = ReactDOMServer.renderToString(
    React.createElement(GapNoteSection, { gapNote: blockNotReq.gapNote })
  );

  console.log("======================================================================");
  console.log("2. BLOCO NOT_REQUIRED (Lei 12.527/12):");
  console.log(`- Contém "O que o CFC não cobre": ${htmlNotReq.includes("O que o CFC não cobre")}`);
  console.log(`- Contém frase exata da fonte única: ${htmlNotReq.includes("Sem material de consulta do Estratégia para este tópico — o resumo do CFC é sua fonte principal.")}`);
  console.log(`\nHTML Gerado (NOT_REQUIRED):\n${htmlNotReq}\n`);
}

main().finally(() => prisma.$disconnect());
