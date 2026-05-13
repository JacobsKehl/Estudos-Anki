async function testOrganize() {
  console.log("Testing organization API...");
  try {
    const res = await fetch('http://localhost:3000/api/materials/organize-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
      console.log("Raw Response (not JSON):", text);
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testOrganize();
