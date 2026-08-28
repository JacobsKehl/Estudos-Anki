import fs from "fs";

const html = fs.readFileSync("tmp/smoke/anchor_precredited_prod.html", "utf-8");

console.log("======================================================================");
console.log("TODAS AS ANCORAS E LINKS EM ANCHOR_PRECREDITED_PROD.HTML");
console.log("======================================================================\n");

const links = Array.from(html.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi));
links.forEach((m, idx) => {
  console.log(`Link #${idx + 1}: ${m[0].replace(/\s+/g, " ")}`);
});
