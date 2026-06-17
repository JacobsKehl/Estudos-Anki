# Plano Técnico — Modo de Aceleração Adaptativo

Este documento organiza o planejamento do Modo de Aceleração Adaptativo, registrando as etapas concluídas e o direcionamento futuro das fases pendentes.

---

## ⚡ Fase 2 Concluída: Continuar Estudando

### Objetivo
Após a Gabriela concluir um bloco de estudo, oferecer opções de continuação inteligentes para que ela possa aproveitar o tempo disponível sem sair do fluxo de estudo. Especialmente útil quando ela termina antes do tempo estimado.

### Fluxo na UI
Após a conclusão do bloco, a tela de "Sessão Concluída" ganha uma nova seção antes dos botões de ação atuais:

```
┌─────────────────────────────────────────────┐
│  🏆  Sessão Concluída!                      │
│  Constitucional — Bloco 5                   │
│                                             │
│  Tempo: 18:42  |  Cards: 8  |  Revisão: D+1│
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│  ⚡ Deseja continuar estudando?              │
│                                             │
│  [ 🔴 Dir. Constitucional — Bloco 3 ]       │
│     Pendência atrasada (14/06)              │
│                                             │
│  [ 📘 Dir. Constitucional — Bloco 6 ]       │
│     Próximo bloco desta matéria             │
│                                             │
│  [ 📅 Língua Portuguesa — Bloco 4 ]         │
│     Próxima tarefa do dia                   │
│                                             │
│  [ 🔄 Reler este bloco ]                    │
│     Segunda leitura (não altera cronograma) │
│                                             │
│  [ Encerrar por agora ]                     │
│                                             │
│ ─────────────────────────────────────────── │
│  [Praticar Cards]  [Voltar ao Cronograma]   │
└─────────────────────────────────────────────┘
```

A seção "Continuar estudando" só aparece se existirem sugestões disponíveis.

### Endpoint Utilizado: `GET /api/schedule/continue-suggestions`
Retorna uma lista ordenada de sugestões de estudos com base na hierarquia pedagógica aprovada:
1. **OVERDUE** — `StudyScheduleItem` com `actionType = "THEORY"`, `status IN (PENDING, IN_PROGRESS)`, `scheduledDate < hoje`, matéria `PRIMARY` ou `ACTIVE`. Ordena por `scheduledDate ASC` (mais atrasada primeiro). Máximo 1 item.
2. **SAME_SUBJECT** — Próximo `StudyBlock` com `status = "NOT_STARTED"` na mesma matéria (`completedSubjectId`), que não esteja já agendado como PENDING/IN_PROGRESS. Ordena por `orderIndex ASC`, `pageStart ASC`. Máximo 1 item.
3. **TODAY_CYCLE** — `StudyScheduleItem` com `actionType = "THEORY"`, `status IN (PENDING, IN_PROGRESS)`, `scheduledDate` dentro do dia de hoje, matéria `PRIMARY` ou `ACTIVE`, excluindo o bloco recém-concluído. Ordena por `priorityScore DESC`. Máximo 1 item.
4. **NEXT_ELIGIBLE** — Se nenhum dos anteriores encontrou resultado, busca o próximo `StudyBlock` elegível do ciclo principal (mesma lógica do `findReplacementBlock` em `completion.ts`), excluindo o bloco concluído e o da mesma matéria. Máximo 1 item.
5. **SECOND_PASS** — Sempre presente como última opção. Referencia o `completedBlockId`.

**Filtros obrigatórios em todas as buscas:**
- `studyPriority NOT IN ("SECONDARY", "EXCLUDED")`
- `materialRole NOT "SUPPORT_MATERIAL"`

### Regra para segunda leitura
A segunda leitura não cria nenhum `StudyScheduleItem` novo.
Ao clicar em "Reler este bloco":
- A UI navega para `/blocks/{completedBlockId}?secondPass=true&returnTo=/`
- O `BlockStudyView` detecta `secondPass=true` e entra em modo de releitura
- O timer inicia pausado, exigindo clique manual em "Iniciar Leitura"
- O botão de conclusão da releitura muda para "Concluir segunda leitura"
- Ao concluir, faz `POST /api/study-session-log` para registrar de forma pura o log de telemetria sem interferir no cronograma ou no SRS.

---

## ⏳ Fase 3 em Standby: Ritmo Adaptativo / SpeedFactor

### Status Atual
Este componente de aceleração adaptativa está formalmente em **standby** e nenhuma implementação foi iniciada. As Fases 1 (Coleta de Tempo Real) e 2 (Continuar Estudando) estão 100% concluídas, corrigidas e validadas.

### Objetivo Conceitual
A Fase 3 terá como finalidade analisar os dados reais de tempo líquido de estudo acumulados nas fases anteriores em `StudySessionLog` para ajustar dinamicamente o ritmo e o cronograma do aluno.

Exemplo conceitual:
- Tempo estimado (`estimatedMinutes`) do bloco = 30 minutos
- Tempo líquido real de estudo (`actualDurationMinutes`) = 15 minutos
- Ritmo real = 50% do tempo estimado (aceleração de 2x).

### Backlog de Funcionalidades Futuras
Quando a Fase 3 for reaberta, o plano técnico abrangerá:
1. **Cálculo de `speedFactor`**: Algoritmo para derivar o fator de velocidade a partir do histórico consolidado de `StudySessionLog`.
2. **Comparação de Tempos**: Comparar tempos estimados vs. tempos reais no dashboard.
3. **Análise de Aceleração**: Identificar se o ritmo do usuário está acima do previsto de forma consistente.
4. **Relatórios Adaptativos**: Geração de visualizações gráficas de ritmo de leitura.
5. **Simulação de Término**: Estimar e recalcular a data provável de conclusão do edital com base na velocidade real.
6. **Aumento Adaptativo de Carga**: Sugerir metas diárias maiores ou inclusão de novos blocos teóricos no ciclo.
7. **Compactação de Cronograma**: Reestruturar os dias restantes comprimindo blocos sob demanda.
8. **Ajuste Fino de Estimativas**: Permitir recalibrar a estimativa de tempo de novos blocos de estudo.

### Restrições Atuais (O que NÃO faz agora)
1. **Sem Implementação**: Nenhum código, api ou modelagem de ritmo foi ativado.
2. **Cronograma Intacto**: Não há compactação ou alteração do fluxo do agendador (`scheduler.ts`).
3. **Prazos Preservados**: A data final do cronograma (`estimatedExamDate`) e deadlines permanecem inalterados.
4. **Minutos Estimados Fixos**: O `estimatedStudyMinutes` original de todos os blocos continua congelado.
5. **Sem Bloqueio de Carryover**: As regras de carryover obrigatório para itens de teoria atrasados não são afetadas.
6. **Preservação de SRS**: O motor do spaced repetition e flashcards não sofre nenhuma influência.

### Critérios de Retomada Futura
A Fase 3 só será ativada e planejada se os seguintes pré-requisitos forem atendidos:
1. **Dados Consolidados**: Acúmulo de dados reais de uso por dias/semanas em `StudySessionLog`.
2. **Estabilidade Comprovada**: Confirmação contínua de estabilidade do timer manual no frontend das Fases 1 e 2.
3. **Validação Visual Remota**: Homologação visual definitiva de todas as telas por parte do usuário.
4. **Nova Autorização Expressa**: Aprovação explícita do usuário para reabrir a Fase 3.
5. **Revisão e Aprovação de Novo Plano Técnico**: Desenhar e validar a arquitetura antes de qualquer alteração no código.
