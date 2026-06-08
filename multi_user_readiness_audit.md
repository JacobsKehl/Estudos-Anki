# Auditoria Multiusuário e Multiobjetivo — Kehl Study

## Sumário Executivo

Esta auditoria analisa a prontidão da plataforma **Kehl Study** para transicionar de um modelo de usuário único e objetivo fixo (Gabriela - Concurso TRT4) para uma arquitetura verdadeiramente multiusuário, multiobjetivo e multitemática. O caso de uso imediato é a liberação de acesso para o estudante número 2 (Henrique Kehl), focado em certificações de **Segurança da Informação**, utilizando materiais em PDF enviados por ele próprio, sem herdar regras do TRT4 ou interferir nas configurações vigentes da Gabriela.

### O que já está pronto
- **Isolamento de Banco de Dados básico:** Tabelas centrais como `StudySubject`, `StudyMaterial`, `StudyBlock`, `StudySchedule` e `Flashcard` possuem o campo `userId` e estão vinculadas ao modelo `User`.
- **Autenticação e Sessão:** O arquivo [auth-mock.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/auth-mock.ts) possui suporte a sessões reais via Supabase (`AUTH_MODE="SUPABASE"`) e sincronização transparente com o banco de dados local.
- **Internacionalização e Tone de Gênero:** O arquivo [user-copy.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/user-copy.ts) já está componentizado para retornar termos masculinos ou femininos com base no campo `languageTone` do usuário.
- **Envio de e-mails diários (Cron):** A rota de e-mails [route.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/app/api/cron/reminder/route.ts) é iterativa por usuário e respeita as configurações de horário de envio e dias de estudo individuais de forma muito segura.

### O que ainda está acoplado à Gabriela/TRT (Bloqueadores)
1. **Scheduler Hardcoded:** O agendador em [scheduler.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/scheduler.ts) está acoplado ao ciclo rígido de 6 dias do TRT4 (`TRT4_STRATEGY`) e à data limite fixa de 30/11/2026.
2. **Prompts de IA Rígidos:** Os prompts de identificação de matérias e geração de flashcards estão instruídos para pensar como "especialistas em Direito/concurso TRT/banca FCC" e classificar os PDFs estritamente na lista de 12 matérias do TRT4.
3. **Defaults em Banco de Dados:** O campo `examGoal` em tabelas e rotas de registro/onboarding assume `"TRT"` ou `"TRT4"` como padrão automático para novos usuários.

### Riscos Identificados
- **Falha de Escalonamento do Cronograma (Risco Crítico):** Se Henrique cadastrar matérias de Segurança da Informação, o agendador atual não encontrará correspondência no ciclo TRT4 e agendará os blocos em ordem aleatória (ou cairá em loop infinito/fallbacks imprevisíveis).
- **Vazamento de Metadados / IDOR (Risco de Segurança):** Duas rotas de API críticas (`approve-blocks` e `flashcards/generate`) realizam buscas com `findUnique` pelo ID do bloco/material sem filtrar pelo `userId` do usuário autenticado. Embora o salvamento final use o ID correto, isso abre brecha para vazamento e cruzamento de dados de materiais entre usuários.
- **Hallucinação de Flashcards (Risco de Qualidade):** PDFs de Segurança da Informação analisados pelo prompt jurídico atual gerarão perguntas sobre prazos processuais ou súmulas inexistentes devido ao viés severo do sistema de prompts.

### Recomendações Principais
- Implementar **Mapeamento Explicático** de estratégia de estudos na tabela de preferências do usuário.
- Adotar um **Algoritmo de Priorização Proporcional (Opção D)** que utilize os pesos das prioridades das matérias no lugar de um ciclo rígido de nomes.
- Expandir a assinatura das funções e prompts de IA para injetar `examGoal` e `focusArea` do usuário autenticado.

---

## Fluxo da Gabriela

O fluxo e o histórico de estudos da Gabriela devem ser preservados intocados. 

