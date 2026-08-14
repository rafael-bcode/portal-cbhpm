# Roadmap de Melhorias — Portal CBHPM

Baseado em pesquisa sobre CBHPM, TISS e sistemas de faturamento médico
(julho/2026). Compara o que existe no mercado/na norma oficial com o que o
portal já faz, e organiza o que falta em fases.

## Fase 1 — Correções e completude de dados ✅ Implementado

Achados originais da pesquisa de jul/2026 (percentuais de auxiliar
desatualizados pré/pós-2018, faltava a edição 2022 + reajuste de Out/2025,
instrumentador sem nota explicativa) — **confirmado resolvido em
14/08/2026**, na limpeza de higiene do roadmap:

1. Defaults de auxiliar já são dinâmicos por era da edição — a Consulta por
   procedimento sugere 30/20/20/20 até a edição 2017 e 60/40/30/30 a partir
   da CBHPM 2018, com nota explicativa e botão "restaurar a sugestão" caso o
   usuário ajuste manualmente.
2. **CBHPM 2022** (11ª Edição) está carregada, junto com os reajustes
   2020-2021, 2022-2023, 2023-2024 e **2025-2026** — este último já reflete
   a correção de Out/2025 (UCO = R$ 29,80, confirmado direto no banco).
3. Nota already on-screen: "Instrumentador e Auxiliar de Anestesista não são
   papéis definidos pela AMB/CBHPM — são taxas de convênio/hospital".

Não ficou registrado em qual commit cada item foi resolvido — o
importante é que a lacuna original não existe mais.

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

## Fase 5d — Detalhe por guia (abas) e busca por número ✅ Implementado

Ajuste de organização de tela pedido pelo usuário (ago/2026): a visão "Por
tipo de despesa (ANS)" misturava os lançamentos de todas as guias do
arquivo numa lista só. Agora:

- Cada card de guia é clicável e abre uma tela própria (modal) com **abas**
  — uma por grupo de despesa presente **naquela guia** (não do arquivo
  inteiro), mais Resumo (total, itens com valor divergente) e Profissionais.
- A visão "Por tipo de despesa (ANS)" no resultado geral virou um resumo
  (subtotal por grupo, todo o arquivo) — o detalhe item a item mora na tela
  de cada guia; a exportação CSV de tudo continua disponível ali.
- Campo de busca por número da guia (`numeroGuiaPrestador`) filtra a lista
  de cards em tempo real.

## Fase 6a/6b — Histórico local, múltiplos arquivos e comparação ✅ Implementado

Retomada do roadmap de fases futuras (ago/2026), em ordem de esforço crescente,
excluindo a consulta por CRM via CFM (pendente de credenciamento pago):

- **Histórico local de validações** (localStorage): guarda um resumo de cada
  arquivo já validado (nome, data, operadora, lote, total, status) — nunca o
  XML em si — para consulta rápida depois, sem sair do navegador.
- **Múltiplos arquivos + cross-check Unimed 0/2/5**: o campo de arquivo aceita
  vários XMLs de uma vez; quando detecta a convenção Unimed (arquivos do
  mesmo lote divididos por tipo 0/2/5), confere se todos são da mesma
  operadora e se o "lote-base" (número do lote sem o primeiro dígito) bate
  entre eles, além de somar o total de todos os arquivos carregados.
- **Comparação entre dois arquivos**: casa as guias de dois arquivos pelo
  número da guia (prestador) e mostra, por guia, o que mudou item a item
  (código, quantidade, valor) e a diferença de total — pensado para conferir
  um arquivo reenviado após glosa contra o original.
- **Correção de bug (profissionais da equipe)**: `extrairProfissionaisItemTiss`
  agora cobre as três formas usadas pelo XSD oficial para o profissional de
  um procedimento — `equipeSadt` (SP-SADT), `identEquipe > identificacaoEquipe`
  (Resumo de Internação) e `profissionais` (Honorário Individual) — e
  `analisarGuiaTiss` passou a ler também `procedimentosRealizados/
  procedimentoRealizado` e o campo flat `valorTotalHonorarios`, usados pelas
  guias `guiaHonorarios` (Honorário Individual dos credenciados — o arquivo
  "5" da convenção Unimed), que antes apareciam com itens e profissionais
  zerados mesmo tendo dados no XML. Confirmado diretamente no XSD oficial
  (`tissComplexTypesV4_03_00.xsd`, `tissGuiasV4_03_00.xsd`), não em suposição.

