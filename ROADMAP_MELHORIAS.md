# Roadmap de Melhorias — Portal CBHPM

Baseado em pesquisa sobre CBHPM, TISS e sistemas de faturamento médico
(julho/2026). Compara o que existe no mercado/na norma oficial com o que o
portal já faz, e organiza o que falta em fases.

## Achados críticos (corrigir primeiro)

### 1. Percentuais padrão da equipe estão desatualizados (pré-2018)

A CBHPM mudou os percentuais de auxiliar **a partir da edição 2018**:

| Papel | Antes de 2018 | A partir de 2018 |
|---|---|---|
| 1º Auxiliar | 30% | **60%** |
| 2º Auxiliar | 20% | **40%** |
| 3º/4º Auxiliar | 20% | **30%** |

Confirmamos empiricamente no banco que as edições 2004-2017 usam 30/20/20 —
portanto **nossos valores estão corretos para essas edições**. Mas o portal
usa os mesmos defaults (30/20/20/20/10/30) na tela para **qualquer** edição,
inclusive a 10ª Edição/2020, que já deveria seguir 60/40/30/30. Isso
subestima o valor do 1º e 2º auxiliar por padrão quando o usuário consulta
2018 em diante e não percebe que precisa trocar o percentual manualmente.

**Ação sugerida:** valores-padrão dinâmicos conforme a edição mais recente
selecionada (ou pelo menos um aviso na tela quando a edição for 2018+).

