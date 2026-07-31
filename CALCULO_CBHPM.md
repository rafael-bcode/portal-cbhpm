# Motor de Cálculo de Procedimentos CBHPM — Documento Técnico

Referência para o cálculo dos valores de procedimentos da tabela CBHPM neste
projeto. Cada operadora pode aplicar seus próprios deflatores/regras
comerciais, mas a estrutura da CBHPM é a descrita abaixo.

## Objetivo

Calcular corretamente os honorários médicos (cirurgião), anestesia,
auxiliares, UCO, filme e demais componentes, respeitando as regras da
AMB/CBHPM — sem misturar honorários de profissionais diferentes num único
total.

## 1. Estrutura do cadastro do procedimento

| Campo | Obrigatório | Exemplo |
|---|---|---|
| Código CBHPM | Sim | 31309054 |
| Descrição | Sim | Colecistectomia |
| Porte | Sim | 8C |
| Porte Anestésico | Sim | 5 |
| Quantidade UCO | Sim | 12,350 |
| Filme | Sim | 0 |
| Permite Auxiliar | Sim | Sim |
| Quantidade máxima de auxiliares | Sim | 2 |
| Via de acesso | Opcional | Aberta / Vídeo |
| Técnica | Opcional | Convencional |

## 2. Componentes financeiros do procedimento

O cálculo é dividido em componentes **independentes**.

### 2.1 Porte médico (honorário do cirurgião principal)

```
Valor Porte = Valor Financeiro do Porte × Peso do Porte × Deflator do Convênio
```

Exemplo: porte 8C, valor financeiro R$ 1.250,00, deflator 90% →
`1.250 × 0,90 = R$ 1.125,00`. Este valor **compõe** o valor do procedimento.

### 2.2 UCO (quando houver)

```
Total UCO = Quantidade UCO × Valor da UCO negociado
```

Exemplo: UCO 25,50 × R$ 18,00 = R$ 459,00. **Compõe** o valor do procedimento.

### 2.3 Filme (quando houver)

Valor informado na tabela/negociação. **Compõe** o valor do procedimento.

## 3. Porte anestésico

**Não faz parte do valor do procedimento.** Representa exclusivamente os
honorários do anestesiologista e é calculado separadamente.

Exemplo — procedimento 31309054, porte 8C (R$ 1.200), porte anestésico 5
(R$ 650):

| Item | Valor |
|---|---|
| Valor do procedimento | R$ 1.200 |
| Honorário anestesista | R$ 650 |
| Total financeiro da guia | R$ 1.850 |

O valor do procedimento **permanece R$ 1.200**; a anestesia pertence ao
participante "Anestesista" (grau de participação TISS 6/7, conforme
configuração da operadora).

## 4. Auxiliares

**Não alteram o valor do procedimento.** Recebem uma fração/percentual do
porte do procedimento principal, conforme o grau de participação (1º
auxiliar, 2º auxiliar etc.) e o contrato da operadora.

Exemplo — porte principal R$ 1.000, 1º auxiliar 30% → R$ 300, 2º auxiliar
20% → R$ 200:

| Papel | Valor |
|---|---|
| Procedimento (principal) | R$ 1.000 |
| Auxiliar 1 | R$ 300 |
| Auxiliar 2 | R$ 200 |
| **Total pago pela operadora** | R$ 1.500 |

O valor do procedimento cadastrado **permanece R$ 1.000**.

## 5. Valor total do procedimento

```
Valor Procedimento = Porte + UCO + Filme + Valores adicionais parametrizados
```

**Nunca somar:** porte anestésico, auxiliares, instrumentador, perfusionista
— esses valores pertencem aos honorários individuais de cada participante.

## 6. Valor total da guia

```
Valor Guia = Valor Procedimento + Honorário Anestesista + Honorário Auxiliares
           + Honorário Instrumentador + Demais Participantes
```

Exemplo: procedimento R$ 1.200 + anestesista R$ 650 + auxiliar R$ 300 +
auxiliar R$ 200 = **Total guia R$ 2.350**.

## 7. Participantes (TISS)

Cada participante tem cálculo independente:

- **Cirurgião principal** — recebe o Porte
- **1º/2º/3º Auxiliar** — recebem percentual do Porte
- **Anestesista** — recebe o Porte Anestésico
- **Instrumentador** — percentual definido pelo convênio
- **Perfusionista** — percentual definido pelo convênio

## 8. Deflatores

O sistema deve permitir deflatores independentes para Porte, UCO, Filme,
Anestesia e Auxiliares — cada convênio pode negociar percentuais distintos.

## 9. Múltiplos procedimentos (mesma cirurgia)

- Determinar o procedimento principal.
- Aplicar 100% do porte ao principal.
- Aplicar redutores nos procedimentos secundários conforme contrato da
  operadora e regras da CBHPM (ex.: mesma via / via diferente).
- UCO normalmente permanece integral, salvo negociação contratual.
- Porte anestésico segue regras específicas de atos concomitantes.

> Ainda não implementado neste projeto — ver seção "Status neste projeto".

## 10. Algoritmo do motor de cálculo

```
Para cada procedimento:
  Calcular Porte, UCO, Filme
  ValorProcedimento = Porte + UCO + Filme + Outros

  Se possuir anestesia:
    Calcular Porte Anestésico
    Associar ao participante Anestesista (não somar ao procedimento)

  Para cada auxiliar:
    Calcular percentual do Porte
    Associar ao participante (não somar ao procedimento)

ValorFinalGuia = ValorProcedimento + Todos os Honorários Individuais
```

## 11. Regras obrigatórias

1. O porte anestésico nunca compõe o valor do procedimento.
2. O valor dos auxiliares nunca altera o valor do procedimento.
3. O porte do cirurgião principal representa apenas os honorários do
   executante principal.
4. O valor do procedimento é composto apenas pelos itens próprios do
   procedimento (porte, UCO, filme e demais componentes parametrizados).
5. Honorários de anestesista, auxiliares e demais participantes devem ser
   calculados e armazenados separadamente, vinculados ao respectivo grau de
   participação na guia TISS.

## Roadmap sugerido (motor completo)

1. **Motor de cálculo do procedimento** — porte, UCO, filme e adicionais.
2. **Motor de honorários médicos** — cirurgião, auxiliares, anestesista,
   instrumentador, perfusionista etc.
3. **Motor de múltiplos procedimentos** — principal, secundários, vias de
   acesso e redutores.
4. **Motor de regras por convênio** — deflatores, tabelas próprias, exceções.
5. **Motor de faturamento TISS** — geração de guias, participantes, XML e
   integração com operadoras.

## Status neste projeto

- ✅ Itens 1–5 (separação Porte+UCO+Filme vs. Anestesista vs. Auxiliares) —
  implementado no Portal CBHPM (`server.js` / `public/app.js`).
- ⏳ Item 9 (via diferente / mesma via / múltiplos procedimentos) — adiado,
  decisão registrada em conversa com o usuário para tratar depois.
- ⏳ Itens 4, 5 do roadmap (deflatores por convênio, faturamento TISS) — fora
  do escopo atual do portal (que é só consulta/simulação de valores, não
  faturamento).
