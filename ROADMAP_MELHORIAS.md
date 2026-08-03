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

## Fase 3 — Presets de convênio ✅ Implementado (escopo reduzido)

**Decisão do usuário (ago/2026):** não um cadastro persistido de contratos
por procedimento/operadora — apenas um atalho de UI. O usuário salva os
percentuais de ajuste (Porte, UCO, Porte Anestésico, Filme, equipe) com um
nome de convênio no `localStorage` do navegador e reaplica com um clique,
tanto na consulta única quanto em múltiplos procedimentos. Sem cadastro
persistido no banco, sem login, sem variação por procedimento — se essa
granularidade for necessária no futuro, é um novo escopo (tabela
`convenios`/`contratos_convenio`, versionada no tempo).

## Fase 4 — Exportar / persistir simulações ✅ Implementado

- **Favoritos**: procedimentos consultados podem ser marcados como favorito
  (salvos no `localStorage`, sem login) e aparecem como chips de acesso
  rápido acima da busca.
- **Exportar PDF**: botão que aciona a impressão do navegador com um layout
  limpo (sem menu/formulários), tanto na consulta por procedimento quanto na
  sessão de múltiplos procedimentos.
- **Exportar Excel/CSV**: baixa os valores em `.csv` (separador `;`, decimal
  `,`, compatível com Excel pt-BR).

## Fase 5 — TISS / faturamento — ✅ Implementado (guia simulada, não oficial)

**Decisão do usuário (ago/2026):** não a geração de XML compatível com o
schema oficial da ANS (exigiria dados de credenciamento — CNES, registro
ANS do prestador/operadora — que o portal não coleta, e normalmente login
multiusuário). Em vez disso, um botão "🧾 Guia/Fatura" na consulta única e
em múltiplos procedimentos que reaproveita o cálculo já feito e monta um
documento de impressão (paciente, convênio, data, prestador + itens
cirurgião/anestesista/equipe + total), com aviso explícito de que **não é**
um XML TISS oficial nem é enviado a nenhuma operadora.

Mapeamento CBHPM ↔ TUSS já existe (tabela `mapeamento_amb_tuss`). Painel de
glosas e geração de XML real seguem fora de escopo — exigiriam dados de
credenciamento reais e provavelmente autenticação multiusuário, que não
foram pedidos.

Atualização (ago/2026): a ANS publicou o Ofício-Circular nº 1/2026 com a
versão do Padrão TISS de janeiro/2026, obrigatória a partir de 01/07/2026
(mudanças principalmente em terminologia de Materiais/OPME, medicamentos e
mensagens de glosa) — é a versão de referência caso a geração de XML
oficial seja implementada no futuro.