## Fase 6c — Validação estrutural contra o XSD oficial ✅ Implementado

Última fase pendente do roadmap anterior (excluindo a consulta por CRM via
CFM, que segue bloqueada por exigir credenciamento pago).

- **Fonte oficial**: "Componente de Comunicação" do Padrão TISS, baixado de
  gov.br/ans (ZIP com os XSDs) — `atualizar-tiss-xsd.js` baixa e extrai só os
  6 arquivos que a `mensagemTISS` v4.03.00 realmente usa (confirmado via
  `schemaLocation` dentro do próprio XSD): `tissV4_03_00.xsd` (raiz),
  `tissSimpleTypesV4_03_00.xsd`, `tissComplexTypesV4_03_00.xsd`,
  `tissGuiasV4_03_00.xsd`, `tissAssinaturaDigital_v1.01.xsd`,
  `xmldsig-core-schema.xsd` — em `public/tiss-xsd/`.
- **Motor de validação**: [xmllint-wasm](https://github.com/noppa/xmllint-wasm)
  (libxml2 real, compilado para WebAssembly), vendorizado em
  `public/vendor/xmllint-wasm/` (MIT, ver `LICENSE` ali) — carregado sob
  demanda via `import()` dinâmico só quando o usuário usa o validador
  (~1,1 MB entre WASM e os XSDs, não afeta o carregamento inicial da página).
  Testado e funcionando em Chromium, Firefox e WebKit via Playwright — a
  ressalva do próprio README sobre Firefox não suportar "worker modules"
  está desatualizada (Firefox já suporta desde a versão 114).
- **Verificação de que funciona de verdade** (não só "não deu erro"):
  validado contra ~15 arquivos reais do usuário (todos passam, como
  esperado) e contra XMLs sintéticos deliberadamente quebrados — removendo
  um elemento obrigatório (`registroANS`) e usando um valor de versão
  inválido — confirmando que o motor really detecta problemas estruturais
  reais, com mensagens de erro localizadas (elemento e o que era esperado).
- Complementa, não substitui, as checagens já existentes (hash, versão,
  códigos de tabela, valores por item) — é a camada mais rigorosa, mas
  valida contra a versão 4.03.00; arquivos de versões anteriores (ex:
  4.01.00) que já passaram nos testes reais sugerem boa compatibilidade
  retroativa, mas isso não é uma garantia formal da ANS.

## Achados rápidos (ago/2026)

Encontrados numa revisão completa do portal (estrutura, links, teste
funcional de cada aba com Playwright, screenshots mobile e desktop).

1. ~~Topbar quebra no mobile (< 400px)~~ — **✅ corrigido (v2.10.1,
   14/08/2026)**: testado em 390×844 (iPhone) com Playwright, antes e
   depois. O botão de alternar tema (🌙) ficava cortado na borda direita —
   `.topbar-inner` não tinha `flex-wrap` nem encolhia abaixo de ~420px.
   Adicionada media query (`max-width: 480px`) que reduz padding/gap/fonte
   do logo e do link "Página inicial" e permite quebrar em 2 linhas como
   último recurso. `scrollWidth` bateu com `clientWidth` (sem overflow) na
   reverificação. As abas (`.tabs`) já quebravam linha corretamente (tinham
   `flex-wrap: wrap`) — não precisaram de ajuste.
2. ~~Home desatualizada~~ — **✅ já corrigido antes desta revisão**: o card
   de contagem e a copy da home (`public/home.html`) já puxam
   `funcionalidades.json` dinamicamente em vez de um número fixo; hoje
   mostra as 16 ferramentas atuais, Validador SUS incluído.

## Fase 7 — Próximas melhorias ✅ Implementado (14/08/2026)

Levantamento feito na revisão completa de 14/08/2026 (dois itens já tinham
saído da lista antes mesmo de começar — Checklist pré-envio unificado e
CNES standalone, implementados sem o roadmap ser atualizado; ver Fase 7
anterior / CHANGELOG v2.5.0 e v2.6.0–2.9.0). Dos 6 itens restantes, **1 já
estava pronto** (achado ao testar) e os outros 5 foram implementados nesta
mesma sessão, todos verificados com Playwright antes de subir. Mesma linha
de sempre mantida: nada de login, persistência de paciente/guia no
servidor, ou geração/envio de guia oficial.

- ~~Comparador de edições CBHPM lado a lado~~ — **✅ já existia**
  (grade de cards por edição + gráfico de barras "Comparativo entre
  edições selecionadas"), mas estava **completamente quebrado** por um bug
  achado durante esta revisão — ver "Achado crítico" abaixo. Nenhum código
  novo necessário além do bug fix.
- ~~PDF do Validador SUS~~ — **✅ já existia**: botão "🖨 Gerar PDF de
  conferência" funcionando nas três abas (BPA, AIH, APAC), testado de
  ponta a ponta com arquivos reais (`PA513088.JUL.txt`, `SUS.TXT`,
  `AP513088.JAN`).
- ~~Simulador reverso de glosa~~ — **✅ implementado**: seção "Não sabe por
  onde começar?" no topo da aba Verificadores, 10 sintomas comuns ("rejeitado
  por incompatibilidade", "CID incompatível", "hash MD5 não confere" etc.)
  cada um apontando pro verificador certo com um clique.
- ~~Alerta ativo de versão TISS vencida~~ — **✅ implementado**: o modal
  "Versões TISS" ganhou um seletor + botão "Verificar" — informa a versão
  do seu sistema e recebe o veredito na hora (hoje só a 4.03.00 é aceita).
- ~~Selo "atualizado em" + página `/fontes`~~ — **✅ implementado** como uma
  coisa só: nova aba "Fontes" (`index.html?tab=fontes`, linkada no rodapé
  da home) lista as 5 bases com atualização automática (com badge ao vivo,
  reaproveitando os endpoints `/status` que já existiam) e as 7 bases de
  importação manual (CBHPM, CID-10, TUSS, CBO, Tabelas de Domínio TISS,
  XSD oficial, dicionário de glosas), cada uma com fonte oficial linkada e
  data do último import.
- ~~PWA leve~~ — **✅ implementado**: `manifest.json` + `sw.js` (service
  worker) cacheando só o app shell estático (HTML/CSS/JS/logo) — nunca
  `/api/*` nem requisições não-GET. Testado com Playwright simulando
  offline total: o shell continua abrindo (título e HTML completos); os
  widgets que dependem de dado ao vivo falham graciosamente, como
  esperado.

### ⚠️ Achado crítico (não estava no roadmap): Consulta por procedimento quebrada em produção há 2 dias

Ao testar o comparador de edições, a consulta principal (`/index.html`,
aba "Consulta por procedimento" — a funcionalidade mais usada do portal)
não retornava nenhum resultado: ficava travada em "Consultando…" para
sempre, sem nenhum erro visível no console. Investigação (Playwright +
interceptação de `fetch`) revelou a causa: **duas funções JavaScript com o
mesmo nome**, `renderizarResultado` — uma para a Consulta por procedimento
(`public/app.js`, escopo global) e outra, sem relação, para o comparador
de Indicadores ANAHP (declarada dentro de um bloco `if`, adicionada em
12/08/2026 pelo commit `dd3ebb9`). Em modo non-strict, navegadores aplicam
a semântica legada "Annex B" — uma function declaration dentro de um bloco
também vaza pro escopo da função/global — e como o bloco dos Indicadores
ANAHP executa antes da declaração de topo (mais adiante no arquivo) rodar
sua vez, `window.renderizarResultado` ficava permanentemente sobrescrita
pela versão errada (4 parâmetros em vez de 2). O fetch respondia
normalmente (200, JSON válido) mas o resultado ia parar em variáveis
`undefined`/`NaN` sem lançar exceção — daí não aparecer nenhum erro.

**Corrigido**: a função dos Indicadores ANAHP foi renomeada pra
`renderizarComparacaoIndicador` (não colide mais). Confirmado com
Playwright: `window.renderizarResultado.length` volta a ser `2` (a função
certa) e a consulta de um procedimento em todas as 21 edições renderiza
normalmente — grade de cards + gráfico comparativo.

**Impacto**: qualquer usuário que tentou consultar um procedimento entre
12/08/2026 (quando o bug foi introduzido) e 14/08/2026 (quando foi
corrigido) não recebeu nenhum resultado, sem mensagem de erro clara —
provavelmente pareceu que o portal "não funcionava". Prioridade de deploy
imediato assim que essa versão for publicada.

## Fase 8 — Compatibilidade procedimento×CID ✅ Implementado

Fecha a lacuna que o Checklist pré-envio deixava explicitamente de fora
(ver Fase 5d/6a) por falta da tabela oficial (v2.10.0, ago/2026):

- Tabela `sigtap_procedimento_cid` (82 mil pares), importada de
  `rl_procedimento_cid` da Tabela Unificada DATASUS, reimportada junto com
  o resto a cada atualização da SIGTAP.
- Checklist pré-envio: campo opcional de CID da guia, checado contra cada
  código SIGTAP informado.
- Consulta SIGTAP: cada card de procedimento mostra os CIDs permitidos
  (só o código, principal em negrito, expansível acima de 8 itens;
  descrição continua na aba CID-10 dedicada). Ausência de CID vinculado
  (42% dos procedimentos, sobretudo consultas gerais) é mostrada
  explicitamente como "sem restrição registrada", não omitida.

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
| 5d. Detalhe por guia (abas) e busca por número | ✅ Feito | Baixo–médio | Alto | Não |
| 6a. Histórico local, múltiplos arquivos (Unimed 0/2/5) e comparação | ✅ Feito | Médio | Alto | Não |
| 6c. Validação estrutural contra o XSD oficial | ✅ Feito | Alto | Alto | Não |
| 7. Comparador de edições, PDF do Validador SUS, glosa reversa, alerta de versão, transparência de dados, PWA | ✅ Feito | Médio | Alto | Não |
| 8. Compatibilidade procedimento×CID (Checklist + consulta SIGTAP) | ✅ Feito | Médio | Alto | Não |
| 9. Overflow mobile do topbar (achado #1) | ✅ Feito | Baixo | Médio | Não |
| — Hotfix: Consulta por procedimento quebrada (bug de 2 dias em produção) | ✅ Corrigido | Baixo | Crítico | Não |

## Cadência de release

**A partir de 14/08/2026, toda sexta-feira sai uma atualização** — revisão
do que foi construído/corrigido na semana, seguida de deploy. Esta é a
primeira: fecha o roadmap até a Fase 9 inteira (incluindo o hotfix crítico
acima) numa tacada só.

**Sem cota fixa de itens por semana** (decisão de 14/08/2026, ao discutir
o formato com o usuário): a sexta libera o que estiver **pronto e
testado** naquela semana — não um número mínimo nem máximo. Forçar uma
contagem fixa pressiona a cortar teste pra bater a meta; o jeito seguro de
"sempre ter algo novo" é manter o backlog (seção "Candidatos" abaixo)
sempre abastecido, não empurrar item sem verificação pra caber numa cota.

**"Em breve" no portal**: o modal de versão (ícone de versão no rodapé)
agora tem uma seção "Em breve" com o que está sendo avaliado, deliberada­
mente vaga — sem data, sem prazo, sem promessa de que vai sair numa sexta
específica (ver `proximosPassos` em `server.js`). Objetivo é mostrar que o
portal está em desenvolvimento ativo sem criar expectativa de entrega que
pode não se confirmar. Atualizar essa lista só com itens realmente em
avaliação — lista vazia é melhor que item furado (o array já suporta
ficar vazio, a seção some da tela nesse caso).

### Mapeamento pra próxima sexta (21/08/2026) — feito em 14/08/2026

Os dois itens da pauta inicial já foram resolvidos na própria sessão de
mapeamento:

1. ~~Higiene do roadmap~~ — ✅ feito: a seção "Achados críticos" e a Fase 1
   antiga foram reescritas (ver Fase 1 no topo deste documento).
2. ~~Nova rodada de revisão completa~~ — ✅ feita: testado de ponta a ponta
   com dado real (Playwright) — Validador de XML TISS (arquivo real),
   Múltiplos procedimentos (cálculo completo), Checklist pré-envio com CID,
   busca em CMED/Operadoras ANS/CNES/OPME/SIGTAP/CID-10, Indicadores ANAHP
   (confirma que a correção do bug crítico não quebrou o comparador de
   indicadores, que usa a função renomeada). **Nada mais quebrado
   encontrado** — o portal está estável depois do hotfix de hoje.
   - Melhoria de organização feita no caminho (pedido do usuário ao ver o
     resultado): a seção "Não sabe por onde começar?" (simulador reverso de
     glosa) saiu do topo da aba Verificadores — onde competia por espaço
     com as ferramentas de verdade — e virou a subaba padrão "Rejeição /
     Validação de arquivos" em Dúvidas frequentes, que é o lugar natural
     pra "não sei o que fazer". Os itens que apontavam "mais abaixo nesta
     aba" viraram links reais pra aba Verificadores.

### Candidatos levantados pra 21/08/2026

Item pedido diretamente pelo usuário (14/08/2026) — **prioridade máxima
pra próxima sexta**, já bem especificado, pronto pra entrar direto na
implementação sem mais definição de escopo:

- **Tópicos em lista nas Dúvidas frequentes, quando a resposta troca de
  assunto no meio**: hoje várias respostas do FAQ misturam 2+ sub-temas
  no mesmo parágrafo corrido (ex: a pergunta "Qual a diferença entre
  pacote fechado e conta aberta?" define os dois termos em prosa
  contínua). Trocar por lista com marcador, cada item com o termo em
  negrito seguido de ":", ex:
  ```
  - Pacote fechado: um valor fixo é negociado pra um procedimento
    inteiro (...) — o prestador é quem gerencia o uso de materiais e
    serviços dentro desse valor, sem detalhar item a item na cobrança
    (exceto imprevistos/urgência, que costumam ficar de fora do pacote).
  - Conta aberta: cada item usado — material, medicamento, taxa, diária
    — é cobrado separadamente, conforme o combinado em contrato.
  ```
  Aplica-se a **todas** as perguntas do FAQ com esse padrão (troca de
  assunto/termo no meio da resposta), em todas as subabas — não só o
  exemplo da pergunta acima. Precisa de um levantamento primeiro (quais
  respostas têm esse padrão, em quais subabas) antes de reformatar.

- **Sub-abas dentro de "Rejeição / Validação de arquivos" (Dúvidas
  frequentes), separando SUS de ANS/TISS**: pedido do usuário (14/08/2026)
  ao ver a subaba já implementada — hoje os 10 itens ficam numa lista só,
  misturando sintomas de faturamento SUS (BPA/AIH/APAC) com os de
  operadoras/TISS (hash MD5, versão do Padrão, habilitação, CID etc.).
  Quem trabalha só com um dos dois lados vê itens irrelevantes junto dos
  relevantes. Proposta: 2 sub-abas dentro da própria subaba (SUS de um
  lado, ANS/TISS do outro) — quem usa as duas frentes continua vendo as
  duas, só que separadas por tipo de faturamento em vez de misturadas.
  Precisa decidir: nova sub-navegação aninhada (sub-aba dentro de subaba,
  ainda sem precedente na UI atual) ou reagrupar os itens com um
  cabeçalho de seção sem criar clique extra — avaliar as duas antes de
  implementar.

- **Novo item de FAQ: "O que é OCI (Oferta de Cuidado Integrado)?"**: pedido
  do usuário (14/08/2026) — confirmado que o portal **ainda não tem nada**
  sobre OCI (nem FAQ, nem explicação), mas os **códigos de procedimento OCI
  já estão indexados** na busca SIGTAP (ex.: "OCI AVALIAÇÃO DIAGNÓSTICA
  INICIAL DE CÂNCER DE MAMA", achado em `sigtap_procedimentos.json`).
  Rascunho de resposta pra subaba de Dúvidas frequentes (SUS):
  - **O que é**: conjunto padronizado de procedimentos (consultas, exames e
    tecnologias) organizado pra concluir uma etapa de cuidado dentro de uma
    linha de cuidado específica — em vez do paciente agendar cada exame
    separadamente, o encaminhamento é pra um pacote completo, com prazo
    máximo de conclusão (geralmente 60 dias, 30 pra casos oncológicos).
  - **Onde se encaixa**: parte do Programa Mais Acesso a Especialistas
    (PMAE), instituído pela Portaria GM/MS nº 7.273/2025 (base legal:
    Portaria 1.604/2023, que criou a Política Nacional de Atenção
    Especializada — PNAES).
  - **Como fatura**: procedimento OCI é do tipo ambulatorial, financiamento
    FAEC, registrado em **APAC única** (sem APAC de continuação, prazo
    máximo de 2 competências) no SIA/SUS. Cada OCI principal tem
    procedimentos secundários compatíveis/obrigatórios pré-definidos pela
    própria tabela SIGTAP.
  - Áreas já cobertas: oncologia (mama, próstata, colo do útero, gástrico,
    colorretal), oftalmologia, cardiologia, ortopedia, otorrino, entre
    outras.
  - Sem decisão de escopo pendente — é só redigir o item e publicar na
    subaba SUS do FAQ.

- **Achado relacionado (a partir da pesquisa de OCI): tabela de
  compatibilidade entre procedimentos já disponível localmente**: o usuário
  mostrou o portal oficial de "Compatibilidades" do SIGTAP
  (`sigtap.datasus.gov.br`), que lista pra cada OCI principal os
  procedimentos secundários compatíveis/obrigatórios (com tipo e
  quantidade permitida). O arquivo bruto equivalente,
  `rl_procedimento_compativel.txt`, **já está no zip da Tabela Unificada
  baixado** (`TabelaUnificada_202607_v2607101010.zip`, 452 KB, formato de
  colunas fixas: procedimento principal + registro, procedimento
  compatível + registro, tipo de compatibilidade, quantidade permitida,
  competência — layout em `rl_procedimento_compativel_layout.txt`). É o
  mesmo padrão de arquivo/importação já usado pro recurso de CID
  (`rl_procedimento_cid.txt` → tabela `sigtap_procedimento_cid`), então dá
  pra seguir o mesmo caminho: nova tabela
  `sigtap_procedimento_compativel`, importador em `sigtap-atualizador.js`,
  endpoint novo ou extensão do `/api/sigtap/buscar`. Não é sobre OCI
  especificamente (a tabela cobre compatibilidade entre procedimentos SUS
  em geral), mas é o dado que mais importa pra quem fatura OCI — vale
  avaliar como candidato de feature (não só FAQ) numa rodada futura, sem
  compromisso de data ainda.

Demais candidatos (sem prioridade definida, a rodada de revisão de hoje
não achou mais nada quebrado):

- **Passada mobile completa**: só o overflow do topbar foi corrigido até
  agora (achado #1). Não foi testado em viewport estreito se a grade de
  edições da Consulta por procedimento, os cards do SUS/SIGTAP, as tabelas
  do Validador de XML TISS e o gráfico comparativo continuam legíveis/
  utilizáveis abaixo de ~480px.
- **Verificar se existe edição da CBHPM mais recente que 2025-2026**: a
  AMB publica reajustes por INPC periodicamente (foi assim que a
  2025-2026 apareceu) — vale checar se já saiu uma correção mais nova
  antes da próxima competência trocar.
- **Passada de acessibilidade**: não avaliado ainda — navegação por
  teclado, leitor de tela, contraste, `aria-live` nas áreas de resultado
  que atualizam via fetch (relevante pra quem usa o portal com o modo
  escuro/leitor de tela dentro do hospital).
- Os itens que já estavam na "Transparência de dados" original mas não
  entraram no escopo desta semana continuam válidos como ideia menor: por
  exemplo, expor a data de "última revisão" do dicionário de glosas
  diretamente na aba onde ele é usado (Validador de XML TISS), não só na
  aba Fontes.

Sem item de peso maior definido — para decidir com o usuário na sexta.

## Observação (não é candidato ainda): Carteira de Identidade Nacional (CIN)

Pesquisa feita a pedido do usuário (14/08/2026) — **não é item de "Em
breve"**, é só monitoramento, porque ainda não há nada concreto pra
construir.

**O que é**: novo documento nacional que substitui o RG, ancorado no CPF
como identificador único (com biometria — digital + foto facial). Meta do
governo: 150 milhões de carteiras emitidas até o fim do mandato atual
(hoje ~15 milhões emitidas). RG antigo continua válido até **28/02/2032**;
obrigatoriedade biométrica plena do INSS só em jan/2028 — transição longa,
não uma virada abrupta.

**Na saúde**:
- CPF está virando identificador único do SUS, substituindo o número do
  CNS como chave principal (Lei nº 14.534/2023, mesmo movimento que atinge
  CadÚnico e eSocial).
- Desde mai/2026, acesso a prontuário eletrônico em capitais passou a
  exigir validação por QR Code da CIN.
- ANS (RN 295, art. 26) já exige envio do número do CNS junto aos dados de
  beneficiários pelas operadoras.
- **Não encontrado**: nenhum campo de CIN ou CPF-como-identificador-de-
  beneficiário no Padrão TISS até a versão vigente (4.03.00, jul/2026) —
  essa versão trouxe CNPJ alfanumérico e nome social, nada de CIN/CPF novo
  pro beneficiário.

**Por que não vira candidato agora**: não há base pública de CIN pra
consultar (diferente de CNPJ via BrasilAPI, já usado no portal), e é dado
de identificação de paciente — foge do princípio que o portal já segue
(nada de dado de paciente persistido/consultado). Não tem o que construir
ainda.

**O que observar pra virar candidato de verdade**: se uma versão futura do
Padrão TISS adicionar um campo de CPF/CIN como identificador de
beneficiário na guia — aí sim o Validador de XML TISS precisa reconhecer/
validar esse campo. Vale checar o changelog do Padrão TISS (ANS) nas
próximas rodadas de revisão.

Fontes: [Gazeta do Povo — Nova Carteira de Identidade (CIN)](https://www.gazetadopovo.com.br/brasil/cin-obrigatoria-saiba-como-emitir-e-o-que-muda-na-sua-identificacao/), [Alerta Gov — cronograma de transição CIN até 2032](https://alertagov.com.br/2026/04/ate-2032-todos-os-brasileiros-deverao-possuir-a-cin-veja-o-cronograma-de-transicao/), [Correio do Pantanal — CPF substitui número do Cartão SUS](https://correiodopantanal.com.br/cpf-substitui-numero-do-cartao-sus-e-passa-a-ser-identificador-unico-dos-usuarios-da-saude-publica/), [ANS — Cartão Nacional de Saúde](https://www.ans.gov.br/index.php/a-ans/sala-de-noticias-ans/consumidor/1819-cartao-nacional-de-saude-uma-realidade-para-todos-os-brasileiros), [M3BS Advogados — ANS divulga nova versão do Padrão TISS (jan/2026)](https://m3bs.com.br/ans-divulga-nova-versao-do-padrao-tiss-janeiro-2026/), [Padrão TISS — Julho/2026 (gov.br/ans)](https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-julho-2026)
