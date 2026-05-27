# Guia Operacional — Configuração do Upstash Redis em Produção

Este guia descreve os passos para habilitar o **Rate Limiting Distribuído** em produção utilizando o Upstash Redis, eliminando o fallback em memória e garantindo segurança e estabilidade robustas na Vercel.

---

## 1. Onde criar o banco Redis no Upstash

1. Acesse o console do [Upstash](https://console.upstash.com/) e crie uma conta gratuita.
2. No painel de controle, clique no botão **"Create Database"** na aba Redis.
3. Insira as configurações básicas:
   * **Name:** `kehl-study-rate-limiter`
   * **Type:** `Global` (para latência ultra-baixa replicada em múltiplas regiões) ou escolha uma região específica compatível com a sua servidora da Vercel (ex: `sa-east-1` São Paulo).
   * **Encryption:** Habilitada (SSL/TLS ativo por padrão).
4. Clique em **"Create"**.

---

## 2. Quais variáveis copiar

Uma vez criado o banco de dados, na seção **"REST API"** na página de detalhes do banco de dados, copie as seguintes variáveis:

1. **`UPSTASH_REDIS_REST_URL`**: O endpoint HTTP REST do seu banco Redis.
2. **`UPSTASH_REDIS_REST_TOKEN`**: O token secreto de leitura/gravação associado ao endpoint.

---

## 3. Onde configurar na Vercel

1. Acesse a dashboard do seu projeto na [Vercel](https://vercel.com/).
2. Vá em **Settings** > **Environment Variables**.
3. Adicione as duas variáveis copiadas com os escopos apropriados (selecione pelo menos **Production** e **Preview**):
   * Nome: `UPSTASH_REDIS_REST_URL` / Valor: `https://...`
   * Nome: `UPSTASH_REDIS_REST_TOKEN` / Valor: `...`
4. Clique em **Save**.
5. Promova um novo Deploy (Redeploy) da aplicação para que as novas variáveis de ambiente sejam injetadas com sucesso nos containers serverless.

---

## 4. Como validar em Produção

Após realizar o deploy com as variáveis injetadas:

1. Execute chamadas rápidas e sequenciais para um dos endpoints protegidos por rate limit (ex: `/api/auth/login`, `/api/materials/upload`).
2. Se você exceder a cota configurada (ex: mais de 5 tentativas por minuto para `/login`), o servidor responderá com `HTTP 429 Too Many Requests`.
3. Acesse a aba **"Realtime Logs"** da Vercel.
4. Confirme que **NÃO** há o log de aviso:
   ```text
   [RATE LIMIT] Using in-memory fallback in production! This is unsafe for distributed environments.
   ```
5. Acesse a dashboard do console do **Upstash Redis** e confirme no gráfico de requisições ou na aba **"Data Browser"** que as chaves de controle (ex: `rate_limit:login:...` ou `rate_limit:upload:...`) foram gravadas com sucesso no Redis remoto.