Fontes: [ACM — Aumento para auxiliares na CBHPM](https://www.acm.org.br/aprovado-o-aumento-para-os-auxiliares-cirurgicos-na-cbhpm/), [Auxiliares de Cirurgia — Portal do Faturamento Hospitalar](https://www.portaldofaturamentohospitalar.com/2023/05/auxiliares-de-cirurgia-e-o-percentual.html), [Honorários dos Auxiliares — Validador TISS](https://www.validadortiss.com.br/honorarios-auxiliares-cirurgia-regras-cobranca/)

### 2. Faltam edições recentes: 2022 (atual) e a correção de Out/2025

- A **edição 2022** é a atual/vigente da CBHPM — o portal vai só até 2020.
- Em **18/10/2025** a AMB publicou uma correção de Porte e UCO pelo INPC/IBGE
  (+5,10%), com a **UCO passando a valer R$ 29,80** (vigente até set/2026).
  Isso não é uma edição nova — é um reajuste sobre a 2022 aplicado por
  percentual, sem tabela nova completa.

**Ação sugerida:** importar a 2022 (comprada/adquirida na AMB — não é de
graça, ver abaixo) e criar um mecanismo de "reajuste anual" que aplica um
percentual sobre porte/UCO de uma edição-base em vez de exigir uma
planilha nova inteira toda vez que a AMB corrige por INPC.

Fontes: [SBPC/ML — CBHPM atualiza valores de portes e UCO](https://sbpc.org.br/pt/component/content/article/234-cbhpm-atualiza-valores-de-portes-e-da-uco), [Chegou a CBHPM 2022 — AMB](https://amb.org.br/chegou-a-cbhpm-2022/), [Adquirir CBHPM — AMB](https://amb.org.br/adquirir-cbhpm/)

### 3. Instrumentador não é um papel oficial da AMB/CBHPM

A CBHPM define oficialmente só 3 honorários médicos: cirurgião, auxiliar(es)
e anestesista. **Instrumentador é uma taxa de enfermagem/serviço**, não um
honorário médico — quando pago, é por convenção de operadora/hospital (ex.:
10% do porte, "porte anestésico 16 + 30%"), nunca por regra AMB. Nossa
arquitetura (percentual livre e configurável) já está certa — só falta
deixar isso explícito na tela, para o usuário não achar que é uma regra
CBHPM fixa.

Fonte: [Honorários dos Auxiliares — Validador TISS](https://www.validadortiss.com.br/honorarios-auxiliares-cirurgia-regras-cobranca/)

## Fase 1 — Correções e completude de dados (curto prazo)

1. Ajustar defaults de auxiliar por era da edição (30/20/20/20 pré-2018 vs
   60/40/30/30 pós-2018), ou pelo menos um aviso visível.
2. Adicionar nota na tela: "Instrumentador não é definido pela AMB/CBHPM —
   percentual livre por convênio."
3. Importar a **edição 2022** (adquirir na AMB) e o reajuste de Out/2025.
4. Mecanismo de "correção anual" (percentual sobre porte/UCO de uma edição
   base, sem precisar reimportar tudo).

## Fase 2 — Via de acesso / múltiplos procedimentos ✅ Implementado

Confirmamos os percentuais oficiais: quando há mais de um procedimento no
mesmo ato,
- **mesma via de acesso** → procedimento secundário vale **50%**
- **via diferente** → **70%**
- **equipes diferentes** → **100%** (integral)

Implementado na aba "Múltiplos procedimentos": todos os percentuais são
parametrizáveis (com o padrão oficial como sugestão), UCO/Filme ficam
integrais, o Porte Anestésico é cobrado uma única vez por sessão (maior
valor entre os procedimentos) e a Equipe incide sobre a soma dos portes já
ponderados pela via.

Fonte: [Cálculo Básico de Procedimentos Médicos — Oazez/CBHPM](https://www.cbhpm.com.br/wiki/index.php?title=C%C3%A1lculo_B%C3%A1sico_de_Procedimentos_M%C3%A9dicos)

## Fase 3 — Tabelas por convênio (deflator) — fora de escopo

**Decisão do usuário:** o portal não será usado para gestão por convênio —
é uma consulta geral, independente da operadora de saúde. Fase descartada.

## Fase 4 — Exportar / persistir simulações ✅ Implementado

- **Favoritos**: procedimentos consultados podem ser marcados como favorito
  (salvos no `localStorage`, sem login) e aparecem como chips de acesso
  rápido acima da busca.
- **Exportar PDF**: botão que aciona a impressão do navegador com um layout
  limpo (sem menu/formulários), tanto na consulta por procedimento quanto na
  sessão de múltiplos procedimentos.
- **Exportar Excel/CSV**: baixa os valores em `.csv` (separador `;`, decimal
  `,`, compatível com Excel pt-BR).

## Fase 5 — TISS / faturamento (escopo grande, avaliar se é objetivo do projeto)

Se a intenção for este portal virar uma ferramenta de faturamento de verdade
(não só consulta/simulação), os sistemas do mercado convergem em:

- Mapeamento CBHPM ↔ TUSS (código de procedimento/serviço padronizado ANS)
- Geração de guias TISS (com participantes por grau de participação:
  cirurgião, auxiliares, anestesista) e exportação em XML
- Painel de **glosas** (contestação/correção de valores recusados pela
  operadora) e conferência de prazos contratuais
- Múltiplos usuários/clínicas (autenticação, hoje o portal não tem login)

Isso é um salto de escopo grande — de "calculadora/comparador de tabela"
para "sistema de faturamento". Vale confirmar se é essa a ambição antes de
entrar aqui.

Fontes: [TISS — ANS](https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss), [Faturamento médico — ProDoctor](https://prodoctor.net/blog/faturamento-medico/), [Controle de glosas — Medicalsys](https://www.medicalsys.com.br/blog/controle-de-glosas-como-evitar-perdas-financeiras-e-aumentar-a-rentabilidade-da-sua-cl%C3%ADnica)

## Resumo executivo

| Fase | Status | Esforço | Valor | Depende de dado pago? |
|---|---|---|---|---|
| 1. Correções de auxiliar + dados 2022/2025 | Parcial (auxiliar ✅, dados 2022/2025 pendente) | Baixo–médio | Alto | Sim (CBHPM 2022 é paga) |
| 2. Vias de acesso | ✅ Feito | Médio | Alto | Não |
| 3. Convênios/deflator | ❌ Fora de escopo | — | — | — |
| 4. Exportar/persistir | ✅ Feito | Baixo | Médio | Não |
| 5. TISS/faturamento | Não iniciado | Alto | Alto, mas é outro produto | Não, mas exige TUSS |