### O que preservar
- **Dados Históricos:** Não alterar registros existentes nas tabelas `StudySubject`, `StudyMaterial`, `StudyBlock`, `StudyScheduleItem` e `Flashcard` cujo `userId` pertença à Gabriela.
- **Timezone e Horário:** O fuso de referência para e-mails (`America/Sao_Paulo`) e a rotina padrão de 7 dias com meta diária de 120 minutos.
- **Estratégia de Ciclo:** A Gabriela utiliza o arquivo [trt4.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/strategies/trt4.ts) para ordenar suas matérias prioritárias.
- **Linguagem Feminina:** Manter `languageTone` configurado como `"FEMININE"`.

### Como garantir a preservação sem usar hardcode de ID/E-mail
Em vez de condicionais de código estáticos do tipo `if (userId === "id-da-gabi")`, criaremos campos explícitos no banco de dados e migraremos os dados atuais da Gabriela:
- `examGoal` = `"TRT4"`
- `focusArea` = `"Direito / Concurso TRT4"`
- `scheduleGenerationMode` = `"LEGACY_TRT4"`
- `languageTone` = `"FEMININE"`

O agendador verificará se `scheduleGenerationMode === "LEGACY_TRT4"` para rodar o fluxo legado. Novos usuários começarão com `scheduleGenerationMode === "DYNAMIC_WEIGHTED"` ou nulo.

---

## Fluxo de novos usuários

Para qualquer usuário cujo `examGoal` não seja `"TRT4"` ou cujo `scheduleGenerationMode` não seja `"LEGACY_TRT4"`:

1. **Objetivo:** O agendamento e o cronograma devem olhar para a data limite do exame do próprio usuário (`deadline` ou `estimatedExamDate`), e não para 30/11/2026.
2. **Ciclo de Matérias:** A IA não assume matérias jurídicas nem segue o ciclo fixo de 6 dias do TRT4. As matérias serão distribuídas proporcionalmente com base na prioridade definida.
3. **Tom de Comunicação:** O tom padrão deve ser `"MASCULINE_NEUTRAL"` ou o selecionado no painel.

---

## Materiais e IA

### Arquivos afetados:
- [organizer.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/ai/organizer.ts)
- [prompts/organizer.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/ai/prompts/organizer.ts)
- [organize/route.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/app/api/materials/[id]/organize/route.ts)
- [organize-all/route.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/app/api/materials/organize-all/route.ts)

### Perguntas da Auditoria:

1. **A IA hoje consegue criar matérias novas automaticamente?**
   *Sim.* Nas rotas de organização individual e em lote, a IA roda a identificação da matéria. Se ela não encontrar uma matéria no banco com nome correspondente, ela cria o registro em `StudySubject` usando o nome sugerido.
