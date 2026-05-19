const fs = require('fs');
const https = require('https');

console.log("Fetching debug-organize API...");
const req = https.get('https://estudos-anki.vercel.app/api/debug-organize', { timeout: 180000 }, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('scratch/debug-result.json', data);
    console.log("Completed! Saved to scratch/debug-result.json");
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error("HTTP Request Error:", err);
  process.exit(1);
});

req.on('timeout', () => {
  console.error("HTTP Request Timeout!");
  req.destroy();
  process.exit(1);
});
