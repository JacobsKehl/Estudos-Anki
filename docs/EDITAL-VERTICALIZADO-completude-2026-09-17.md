# Edital verticalizado — relatório de completude

**Data:** 17/09/2026 · **Prova:** TRT4 Analista Judiciário, FCC, 30/11/2026 · **Caminho:** Supabase (leitura), mesmo do guardião em modo integração.

## ⚠️ Leia isto antes dos números

**A taxa de mapeamento dos 89 blocos CFC ativos para o edital é 0/89 — nenhum bloco tem `officialTopicId` preenchido.**

Isso não é um bug de medição — foi verificado que o vínculo *funciona* (424 `StudyBlock` do usuário, fora do CFC, têm `officialTopicId` preenchido). A causa é estrutural: o vínculo é atribuído pela mesma rota de organização por IA (`organize-all`) que os 5 PDFs do CFC são **deliberadamente excluídos** dela (AGENTS.md §9), para preservar o blueprint determinístico. O mapeamento oficial nunca foi executado sobre o conteúdo que ela de fato estuda.

**Consequência direta para este relatório:** a coluna "estado" abaixo, para os 81 tópicos das 5 matérias do plano, mostra **100% `🔴 SEM BLOCO`** — não porque os PDFs não cobrem o edital, mas porque nenhum bloco foi classificado contra um tópico. A seção 1 (tópicos sem cobertura) e a seção 2 (blocos sem tópico) descrevem, hoje, **o mesmo universo de 89 blocos vistos por dois ângulos** — não duas listas independentes. Por instrução explícita desta rodada ("se o vínculo `officialTopicId` não existe, o tópico não está coberto — ponto"), não tentei inferir cobertura por semelhança de título. O resultado é que este relatório mede a **dívida de mapeamento**, não a **cobertura real de conteúdo** — que continua desconhecida até o mapeamento ser feito.

---

## Cabeçalho — a régua

```
Versão ativa do edital:                           ESTRATEGIA_COURSE_GRID (cm01_estrategia_grid_v1)
Tópicos do edital nas 5 matérias do plano:        81
Blocos CFC ativos:                                89
Blocos CFC EXCLUDED (não contam, P2):             100
Blocos CFC com officialTopicId atribuído:         0/89   ← a confiança deste relatório
Blocos CFC concluídos:                            48
Minutos totais / concluídos / restantes:          1083 / 537 / 546
Dias até a prova (30/11/2026):                     75
```

**Divergência banco × arquivo de constantes, verificada:** o banco (versão ativa) tem **110** tópicos. O arquivo `src/lib/constants/official-topics.ts` tem **110** entradas reais (minha primeira contagem, 111, incluía por engano a declaração de tipo `topicCode: string;` da interface — refeita). **Não há divergência real** — os dois coincidem.

---

## Taxa de mapeamento, em detalhe

```
where: StudyBlock.userId = Gabriela AND materialId in (5 PDFs CFC) AND theoryStatus != EXCLUDED

Com officialTopicId preenchido:                    0/89
officialTopicId preenchido, officialTopicName nulo: 0
officialTopicName preenchido, officialTopicId nulo: 0
```

---

## Direito Administrativo — 0 de 20 tópicos concluídos (0%)

*(peso do tópico nesta matéria: 1.2)*

| código | tópico (título do edital) | blocos | concluídos | páginas | min | estado |
|---|---|---|---|---|---|---|
| Tópico 00 | Princípios administrativos. Regime jurídico-administrativo. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 01 | Introdução ao direito administrativo. Estado, governo e administraç... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 02 | Organização administrativa. Administração direta e indireta. Autarq... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 03 | Fundações públicas. Empresas públicas. Sociedades de economia mista. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 04 | Entidades paraestatais e terceiro setor. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 05 | Poderes e deveres da Administração Pública. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 06 | Atos administrativos. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 07 | Licitações e Contratos Administrativos. Lei nº 14.133/2021 — licita... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 08 | Licitações e Contratos Administrativos. Lei nº 14.133/2021 — licita... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 09 | Licitações e Contratos Administrativos — contratos. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 10 | Serviços públicos. Lei nº 8.987/1995. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 11 | PPPs, consórcios públicos e consórcios administrativos. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 12 | Convênios e instrumentos congêneres. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 13 | Controle da Administração Pública. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 14 | Responsabilidade civil do Estado. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 15 | Bens públicos. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 16 | Intervenção do Estado na propriedade. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 17 | Agentes públicos. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 18 | Processo administrativo. Lei nº 9.784/1999. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 19 | Improbidade administrativa. Lei nº 8.429/1992. | 0 | 0 | — | — | 🔴 SEM BLOCO |

