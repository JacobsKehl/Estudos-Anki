import { findBestOfficialTopic } from "@/lib/ai/organizer";

describe("Regression Test: Fallback do Mapeamento de Tópicos (H3)", () => {
  const sampleTopics = [
    {
      id: "const_t0",
      topicCode: "Tópico 00",
      title: "Constituição Federal: Conceito, classificações, princípios fundamentais.",
    },
    {
      id: "const_t1",
      topicCode: "Tópico 01",
      title: "Direitos e garantias fundamentais. Direitos e deveres individuais e coletivos.",
    },
    {
      id: "const_t2",
      topicCode: "Tópico 02",
      title: "Organização do Estado. Administração Pública. Servidores públicos.",
    },
  ];

  it("deve mapear com sucesso quando o texto corresponde com alta confiança (>= 0.7)", () => {
    const text = "Estudo sobre Princípios Fundamentais e Conceito da Constituição Federal";
    const result = findBestOfficialTopic(text, sampleTopics);

    expect(result).not.toBeNull();
    expect(result?.id).toBe("const_t0");
    expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("NUNCA deve retornar o primeiro tópico como fallback se a correspondência for irrelevante ou com baixa confiança (< 0.7)", () => {
    // Texto sobre astrofísica/química sem qualquer palavra-chave jurídica dos tópicos
    const irrelevantText = "Introdução aos buracos negros, relatividade geral e mecânica quântica avançada";
    const result = findBestOfficialTopic(irrelevantText, sampleTopics);

    // DEVE RETORNAR NULL (NUNCA const_t0 por posição)
    expect(result).toBeNull();
  });

  it("deve retornar null se o array de tópicos estiver vazio", () => {
    const result = findBestOfficialTopic("Qualquer assunto", []);
    expect(result).toBeNull();
  });
});
