import { detectQuestionsOrGabaritoHeuristic } from "../src/lib/ai/organizer";

console.log("=== INICIANDO TESTE DA HEURÍSTICA DE DETECÇÃO DE QUESTÕES ===");

const teoriaJuridica = `
ELEMENTOS FÁTICO-JURÍDICOS DA RELAÇÃO DE EMPREGO
Para a caracterização da relação de emprego, exige-se a presença concorrente dos seguintes elementos fático-jurídicos:
1. Prestação de trabalho por pessoa física: O empregado deve ser necessariamente uma pessoa física (ser humano).
2. Pessoalidade: O empregado deve prestar os serviços pessoalmente, sem possibilidade de se fazer substituir de forma habitual por outra pessoa.
3. Não eventualidade: O trabalho deve ser de natureza contínua e integrada à atividade fim da empresa, não sendo prestado de forma esporádica.
4. Onerosidade: A relação é sinalagmática e onerosa, devendo haver pagamento de contraprestação pecuniária (salário).
5. Subordinação jurídica: O empregado está sujeito às ordens, fiscalização e direção do empregador na execução de suas funções.
Esses requisitos estão dispostos nos artigos 2º e 3º da Consolidação das Leis do Trabalho (CLT).
`;

const questaoConcurso = `
Questão 01. Concurso TRT 4ª Região - FCC (2024).
A respeito da caracterização da relação de emprego e seus elementos constitutivos, assinale a alternativa correta:
A) A pessoalidade é um requisito aplicável exclusivamente ao empregador.
B) A subordinação exigida na relação de emprego é eminentemente econômica, e não jurídica.
C) A onerosidade decorre da reciprocidade de obrigações, onde a prestação do trabalho gera a obrigação do pagamento do salário.
D) O trabalho de natureza eventual, por si só, é suficiente para configurar a relação de emprego se houver pessoalidade.
E) A prestação de serviços por pessoa jurídica de forma subordinada descaracteriza qualquer fraude, sendo plenamente legal.
Gabarito: C
`;

const resultTeoria = detectQuestionsOrGabaritoHeuristic(teoriaJuridica);
const resultQuestao = detectQuestionsOrGabaritoHeuristic(questaoConcurso);

console.log("\n--- TESTE 1: TEORIA JURÍDICA (LISTA NUMERADA) ---");
console.log("isQuestions (esperado: false):", resultTeoria.isQuestions);
console.log("isAnswerKey (esperado: false):", resultTeoria.isAnswerKey);
console.log("Confidence:", resultTeoria.confidence);

console.log("\n--- TESTE 2: QUESTÃO DE PROVA (MULTIPLA ESCOLHA) ---");
console.log("isQuestions (esperado: true):", resultQuestao.isQuestions);
console.log("isAnswerKey (esperado: false/true dependendo se contem gabarito no fim):", resultQuestao.isAnswerKey);
console.log("Confidence:", resultQuestao.confidence);

if (!resultTeoria.isQuestions && resultQuestao.isQuestions) {
  console.log("\n✅ SUCESSO ABSOLUTO! A heurística distinguiu perfeitamente a teoria de questões reais!");
} else {
  console.log("\n❌ FALHA! A heurística não se comportou conforme o esperado.");
}
