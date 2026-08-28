import fs from "fs";

const content = fs.readFileSync("tmp/smoke/anchor_completed.html", "utf-8");

const relerMatches = Array.from(content.matchAll(/Reler\s+este\s+bloco/gi));
const secondPassMatches = Array.from(content.matchAll(/secondPass=true/gi));

console.log("======================================================================");
console.log("GREP DE 'RELER ESTE BLOCO' EM TMP/SMOKE/ANCHOR_COMPLETED.HTML");
console.log("======================================================================\n");

console.log(`1. 'Reler este bloco': ${relerMatches.length} ocorrência(s)`);
console.log(`2. 'secondPass=true': ${secondPassMatches.length} ocorrência(s)`);
