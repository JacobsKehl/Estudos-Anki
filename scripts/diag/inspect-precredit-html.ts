import fs from "fs";

const content = fs.readFileSync("tmp/smoke/anchor_precredited_prod.html", "utf-8");

console.log("======================================================================");
console.log("INSPEÇÃO DE ANCHOR_PRECREDITED_PROD.HTML");
console.log("======================================================================\n");

console.log("Comprimento:", content.length);
console.log("Tem 'Sessão Concluída!'?", content.includes("Sessão Concluída!"));
console.log("Tem 'Reler este bloco'?", content.includes("Reler este bloco"));
console.log("Tem 'Reabrir bloco'?", content.includes("Reabrir bloco"));

// Extrair títulos h2 ou h1
const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/gi);
const h2Match = content.match(/<h2[^>]*>(.*?)<\/h2>/gi);
console.log("h1:", h1Match);
console.log("h2:", h2Match);