## Direito Constitucional — 0 de 17 tópicos concluídos (0%)

*(peso do tópico nesta matéria: 1.2)*

| código | tópico (título do edital) | blocos | concluídos | páginas | min | estado |
|---|---|---|---|---|---|---|
| Tópico 00 | Conceitos introdutórios. Classificação e aplicabilidade das normas. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 01 | Teoria geral dos direitos fundamentais. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 02 | Direitos e deveres individuais e coletivos — Parte I. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 03 | Direitos e deveres individuais e coletivos — Parte II. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 04 | Direitos sociais. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 05 | Nacionalidade. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 06 | Direitos políticos. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 07 | Partidos políticos. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 08 | Organização político-administrativa. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 09 | Administração Pública. Servidores públicos. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 10 | Poder Legislativo. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 11 | Processo Legislativo. Reforma Constitucional. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 12 | Poder Executivo. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 13 | Poder Judiciário. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 14 | Funções essenciais à Justiça. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 15 | Ordem Social. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 16 | Controle de Constitucionalidade. | 0 | 0 | — | — | 🔴 SEM BLOCO |

## Direito do Trabalho — 0 de 13 tópicos concluídos (0%)

*(peso do tópico nesta matéria: 2)*

| código | tópico (título do edital) | blocos | concluídos | páginas | min | estado |
|---|---|---|---|---|---|---|
| Tópico 01 | Princípios e fontes do Direito do Trabalho. Direitos Constitucionai... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 02 | Relações de trabalho e emprego. Empregado. Empregador. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 03 | Terceirização trabalhista. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 04 | Contrato de trabalho. Alteração, suspensão e interrupção. Poderes d... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 05 | Término do contrato de trabalho. Aviso prévio. Garantias provisória... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 06 | Jornada de trabalho e descansos. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 07 | Remuneração e salário. Equiparação salarial. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 08 | Férias. Prescrição e decadência. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 09 | Segurança e Saúde do Trabalho. CIPA. Trabalho do menor e da mulher. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 10 | Comissões de Conciliação Prévia. Direito Coletivo do Trabalho. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 11 | FGTS. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 12 | Sindicatos. Greve. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 13 | Trabalho doméstico. | 0 | 0 | — | — | 🔴 SEM BLOCO |

## Direito Processual Civil — 0 de 20 tópicos concluídos (0%)

*(peso do tópico nesta matéria: 1)*

| código | tópico (título do edital) | blocos | concluídos | páginas | min | estado |
|---|---|---|---|---|---|---|
| Tópico 00 | Normas Fundamentais do Processo Civil. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 01 | Jurisdição e Ação. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 02 | Competência. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 03 | Sujeitos Processuais: Partes e Procuradores. Litisconsórcio e Inter... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 04 | Sujeitos Processuais: Juízes, Auxiliares da Justiça, Ministério Púb... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 05 | Atos Processuais. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 06 | Comunicação dos Atos Processuais, Nulidade, Valor da Causa, Distrib... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 07 | Tutela Provisória. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 08 | Formação, Suspensão e Extinção do Processo. Procedimento comum até ... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 09 | Provas — parte 01. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 10 | Provas — parte 02. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 11 | Sentença, Coisa Julgada, Liquidação e Cumprimento de Sentença. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 12 | Processo de Execução. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 13 | Procedimentos Especiais — parte 01. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 14 | Procedimentos Especiais — parte 02. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 15 | Meios de Impugnação das Decisões Judiciais. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 16 | Recursos em Espécie. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 17 | Ação Popular, Ação Civil Pública, Mandado de Segurança, Mandado de ... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 18 | Processo Civil nos sistemas de controle da constitucionalidade e aç... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 19 | Processo Judicial Eletrônico. Lei nº 11.419/2006. | 0 | 0 | — | — | 🔴 SEM BLOCO |