Fontes: [TISS — ANS](https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss), [Faturamento médico — ProDoctor](https://prodoctor.net/blog/faturamento-medico/), [Controle de glosas — Medicalsys](https://www.medicalsys.com.br/blog/controle-de-glosas-como-evitar-perdas-financeiras-e-aumentar-a-rentabilidade-da-sua-cl%C3%ADnica)

## Fase 5b — Validador de XML TISS ✅ Implementado

Nova aba "Validador de XML TISS" (ago/2026), inspirada no
[validadortiss.com.br](https://app.validadortiss.com.br/#/) mas rodando
inteiramente no navegador — o arquivo nunca é enviado a um servidor.
Verifica:

- **Hash MD5** do epílogo — algoritmo confirmado com o manual oficial da
  ANS (Componente Organizacional, item 115: MD5 sobre a concatenação
  literal do conteúdo das tags-folha, em ISO-8859-1) e testado contra
  hashes reais de arquivos de produção, inclusive com acentuação (o que
  descartou a alegação de um repositório de terceiro de que o encoding
  correto seria UTF-8 — não é, é ISO-8859-1 mesmo, como diz o manual).
- **Versão do Padrão** (`<ans:Padrao>`) — alerta se for anterior a 4.03.00,
  obrigatória desde 01/07/2026 (Ofício-Circular nº 6/2025/COEST/GPIND/
  DIRAD-DIDES/DIDES).
- **Tipos de guia** encontrados no lote (guiaSP-SADT, guiaConsulta,
  guiaResumoInternacao etc.).
- **Códigos de tabela** (`codigoTabela`) contra o domínio oficial (00, 18,
  19, 20, 22, 90, 98).
- **Valores por item**: quantidade × valor unitário × redução/acréscimo
  confere com o valor total do item.
- **Total da guia**: soma dos componentes (`valorProcedimentos` +
  `valorDiarias` + ... ) e soma dos itens conferem com `valorTotalGeral`.
- **Operadora de destino**, a partir do registro ANS, usando a mesma base
  de dados abertos da ANS já usada no Fase 3 (`operadoras-ans.json`).
- **Convenção de nomenclatura de algumas cooperativas Unimed**: o primeiro
  dígito do nome do arquivo (0 = resumo de internação/médicos não
  credenciados, 2 = SP-SADT credenciados, 5 = honorário individual
  credenciados) deve bater com o primeiro dígito de `<ans:numeroLote>` —
  só é checado quando a operadora de destino é uma Unimed.

**Não é** um validador oficial certificado pela ANS — não valida contra o
schema XSD completo nem substitui a homologação da operadora.

## Fase 5c — Grupos de despesa, profissionais e CNPJ ✅ Implementado

Extensão do validador (ago/2026), a partir de dados oficiais fornecidos
pelo usuário e pesquisa complementar:

- **Por tipo de despesa (ANS)**: todos os lançamentos do arquivo
  (procedimentos, consultas, outrasDespesas) organizados pelos grupos
  oficiais da Tabela de Domínio "Tipo de Despesa" (`codigoDespesa`):
  Material, Medicamento, Gases Medicinais, Taxas Diversas, Diárias,
  Aluguéis, OPME, Medicamentos de Alto Custo, Outros — mais "Procedimentos
  (honorários)" e "Consultas" para itens que não usam `codigoDespesa`. Data,
  código, descrição, quantidade e valor de cada lançamento, com subtotal
  por grupo e exportação em CSV.
- **Profissionais por guia**: nome, CRM (conselho + número + UF, via
  Tabela de Domínio 26 "Conselho Profissional"), CBO com a especialidade
  médica (via CSV oficial do CBO, Ministério do Trabalho e Emprego,
  filtrado à família 225 — médicos) e função (via Tabela de Domínio 35
  "Grau de Participação" — cirurgião, auxiliar, anestesista, clínico etc.).
- **Busca opcional de CNPJ** (botão, não automático): traz razão social,
  nome fantasia e situação cadastral via [BrasilAPI](https://brasilapi.com.br)
  — CORS aberto confirmado, gratuita, sem cadastro. É a única parte do
  validador que se comunica com um serviço externo, e só quando o usuário
  pede (envia apenas o CNPJ do prestador, não dados do paciente).

**Pesquisado e descartado por ora**: consulta automática do nome do médico
a partir do CRM via CFM. Não existe API pública sem credenciamento — o
Conselho Federal de Medicina exige acesso formal (Resolução CFM nº
2.129/15) via chave concedida a empresas/instituições cadastradas; opções
de terceiros (Infosimples, Consultar.IO) são pagas. Se o usuário obtiver
essa credencial (própria ou de terceiro pago), o caminho correto é um
endpoint no servidor (`/api/consultar-crm`) guardando a chave como variável
de ambiente — nunca embutida no navegador.

Fontes: [Tabelas de Domínio do Padrão TISS — v3.02.00](https://fiosaude.org.br/wp-content/uploads/2020/04/TabelaDominioANS.pdf) (Tabela 26 — Conselho Profissional, Tabela 35 — Grau de Participação), [CBO — downloads oficiais (MTE)](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads), [BrasilAPI — CNPJ](https://brasilapi.com.br/api/cnpj/v1/), [CFM — Web Service de Listagem de Médicos](https://sistemas.cfm.org.br/listamedicos/informacoes) (exige credenciamento)

## Resumo executivo

| Fase | Status | Esforço | Valor | Depende de dado pago? |
|---|---|---|---|---|
| 1. Correções de auxiliar + dados 2018/2022/2025 | ✅ Feito | Baixo–médio | Alto | Sim (CBHPM 2022 é paga — já adquirida) |
| 2. Vias de acesso | ✅ Feito | Médio | Alto | Não |
| 3. Presets de convênio (escopo reduzido) | ✅ Feito | Baixo | Médio | Não |
| 4. Exportar/persistir | ✅ Feito | Baixo | Médio | Não |
| 5. Guia/fatura simulada (escopo reduzido) | ✅ Feito | Médio | Alto (dentro do escopo reduzido) | Não |
| 5b. Validador de XML TISS | ✅ Feito | Alto | Alto | Não |
| 5c. Grupos de despesa, profissionais e CNPJ | ✅ Feito | Médio | Alto | Não |
