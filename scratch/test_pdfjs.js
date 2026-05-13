const path = require("path");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
const fs = require("fs");

async function test() {
  pdfjs.GlobalWorkerOptions.workerSrc = "";
  
  const testFile = path.join(__dirname, "..", "study-inbox", "Direito Processual Civil.pdf");
  if (!fs.existsSync(testFile)) {
    console.error("File not found:", testFile);
    return;
  }
  
  console.log("Loading:", testFile);
  const buffer = fs.readFileSync(testFile);
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  
  try {
    const task = pdfjs.getDocument({
      data: uint8,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    
    const doc = await task.promise;
    console.log("Pages:", doc.numPages);
    
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map(i => i.str || "").join(" ");
    console.log("Sample text:", text.substring(0, 200));
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

test();
