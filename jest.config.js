/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Mapeia @/* → src/* conforme o tsconfig
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Apenas arquivos de teste na feature branch híbrida
  testMatch: [
    "<rootDir>/src/__tests__/**/*.test.ts",
  ],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          // Sobrescrever moduleResolution para Node para compatibilidade com jest
          moduleResolution: "node",
          // Manter strict do tsconfig base
          strict: true,
        },
      },
    ],
  },
  // Não rodar testes do Next.js ou arquivos de componentes React
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  // Timeout razoável para testes unitários puros
  testTimeout: 10000,
};

module.exports = config;
