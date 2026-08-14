import fs from "fs";

const html = fs.readFileSync("tmp/smoke/anchor_precredited_prod.html", "utf-8");

console.log("======================================================================");
console.log("INSPEÇÃO DE PRECREDIT HTML DETAILS");
console.log("======================================================================\n");

const creditadoIdx = html.indexOf("Creditado pelo Histórico");
if (creditadoIdx !== -1) {
  console.log("Snippet em torno de 'Creditado pelo Histórico':");
  console.log(html.substring(Math.max(0, creditadoIdx - 150), Math.min(html.length, creditadoIdx + 350)));
}

console.log("\nBusca por 'Ler este bloco':", html.includes("Ler este bloco"));
console.log("Busca por 'Reler este bloco':", html.includes("Reler este bloco"));
