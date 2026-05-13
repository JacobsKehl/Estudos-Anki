const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key found");
    return;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