2. **A IA está limitada a matérias jurídicas/TRT?**
   *Sim, no nível de prompt.* O prompt [SUBJECT_IDENTIFICATION_PROMPT](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/ai/prompts/organizer.ts#L6) lista apenas 12 matérias oficiais do TRT4 e instrui explicitamente a IA a escolher um desses nomes, o que causará classificação incorreta de materiais de TI e Cybersecurity.
3. **O prompt de organização presume TRT/FCC/Direito?**
   *Sim.* O prompt de identificação de matérias e o prompt de estrutura de blocos usam exemplos de legislações específicas de concursos (Lei 8.112, CLT, CPC) e exigem mapeamento contra a matriz fixa `OFFICIAL_TOPICS`.
4. **O prompt consegue organizar PDFs de Segurança da Informação?**
   *Não de forma nativa.* Ele gerará erros de validação porque tentará encaixar os tópicos de Segurança na matriz de tópicos de Direito do Trabalho/Constitucional, resultando em fallbacks de títulos genéricos proibidos ou erros de mapeamento de tópicos (como `"VALIDATION_FAILED"` ou `"TOC_MAPPING_FAILED"`).
5. **A matéria é extraída do conteúdo do PDF ou escolhida de lista fixa?**
   *Ambos.* Ela é extraída do PDF analisando as primeiras páginas, mas a IA é forçada a mapear essa extração contra a lista fixa de 12 matérias de Direito no prompt.
6. **O usuário consegue revisar/alterar a matéria criada?**
   *Sim.* Existe um endpoint PATCH `/api/subjects/[id]` e a rota `/api/materials/[id]/update-subject` para alterar o vínculo.
7. **O usuário consegue mesclar matérias duplicadas?**
   *Sim.* Existe a rota `/api/subjects/[id]/merge` e o modal correspondente no frontend para mover dados de uma disciplina para outra e excluir a duplicada.
8. **O usuário consegue priorizar matérias no cronograma?**
   *Não de forma ativa.* A propriedade `studyPriority` é lida apenas de forma binária (`PRIMARY` / `ACTIVE` vs `EXCLUDED`). O usuário não consegue reordenar ou atribuir pesos de prioridade no cronograma atual.

---

## Matérias e Priorização

### Modelo de Priorização Proposto (Opção D - Proporcional Adaptativo)
Em vez de forçar o usuário a arrastar itens ou definir valores manuais difíceis de calibrar, utilizaremos a **Opção D (Híbrida)**, mapeada diretamente nas propriedades atuais do banco de dados para evitar migrações de esquema:

| Prioridade do Usuário | Valor no Banco (`studyPriority`) | Peso no Agendador | Frequência de Estudos |
|---|---|---|---|
| **Alta** | `"PRIMARY"` | **3** | Alta recorrência de blocos no cronograma |
| **Média** | `"ACTIVE"` | **2** | Recorrência balanceada |
| **Baixa** | `"SECONDARY"` | **1** | Recorrência reduzida |
| **Excluída** | `"EXCLUDED"` | **0** | Não entra no cronograma de teoria |

#### Como o algoritmo distribuirá proporcionalmente:
Durante a geração de cronograma, faremos o cálculo da distribuição dos dias úteis disponíveis baseado no peso acumulado. 
Por exemplo, se o estudante Henrique possui:
- 2 matérias Alta (Peso 3 cada = 6)
- 2 matérias Média (Peso 2 cada = 4)
- 2 matérias Baixa (Peso 1 cada = 2)
- Peso Total = 12

Se ele tem 24 dias úteis no cronograma de estudos:
- Matérias **Altas** receberão: $(3 / 12) \times 24 = 6$ dias de estudo cada.
- Matérias **Médias** receberão: $(2 / 12) \times 24 = 4$ dias de estudo cada.
- Matérias **Baixas** receberão: $(1 / 12) \times 24 = 2$ dias de estudo cada.

Isso garante uma distribuição matemática ideal baseada em prioridades declarativas e fáceis de editar no painel.

---

## Cronograma

### Arquivos afetados:
- [scheduler.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/scheduler.ts)
- [strategies/trt4.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/strategies/trt4.ts)

### Acoplamento Identificado:

1. **Ciclo Fixo:** A seleção de quais matérias agendar no dia usa `TRT4_STRATEGY.cycle` ([scheduler.ts:L226](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/scheduler.ts#L226)), que é um array fixo de strings de matérias jurídicas.
2. **Deadline Fixo:** O loop de geração estende-se de forma rígida até `2026-11-30T23:59:59` ([scheduler.ts:L138](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/scheduler.ts#L138)).
3. **Subdivisão de Horas Fixo:** Presume sempre a alocação de 30 minutos de SRS + 2 blocos teóricos de 45 minutos (completando 120 minutos de estudo).

### Proposta de Generalização:
Ao instanciar `generateSmartSchedule`, buscaremos o `UserPreferences` correspondente:
- Se `examGoal === "TRT4"`, rodar a lógica legada baseada em `TRT4_STRATEGY`.
- Caso contrário:
  1. Definir o fim do cronograma usando o campo `deadline` de `UserPreferences`. Se for nulo, usar 90 dias a partir da data atual como padrão.
  2. Gerar a sequência de matérias usando o algoritmo proporcional (Opção D) com base nos pesos das matérias qualificadas do usuário.
  3. Preencher o dia de estudos com os blocos pendentes das matérias agendadas para aquele dia, respeitando a meta diária de estudos (`dailyGoalMinutes`) de Henrique.

---

## Flashcards e SRS

### Arquivos afetados:
- [flashcards.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/ai/flashcards.ts)
- [prompts/flashcard-generation.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/ai/prompts/flashcard-generation.ts)
- [srs-utils.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/srs/srs-utils.ts)

### Análise de Acoplamento:
- O prompt padrão instrui o LLM a simular uma prova da banca FCC e cobrar legislação expressa/súmulas.
- A função [getUnifiedTodayCards](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/srs/srs-utils.ts#L23) possui uma cláusula de OR global para cards no estado `NEW` ([srs-utils.ts:L95-101](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/lib/srs/srs-utils.ts#L95-L101)):
  ```ts
  {
    reviewState: "NEW",
    OR: [
      { lastReviewedAt: null },
      { repetitionCount: 0 },
      { repetitionCount: null }
    ]
  }
  ```
  Isso traz todos os cards novos criados no banco de dados para a fila diária do usuário, misturando matérias que ele sequer estudou ainda.

### Proposta de Ajuste:
1. **Prompts Dinâmicos:** Modificar `buildFlashcardPrompt` para aceitar `examGoal` e `focusArea`. Se for algo diferente de concurso público, o prompt adaptará as regras focando em conceitos, metodologias, controles práticos de Segurança (ISO 27001, NIST, CIS, etc.) e siglas.
2. **Isolamento de Novos Cards:** Limitar o carregamento de cartões no estado `NEW` em `getUnifiedTodayCards` apenas para os blocos ativamente agendados para o dia de hoje (removendo a cláusula OR global).

---

## E-mails Automáticos

O envio de e-mails diários em [reminder/route.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/app/api/cron/reminder/route.ts) já está muito bem modelado para multiusuário.

### Verificação de Vazamento de Dados:
- **Separação garantida:** A query de busca dos blocos teóricos de ontem e de hoje utiliza `{ userId: user.id }` de forma consistente em todas as queries internas.
- **Fuso horário e janela:** O cron roda em lotes de usuários elegíveis para aquela faixa de horário, comparando `preferences.emailReminderTime` e marcando `lastDailyReminderSentAt` após o envio com sucesso.
- **Adaptação para Henrique:** O e-mail utilizará a propriedade `user.preferences.languageTone` para formatar a saudação ("Bem-vindo") e o nome do seu objetivo ("certificações de Segurança da Informação") virá dinamicamente de `preferences.examGoal` e `focusArea`.

---

## Segurança e Isolamento de Dados

Identificamos duas rotas vulneráveis a IDOR (Insecure Direct Object Reference) que precisam de correções simples de filtro:

### 1. `/api/materials/[id]/approve-blocks`
- **Arquivo:** [approve-blocks/route.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/app/api/materials/[id]/approve-blocks/route.ts#L20-L31)
- **Vulnerabilidade:** Realiza a busca `prisma.studyMaterial.findUnique({ where: { id } })`. Qualquer usuário autenticado com um ID de material válido de outro usuário pode consultar e disparar a criação de blocos.
- **Correção:** Alterar para `findFirst` com filtro de `userId`:
  ```ts
  const material = await prisma.studyMaterial.findFirst({
    where: { id, userId: mockUserId }
  });
  ```

### 2. `/api/blocks/[id]/flashcards/generate`
- **Arquivo:** [generate/route.ts](file:///c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/src/app/api/blocks/[id]/flashcards/generate/route.ts#L17-L23)
- **Vulnerabilidade:** Realiza a busca `prisma.studyBlock.findUnique({ where: { id } })` sem validar se o bloco pertence ao usuário logado.
- **Correção:** Alterar para `findFirst` com validação de `userId`:
  ```ts
  const block = await prisma.studyBlock.findFirst({
    where: { id, userId: mockUserId },
    include: { material: true, subject: true }
  });
  ```

---

## UI Necessária

Para suportar o fluxo Henrique (Estudante 2), precisamos disponibilizar controles na interface:

1. **Onboarding / Perfil:**
   - Adicionar campos de input em `/settings` ou `/profile` para o usuário editar de forma autônoma seu `examGoal` (Ex: "Certificações em Segurança da Informação"), `focusArea` (Ex: "Cybersecurity"), `deadline` e `languageTone`.
2. **Dropdown de Prioridade na Tela de Matérias:**
   - Adicionar uma listagem de matérias que mostre a prioridade de cada uma e permita atualizá-la (Dropdown com opções: "Alta", "Média", "Baixa", "Excluída do Cronograma") disparando uma requisição PATCH para `/api/subjects/[id]`.
3. **Painel Intermediário de Validação de Matérias/Blocos:**
   - Modificar a tela de upload e visualização do material para dar a opção de "Revisar Sugestão de Blocos" antes de gerar o cronograma definitivo.

---

## Automações

| Automação | Escopo | Ajuste Necessário para Henrique |
|---|---|---|
| **Rollover Dinâmico** | Por usuário | Nenhum. O rollover já respeita o `userId` e transfere as pendências teóricas de forma isolada. |
| **Cron de E-mails** | Por usuário | Nenhum. Roda de forma federada iterando sobre todos os usuários ativos. |
| **Matérias Secundárias** | Por usuário | Nenhum. O endpoint `/api/schedule/activate-secondary` atualiza a prioridade do subject filtrando por `userId`. |
| **Geração de Cronograma** | Por usuário | **Sim.** Precisa parar de usar a estratégia rígida do TRT4 para novos usuários, adotando o algoritmo de prioridade proporcional. |

---

## Plano de Implementação Recomendado

Propomos as seguintes etapas mínimas e ordenadas para liberar o Henrique como estudante número 2 de forma totalmente segura:

### Etapa 1: Correção de Segurança (IDOR) e Migração da Gabriela (P0)
- [ ] Aplicar filtros de `userId` nas rotas `/api/materials/[id]/approve-blocks` e `/api/blocks/[id]/flashcards/generate`.
- [ ] Rodar uma query de seed/migração direta no banco de dados para garantir que a conta da Gabriela possua as preferências explícitas definidas: `examGoal: "TRT4"`, `languageTone: "FEMININE"`, `scheduleGenerationMode: "LEGACY_TRT4"`.

### Etapa 2: Prompts de IA e Extração Multiobjetivo (P1)
- [ ] Atualizar as assinaturas de `identifySubject` e `detectStructure` em `organizer.ts` para receber `examGoal` e `focusArea` do usuário.
- [ ] Ajustar o prompt de identificação de matérias: se `examGoal !== "TRT4"`, instruir a IA a inferir o nome da matéria de forma livre a partir do PDF (sem limitá-la às 12 matérias jurídicas).
- [ ] Ajustar o prompt de geração de flashcards para adaptar a persona técnica com base no `examGoal` do usuário.

### Etapa 3: Algoritmo de Agendamento Proporcional (P1)
- [ ] No arquivo `scheduler.ts`, condicionalizar a geração de cronograma:
  - Se `userPrefs.scheduleGenerationMode === "LEGACY_TRT4"` (Gabriela), mantém a lógica antiga.
  - Caso contrário, calcula as datas úteis disponíveis usando o campo `deadline` do usuário e distribui as matérias proporcionalmente com base nos pesos das prioridades (`PRIMARY` = 3, `ACTIVE` = 2, `SECONDARY` = 1).
- [ ] Limitar a query de novos cards em `getUnifiedTodayCards` para evitar vazamento de cartões de blocos ainda não estudados.

### Etapa 4: Ajustes de UI e Onboarding (P2)
- [ ] Habilitar campos de edição de `examGoal` e `deadline` no formulário de configurações do estudante.
- [ ] Adicionar controle de prioridade (Alta / Média / Baixa / Excluída) no componente de matérias no frontend.
- [ ] Testar de ponta a ponta o fluxo de Henrique subindo PDFs de Segurança da Informação e validando o isolamento de dados.
