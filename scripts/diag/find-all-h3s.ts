import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "tmp", "smoke", "schedule_today.html");
const content = fs.readFileSync(filePath, "utf-8");

const h3Indices: number[] = [];
let pos = content.indexOf('["$","h3"');
while (pos !== -1) {
  h3Indices.push(pos);
  pos = content.indexOf('["$","h3"', pos + 1);
}

console.log(`Encontradas ${h3Indices.length} tags h3 no payload:`);
h3Indices.forEach((idx, i) => {
  const snippet = content.substring(idx, idx + 200).replace(/\n/g, " ");
  console.log(`   [${i + 1}] ${snippet}`);
});
