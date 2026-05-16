# 🎓 Kehl Study: Sua Mente Aumentada por IA

[![Vercel](https://img.shields.io/badge/deployed_on-vercel-black?logo=vercel&style=flat-square)](https://vercel.com)
[![Next.js](https://img.shields.io/badge/built_with-next.js-black?logo=next.js&style=flat-square)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/database-supabase-emerald?logo=supabase&style=flat-square)](https://supabase.com)
[![Prisma](https://img.shields.io/badge/orm-prisma-indigo?logo=prisma&style=flat-square)](https://prisma.io)

O **Kehl Study** é uma plataforma de aprendizagem inteligente projetada para transformar PDFs brutos em conhecimento estruturado. Utilizando o poder do Google Gemini e técnicas avançadas de SRS (Spaced Repetition System), o sistema organiza sua rotina de estudos automaticamente.

---

## ✨ Funcionalidades Principais

*   **🚀 Upload Inteligente:** Suba seus PDFs direto para a nuvem via Supabase Storage.
*   **🧠 Organizador Autônomo:** A IA identifica a matéria, fatias o conteúdo em blocos lógicos e cria um cronograma de leitura.
*   **📇 Flashcards Automáticos:** Geração de cards baseada no conteúdo real do seu material, prontos para revisão.
*   **📅 Cronograma Dinâmico:** Gerenciamento de revisões e progresso diário.
*   **📱 Cloud-Native:** Acesse seus materiais e revisões de qualquer dispositivo através da Web.

---

## 🛠️ Stack Tecnológica

- **Frontend:** Next.js 16 (App Router), Tailwind CSS, Lucide React.
- **Backend:** Next.js API Routes (Serverless).
- **Banco de Dados:** PostgreSQL via Supabase.
- **ORM:** Prisma.
- **IA:** Google Gemini (Gemini-Flash).
- **Storage:** Supabase Storage.

---

## 🚀 Guia de Configuração (Cloud Mode)

### 1. Clonar e Instalar
```bash
git clone https://github.com/JacobsKehl/Estudos-Anki.git
cd Kehl-Study
npm install
```

### 2. Variáveis de Ambiente
Crie um arquivo `.env` na raiz com as seguintes chaves:
```env
# Banco de Dados (Supabase)
DATABASE_URL="sua_url_de_pooler"
DIRECT_URL="sua_url_direta"

# IA (Google)
GEMINI_API_KEY="sua_chave_gemini"

# Supabase Auth/Storage
NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua_chave_anon"
```

### 3. Sincronizar Banco
```bash
npx prisma generate
npx prisma db push
```

### 4. Rodar Localmente
```bash
npm run dev
```

---

## ☁️ Deploy na Vercel

O projeto está configurado para deploy contínuo. Ao conectar seu repositório à Vercel:

1.  Certifique-se de adicionar todas as variáveis de ambiente acima nas **Environment Variables** da Vercel.
2.  O build rodará automaticamente `prisma generate && next build`.

---

## 📄 Licença

Desenvolvido com ❤️ por Jacobs Kehl.