## Direito Processual do Trabalho — 0 de 11 tópicos concluídos (0%)

*(peso do tópico nesta matéria: 2)*

| código | tópico (título do edital) | blocos | concluídos | páginas | min | estado |
|---|---|---|---|---|---|---|
| Tópico 00 | Teoria geral do processo do trabalho. Princípios e organização da J... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 01 | Competência da Justiça do Trabalho. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 02 | Serviços Auxiliares da Justiça do Trabalho. Partes e Procuradores. ... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 03 | Prazos processuais. Custas. Nulidades processuais. Petição inicial. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 04 | Notificação do reclamado. Resposta do réu. Revelia. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 05 | Audiência. Provas. Sentença. Coisa julgada. Rito sumário e sumaríss... | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 06 | Recursos no processo do trabalho — teoria geral e recursos em espécie. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 07 | Liquidação de sentença e processo de execução. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 08 | Procedimentos especiais trabalhistas. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 09 | Dissídio coletivo de trabalho e ação de cumprimento. | 0 | 0 | — | — | 🔴 SEM BLOCO |
| Tópico 10 | Processo Judicial Eletrônico. | 0 | 0 | — | — | 🔴 SEM BLOCO |

---

## 1. Tópicos sem cobertura (🔴 SEM BLOCO)

**81 de 81 tópicos do plano — hoje, isso é a lista inteira (mapeamento 0/89, ver aviso no topo). Não é a lista real de lacunas de conteúdo até o mapeamento ser feito.**

Ordenado por peso, decrescente:

