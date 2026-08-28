import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const notes = await prisma.studyBlockGapNote.findMany({ select: { status: true, tokensUsed: true } });

  const totalTokens = notes.reduce((acc, curr) => acc + (curr.tokensUsed || 0), 0);
  const readyNotes = notes.filter(n => n.status === "READY");
  const avgTokensPerReadyBlock = Math.round(totalTokens / (readyNotes.length || 1));

  // Tabela oficial Gemini 2.5 Flash: $0.30 / 1M input, $1.20 / 1M output
  // Assumindo proporção real de ~99% input / 1% output
  const costInput = (totalTokens / 1000000) * 0.30;
  const costOutput = ((readyNotes.length * 300) / 1000000) * 1.20;
  const totalCostUSD = costInput + costOutput;

  console.log("======================================================================");
  console.log("             CUSTO REAL TOTAL REGISTRADO EM BANCO");
  console.log("======================================================================\n");
  console.log(`- Total de Tokens Consumidos (` + notes.length + ` registros): ${totalTokens.toLocaleString()} tokens`);
  console.log(`- Média de Tokens por Bloco READY (${readyNotes.length} blocos): ${avgTokensPerReadyBlock.toLocaleString()} tokens/bloco`);
  console.log(`- CUSTO REAL TOTAL: $${totalCostUSD.toFixed(4)} USD (aprox. R$ ${(totalCostUSD * 5.80).toFixed(2)} BRL)\n`);
}

main().finally(() => prisma.$disconnect());
