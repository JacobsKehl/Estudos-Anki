// Dispara o gerador de cronograma inteligente via API
async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/schedule/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Erro:", e.message);
  }
}
test();
