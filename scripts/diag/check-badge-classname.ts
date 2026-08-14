import fs from "fs";

const content = fs.readFileSync("tmp/smoke/anchor_completed.html", "utf-8");
const classNameTarget = "bg-accent/10 text-accent border-accent/20";
const hasClassName = content.includes(classNameTarget);

console.log(`Grep de "${classNameTarget}" em anchor_completed.html:`, hasClassName ? "ENCONTRADO" : "NÃO ENCONTRADO");
