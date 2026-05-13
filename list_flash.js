const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await response.json();
  const flashModels = data.models.filter(m => m.name.includes('flash')).map(m => m.name);
  console.log(flashModels);
}

main().catch(console.error);
