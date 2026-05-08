# Estudos-Anki (MVP SaaS de estudos)

Aplicação web full-stack para organizar estudos diários com extração de conteúdo, cronograma automático e revisões por flashcards estilo Anki.

## Stack

- Next.js 15 + React + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Auth.js (NextAuth) com credenciais e Google OAuth
- Upload local de PDF no MVP (Google Drive preparado para Fase 4)
- Geração de flashcards com LLM via endpoint server-side

## Estrutura

```txt
src/
  app/
    (dashboard)/
      dashboard/page.tsx
      materiais/page.tsx
      cronograma/page.tsx
      estudo-hoje/page.tsx
      revisoes/page.tsx
      flashcards/page.tsx
      configuracoes/page.tsx
    api/
      auth/[...nextauth]/route.ts
      subjects/route.ts
      materials/route.ts
      extracted-contents/route.ts
      study-plan/generate/route.ts
      study-today/route.ts
      flashcards/generate/route.ts
      flashcards/review/route.ts
    layout.tsx
    page.tsx
  components/
    ui/
    dashboard/
    study/
    flashcards/
  lib/
    auth.ts
    prisma.ts
    sm2.ts
    validation.ts
  services/
    material.service.ts
    study-plan.service.ts
    flashcard.service.ts
    review.service.ts
    google-drive.service.ts
prisma/
  schema.prisma
```

## Fluxo do MVP

1. Criar conta/login.
2. Cadastrar matérias manualmente.
3. Upload de PDF em `Materiais`.
4. Processar e extrair blocos de texto.
5. Gerar cronograma com data estimada da prova e minutos diários.
6. Abrir `Estudo de Hoje` para ler conteúdo já extraído.
7. Concluir estudo e gerar flashcards automaticamente.
8. Revisar cards em `Revisões` com algoritmo SM-2 simplificado.

## Rodando localmente

1. Instalar dependências:

```bash
npm install
```

2. Configurar `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/estudos_anki"
NEXTAUTH_SECRET="sua-chave-secreta"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
OPENAI_API_KEY=""
```

3. Prisma:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

4. Rodar:

```bash
npm run dev
```

## Endpoints principais (MVP)

- `POST /api/subjects` — cria matéria
- `POST /api/materials` — cria material + trigger de extração
- `GET /api/materials` — lista materiais
- `POST /api/study-plan/generate` — gera cronograma
- `GET /api/study-today` — retorna conteúdo recomendado do dia
- `POST /api/flashcards/generate` — gera flashcards por conteúdo
- `POST /api/flashcards/review` — aplica review (Errei/Difícil/Bom/Fácil)

## Próximas fases

- Google Drive completo (listar pastas, importar em lote, delta sync)
- OCR para PDF digitalizado
- Painel analítico avançado
- Rebalanceamento automático do cronograma por desempenho