| peso | matéria | código | tópico |
|---|---|---|---|
| 2 | Direito do Trabalho | Tópico 01 | Princípios e fontes do Direito do Trabalho. Direitos Constitucionais dos Trabalhadores. Renúncia e transação. |
| 2 | Direito do Trabalho | Tópico 02 | Relações de trabalho e emprego. Empregado. Empregador. |
| 2 | Direito do Trabalho | Tópico 03 | Terceirização trabalhista. |
| 2 | Direito do Trabalho | Tópico 04 | Contrato de trabalho. Alteração, suspensão e interrupção. Poderes do empregador. |
| 2 | Direito do Trabalho | Tópico 05 | Término do contrato de trabalho. Aviso prévio. Garantias provisórias de emprego. |
| 2 | Direito do Trabalho | Tópico 06 | Jornada de trabalho e descansos. |
| 2 | Direito do Trabalho | Tópico 07 | Remuneração e salário. Equiparação salarial. |
| 2 | Direito do Trabalho | Tópico 08 | Férias. Prescrição e decadência. |
| 2 | Direito do Trabalho | Tópico 09 | Segurança e Saúde do Trabalho. CIPA. Trabalho do menor e da mulher. |
| 2 | Direito do Trabalho | Tópico 10 | Comissões de Conciliação Prévia. Direito Coletivo do Trabalho. |
| 2 | Direito do Trabalho | Tópico 11 | FGTS. |
| 2 | Direito do Trabalho | Tópico 12 | Sindicatos. Greve. |
| 2 | Direito do Trabalho | Tópico 13 | Trabalho doméstico. |
| 2 | Direito Processual do Trabalho | Tópico 00 | Teoria geral do processo do trabalho. Princípios e organização da Justiça do Trabalho. |
| 2 | Direito Processual do Trabalho | Tópico 01 | Competência da Justiça do Trabalho. |
| 2 | Direito Processual do Trabalho | Tópico 02 | Serviços Auxiliares da Justiça do Trabalho. Partes e Procuradores. Ministério Público. |
| 2 | Direito Processual do Trabalho | Tópico 03 | Prazos processuais. Custas. Nulidades processuais. Petição inicial. |
| 2 | Direito Processual do Trabalho | Tópico 04 | Notificação do reclamado. Resposta do réu. Revelia. |
| 2 | Direito Processual do Trabalho | Tópico 05 | Audiência. Provas. Sentença. Coisa julgada. Rito sumário e sumaríssimo. |
| 2 | Direito Processual do Trabalho | Tópico 06 | Recursos no processo do trabalho — teoria geral e recursos em espécie. |
| 2 | Direito Processual do Trabalho | Tópico 07 | Liquidação de sentença e processo de execução. |
| 2 | Direito Processual do Trabalho | Tópico 08 | Procedimentos especiais trabalhistas. |
| 2 | Direito Processual do Trabalho | Tópico 09 | Dissídio coletivo de trabalho e ação de cumprimento. |
| 2 | Direito Processual do Trabalho | Tópico 10 | Processo Judicial Eletrônico. |
| 1.2 | Direito Administrativo | Tópico 00 | Princípios administrativos. Regime jurídico-administrativo. |
| 1.2 | Direito Administrativo | Tópico 01 | Introdução ao direito administrativo. Estado, governo e administração pública. |
| 1.2 | Direito Administrativo | Tópico 02 | Organização administrativa. Administração direta e indireta. Autarquias. Agências. |
| 1.2 | Direito Administrativo | Tópico 03 | Fundações públicas. Empresas públicas. Sociedades de economia mista. |
| 1.2 | Direito Administrativo | Tópico 04 | Entidades paraestatais e terceiro setor. |
| 1.2 | Direito Administrativo | Tópico 05 | Poderes e deveres da Administração Pública. |
| 1.2 | Direito Administrativo | Tópico 06 | Atos administrativos. |
| 1.2 | Direito Administrativo | Tópico 07 | Licitações e Contratos Administrativos. Lei nº 14.133/2021 — licitações parte 1. |
| 1.2 | Direito Administrativo | Tópico 08 | Licitações e Contratos Administrativos. Lei nº 14.133/2021 — licitações parte 2. |
| 1.2 | Direito Administrativo | Tópico 09 | Licitações e Contratos Administrativos — contratos. |
| 1.2 | Direito Administrativo | Tópico 10 | Serviços públicos. Lei nº 8.987/1995. |
| 1.2 | Direito Administrativo | Tópico 11 | PPPs, consórcios públicos e consórcios administrativos. |
| 1.2 | Direito Administrativo | Tópico 12 | Convênios e instrumentos congêneres. |
| 1.2 | Direito Administrativo | Tópico 13 | Controle da Administração Pública. |
| 1.2 | Direito Administrativo | Tópico 14 | Responsabilidade civil do Estado. |
| 1.2 | Direito Administrativo | Tópico 15 | Bens públicos. |
| 1.2 | Direito Administrativo | Tópico 16 | Intervenção do Estado na propriedade. |
| 1.2 | Direito Administrativo | Tópico 17 | Agentes públicos. |
| 1.2 | Direito Administrativo | Tópico 18 | Processo administrativo. Lei nº 9.784/1999. |
| 1.2 | Direito Administrativo | Tópico 19 | Improbidade administrativa. Lei nº 8.429/1992. |
| 1.2 | Direito Constitucional | Tópico 00 | Conceitos introdutórios. Classificação e aplicabilidade das normas. |
| 1.2 | Direito Constitucional | Tópico 01 | Teoria geral dos direitos fundamentais. |
| 1.2 | Direito Constitucional | Tópico 02 | Direitos e deveres individuais e coletivos — Parte I. |
| 1.2 | Direito Constitucional | Tópico 03 | Direitos e deveres individuais e coletivos — Parte II. |
| 1.2 | Direito Constitucional | Tópico 04 | Direitos sociais. |
| 1.2 | Direito Constitucional | Tópico 05 | Nacionalidade. |
| 1.2 | Direito Constitucional | Tópico 06 | Direitos políticos. |
| 1.2 | Direito Constitucional | Tópico 07 | Partidos políticos. |
| 1.2 | Direito Constitucional | Tópico 08 | Organização político-administrativa. |
| 1.2 | Direito Constitucional | Tópico 09 | Administração Pública. Servidores públicos. |
| 1.2 | Direito Constitucional | Tópico 10 | Poder Legislativo. |
| 1.2 | Direito Constitucional | Tópico 11 | Processo Legislativo. Reforma Constitucional. |
| 1.2 | Direito Constitucional | Tópico 12 | Poder Executivo. |
| 1.2 | Direito Constitucional | Tópico 13 | Poder Judiciário. |
| 1.2 | Direito Constitucional | Tópico 14 | Funções essenciais à Justiça. |
| 1.2 | Direito Constitucional | Tópico 15 | Ordem Social. |
| 1.2 | Direito Constitucional | Tópico 16 | Controle de Constitucionalidade. |
| 1 | Direito Processual Civil | Tópico 00 | Normas Fundamentais do Processo Civil. |
| 1 | Direito Processual Civil | Tópico 01 | Jurisdição e Ação. |
| 1 | Direito Processual Civil | Tópico 02 | Competência. |
| 1 | Direito Processual Civil | Tópico 03 | Sujeitos Processuais: Partes e Procuradores. Litisconsórcio e Intervenção de terceiros. |
| 1 | Direito Processual Civil | Tópico 04 | Sujeitos Processuais: Juízes, Auxiliares da Justiça, Ministério Público, Defensoria Pública e Advocacia Pública. |
| 1 | Direito Processual Civil | Tópico 05 | Atos Processuais. |
| 1 | Direito Processual Civil | Tópico 06 | Comunicação dos Atos Processuais, Nulidade, Valor da Causa, Distribuição e Registro. |
| 1 | Direito Processual Civil | Tópico 07 | Tutela Provisória. |
| 1 | Direito Processual Civil | Tópico 08 | Formação, Suspensão e Extinção do Processo. Procedimento comum até o saneamento. |
| 1 | Direito Processual Civil | Tópico 09 | Provas — parte 01. |
| 1 | Direito Processual Civil | Tópico 10 | Provas — parte 02. |
| 1 | Direito Processual Civil | Tópico 11 | Sentença, Coisa Julgada, Liquidação e Cumprimento de Sentença. |
| 1 | Direito Processual Civil | Tópico 12 | Processo de Execução. |
| 1 | Direito Processual Civil | Tópico 13 | Procedimentos Especiais — parte 01. |
| 1 | Direito Processual Civil | Tópico 14 | Procedimentos Especiais — parte 02. |
| 1 | Direito Processual Civil | Tópico 15 | Meios de Impugnação das Decisões Judiciais. |
| 1 | Direito Processual Civil | Tópico 16 | Recursos em Espécie. |
| 1 | Direito Processual Civil | Tópico 17 | Ação Popular, Ação Civil Pública, Mandado de Segurança, Mandado de Injunção, Habeas Data. |
| 1 | Direito Processual Civil | Tópico 18 | Processo Civil nos sistemas de controle da constitucionalidade e ações constitucionais. |
| 1 | Direito Processual Civil | Tópico 19 | Processo Judicial Eletrônico. Lei nº 11.419/2006. |

---

## 2. Blocos sem tópico (dívida de mapeamento)

**89 de 89 blocos CFC ativos sem `officialTopicId`.** Esta é a dívida de mapeamento, não de conteúdo — o material existe e muitos já foram estudados; ninguém os ligou a um tópico do edital.

| matéria | título | páginas | status |
|---|---|---|---|
| Direito Administrativo | GLOSSÁRIO DE SIGLAS | 6-7 | COMPLETED |
| Direito Administrativo | CONCEITOS E FONTES DO DIREITO ADMINISTRATIVO | 8-9 | COMPLETED |
| Direito Administrativo | ADMINISTRAÇÃO PÚBLICA (CONFORME CF/88) | 10-13 | COMPLETED |
| Direito Administrativo | PODERES E DEVERES DA ADMINISTRAÇÃO PÚBLICA | 14-16 | COMPLETED |
| Direito Administrativo | ATOS ADMINISTRATIVOS — parte 1/2 | 17-21 | COMPLETED |
| Direito Administrativo | ATOS ADMINISTRATIVOS — parte 2/2 | 22-25 | COMPLETED |
| Direito Administrativo | ORGANIZAÇÃO DA ADMINISTRAÇÃO PÚBLICA E TERCEIRO SETOR | 26-30 | COMPLETED |
| Direito Administrativo | SERVIÇOS PÚBLICOS — parte 1/2 | 31-35 | COMPLETED |
| Direito Administrativo | SERVIÇOS PÚBLICOS — parte 2/2 | 36-39 | COMPLETED |
| Direito Administrativo | RESPONSABILIDADE CIVIL DO ESTADO | 40-42 | COMPLETED |
| Direito Administrativo | CONTROLE DA ADMINISTRAÇÃO PÚBLICA | 43-49 | NOT_STARTED |
| Direito Administrativo | LEI 9.784/99 – PROCESSO ADMINISTRATIVO FEDERAL | 50-56 | NOT_STARTED |
| Direito Administrativo | BENS PÚBLICOS | 57-58 | NOT_STARTED |
| Direito Administrativo | INTERVENÇÃO DO ESTADO NA PROPRIEDADE PRIVADA | 59-63 | NOT_STARTED |
| Direito Administrativo | LEI 12.527/12 – ACESSO À INFORMAÇÃO | 64-67 | NOT_STARTED |
| Direito Administrativo | AGENTES PÚBLICOS – PARTE CONSTITUCIONAL | 68-75 | COMPLETED |
| Direito Administrativo | LEI 8.112/90 – ESTATUTO DOS SERVIDORES PÚBLICOS FEDERAIS — parte 1/3 | 76-80 | COMPLETED |
| Direito Administrativo | LEI 8.112/90 – ESTATUTO DOS SERVIDORES PÚBLICOS FEDERAIS — parte 2/3 | 81-84 | COMPLETED |
| Direito Administrativo | LEI 8.112/90 – ESTATUTO DOS SERVIDORES PÚBLICOS FEDERAIS — parte 3/3 | 85-89 | COMPLETED |
| Direito Administrativo | LEI 14.133/21 – NOVA LEI DE LICITAÇÕES (PARTE DE LICITAÇÕES) — parte 1/4 | 90-97 | NOT_STARTED |
| Direito Administrativo | LEI 14.133/21 – NOVA LEI DE LICITAÇÕES (PARTE DE LICITAÇÕES) — parte 2/4 | 98-105 | NOT_STARTED |
| Direito Administrativo | LEI 14.133/21 – NOVA LEI DE LICITAÇÕES (PARTE DE LICITAÇÕES) — parte 3/4 | 106-111 | NOT_STARTED |
| Direito Administrativo | LEI 14.133/21 – NOVA LEI DE LICITAÇÕES (PARTE DE LICITAÇÕES) — parte 4/4 | 112-116 | NOT_STARTED |
| Direito Administrativo | LEI 14.133/21 – NOVA LEI DE LICITAÇÕES (PARTE DE CONTRATOS) — parte 1/3 | 117-122 | NOT_STARTED |
| Direito Administrativo | LEI 14.133/21 – NOVA LEI DE LICITAÇÕES (PARTE DE CONTRATOS) — parte 2/3 | 123-127 | NOT_STARTED |
| Direito Administrativo | LEI 14.133/21 – NOVA LEI DE LICITAÇÕES (PARTE DE CONTRATOS) — parte 3/3 | 128-130 | NOT_STARTED |
| Direito Administrativo | LEI 8.429/92 – LEI DE IMPROBIDADE ADMINISTRATIVA — parte 1/2 | 131-135 | NOT_STARTED |
| Direito Administrativo | LEI 8.429/92 – LEI DE IMPROBIDADE ADMINISTRATIVA — parte 2/2 | 136-140 | NOT_STARTED |
| Direito Administrativo | LEI 13.709/18 – LEI GERAL DE PROTEÇÃO DE DADOS (LGPD) — parte 1/3 | 141-145 | NOT_STARTED |
| Direito Administrativo | LEI 13.709/18 – LEI GERAL DE PROTEÇÃO DE DADOS (LGPD) — parte 2/3 | 146-150 | NOT_STARTED |
| Direito Administrativo | LEI 13.709/18 – LEI GERAL DE PROTEÇÃO DE DADOS (LGPD) — parte 3/3 | 151-151 | NOT_STARTED |
| Direito Constitucional | ASPECTOS INTRODUTÓRIOS DO DIREITO CONSTITUCIONAL | 4-8 | COMPLETED |
| Direito Constitucional | DOS PRINCÍPIOS FUNDAMENTAIS | 9-9 | COMPLETED |
| Direito Constitucional | DOS DIREITOS E GARANTIAS FUNDAMENTAIS — parte 1/3 | 10-14 | COMPLETED |
| Direito Constitucional | DOS DIREITOS E GARANTIAS FUNDAMENTAIS — parte 2/3 | 15-18 | COMPLETED |
| Direito Constitucional | DOS DIREITOS E GARANTIAS FUNDAMENTAIS — parte 3/3 | 19-25 | COMPLETED |
| Direito Constitucional | DA ORGANIZAÇÃO DO ESTADO | 26-30 | COMPLETED |
| Direito Constitucional | DA INTERVENÇÃO | 31-32 | COMPLETED |
| Direito Constitucional | DA ADMINISTRAÇÃO PÚBLICA — parte 1/2 | 33-37 | COMPLETED |
| Direito Constitucional | DA ADMINISTRAÇÃO PÚBLICA — parte 2/2 | 38-42 | COMPLETED |
| Direito Constitucional | DO PODER LEGISLATIVO | 43-48 | COMPLETED |
| Direito Constitucional | DO PROCESSO LEGISLATIVO | 49-52 | COMPLETED |
| Direito Constitucional | DA FISCALIZAÇÃO CONTÁBIL, FINANCEIRA E ORÇAMENTÁRIA | 53-55 | NOT_STARTED |
| Direito Constitucional | DO PODER EXECUTIVO | 56-60 | NOT_STARTED |
| Direito Constitucional | DO PODER JUDICIÁRIO | 61-68 | NOT_STARTED |
| Direito Constitucional | DAS FUNÇÕES ESSENCIAIS À JUSTIÇA | 69-71 | NOT_STARTED |
| Direito Constitucional | DA DEFESA DO ESTADO E DAS INSTITUIÇÕES DEMOCRÁTICAS | 72-73 | NOT_STARTED |
| Direito Constitucional | DA ORDEM SOCIAL | 74-77 | NOT_STARTED |
| Direito Constitucional | CONTROLE DE CONSTITUCIONALIDADE | 78-85 | COMPLETED |
| Direito do Trabalho | PRINCÍPIOS E FONTES DO DIREITO DO TRABALHO | 4-4 | COMPLETED |
| Direito do Trabalho | DIREITOS TRABALHISTAS PREVISTOS CONSTITUCIONALMENTE | 5-6 | COMPLETED |
| Direito do Trabalho | EMPREGADOR, EMPREGADO E RELAÇÃO DE EMPREGO | 7-7 | COMPLETED |
| Direito do Trabalho | CONTRATO DE TRABALHO | 8-10 | COMPLETED |
| Direito do Trabalho | CONTRATOS ESPECIAIS DE TRABALHO | 11-11 | NOT_STARTED |
| Direito do Trabalho | REMUNERAÇÃO | 12-14 | COMPLETED |
| Direito do Trabalho | DURAÇÃO DO TRABALHO | 15-16 | COMPLETED |
| Direito do Trabalho | TELETRABALHO | 17-17 | COMPLETED |
| Direito do Trabalho | FÉRIAS ANUAIS | 18-19 | COMPLETED |
| Direito do Trabalho | RESCISÃO DO CONTRATO DE TRABALHO | 20-21 | COMPLETED |
| Direito do Trabalho | AVISO PRÉVIO | 22-22 | COMPLETED |
| Direito do Trabalho | TUTELAS ESPECIAIS | 23-24 | NOT_STARTED |
| Direito do Trabalho | RESPONSABILIDADE TRABALHISTA | 25-25 | NOT_STARTED |
| Direito do Trabalho | CONVENÇÕES COLETIVAS DE TRABALHO | 26-27 | NOT_STARTED |
| Direito do Trabalho | JURISPRUDÊNCIAS — parte 1/2 | 28-35 | NOT_STARTED |
| Direito do Trabalho | JURISPRUDÊNCIAS — parte 2/2 | 36-37 | NOT_STARTED |
| Direito Processual Civil | INTRODUÇÃO | 4-5 | COMPLETED |
| Direito Processual Civil | DA FUNÇÃO JURISDICIONAL | 6-10 | COMPLETED |
| Direito Processual Civil | PARTES E DOS PROCURADORES - SUJEITOS DO PROCESSO | 11-17 | COMPLETED |
| Direito Processual Civil | JUIZ E DOS AUXILIARES DA JUSTIÇA | 18-22 | COMPLETED |
| Direito Processual Civil | ATOS PROCESSUAIS | 23-29 | COMPLETED |
| Direito Processual Civil | INTIMAÇÕES | 30-31 | COMPLETED |
| Direito Processual Civil | TUTELA PROVISÓRIA (ARTS. 294 A 311) | 32-33 | COMPLETED |
| Direito Processual Civil | FORMAÇÃO, SUSPENSÃO E EXTINÇÃO DO PROCESSO (ARTS. 312 A 317) | 34-34 | NOT_STARTED |
| Direito Processual Civil | PROCEDIMENTO COMUM — parte 1/2 | 35-42 | NOT_STARTED |
| Direito Processual Civil | PROCEDIMENTO COMUM — parte 2/2 | 43-47 | NOT_STARTED |
| Direito Processual Civil | CUMPRIMENTO DA SENTENÇA (ARTS. 513 A 538) | 48-51 | NOT_STARTED |
| Direito Processual Civil | DO PROCESSO DE EXECUÇÃO | 52-54 | NOT_STARTED |
| Direito Processual Civil | MEIOS DE IMPUGNAÇÃO DAS DECISÕES JUDICIAIS | 55-59 | NOT_STARTED |
| Direito Processual Civil | DOS RECURSOS | 60-66 | NOT_STARTED |
| Direito Processual Civil | TABELA AUXILIAR DE PRAZOS — parte 1/2 | 67-71 | NOT_STARTED |
| Direito Processual Civil | TABELA AUXILIAR DE PRAZOS — parte 2/2 | 72-75 | NOT_STARTED |
| Direito Processual do Trabalho | ORGANIZAÇÃO DA JUSTIÇA DO TRABALHO | 3-5 | COMPLETED |
| Direito Processual do Trabalho | DO PROCESSO EM GERAL | 6-10 | COMPLETED |
| Direito Processual do Trabalho | DOS DISSÍDIOS INDIVIDUAIS | 11-14 | COMPLETED |
| Direito Processual do Trabalho | DA EXECUÇÃO | 15-16 | COMPLETED |
| Direito Processual do Trabalho | RECURSOS TRABALHISTAS | 17-19 | NOT_STARTED |
| Direito Processual do Trabalho | PRESCRIÇÃO NO DIREITO PROCESSUAL DO TRABALHO | 20-20 | COMPLETED |
| Direito Processual do Trabalho | JURISPRUDÊNCIAS — parte 1/2 | 21-28 | NOT_STARTED |
| Direito Processual do Trabalho | JURISPRUDÊNCIAS — parte 2/2 | 29-29 | NOT_STARTED |

---

## 3. Cobertura ponderada

Pesos por matéria, verificados no banco (não assumidos do comentário do schema): Direito Administrativo: 1.2 · Direito Constitucional: 1.2 · Direito do Trabalho: 2 · Direito Processual Civil: 1 · Direito Processual do Trabalho: 2.

**Os pesos NÃO são todos iguais** — 3 valores distintos entre os 81 tópicos do plano: 1.2, 1, 2. Isso contradiz o comentário do schema ("1.2 para as demais") — Direito do Trabalho e Direito Processual do Trabalho têm peso 2, Administrativo e Constitucional têm 1.2, Processual Civil tem 1. A cobertura por peso pondera essas diferenças; a cobertura por contagem, não.

Cobertura por contagem: 0/81 (0%).
Cobertura por peso: 0.0/112.4 (0.0%).

Como a cobertura hoje é 0% em ambos os critérios (mapeamento 0/89), os dois números coincidem em zero — a diferença entre os pesos só vai aparecer depois que o mapeamento existir.

---

## 4. Fora do plano

29 tópicos ficam fora do plano por decisão de 17/09/2026 — registrados aqui só para constar, não para detalhar:

- Direito Civil: 13 tópicos
- Língua Portuguesa: 16 tópicos
