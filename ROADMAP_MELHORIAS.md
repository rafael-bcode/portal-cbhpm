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

### Fluxo das 3 sextas (oficializado em 26/08/2026)

Processo proposto pelo usuário em 26/08/2026 pra dar visibilidade de 3 sextas à
frente em vez de organizar tudo em cima da hora. Toda sexta-feira de release, três
ações rodam juntas, cada uma mirando uma semana diferente do calendário:

1. **Subir (deploy)** o que está programado no "Calendário planejado" pra **esta
   sexta** (a mais próxima) — **e atualizar `proximosPassos` em `server.js`** (a
   seção "Em breve" do modal de versão) no mesmo commit: remover os itens que
   acabaram de ir pro ar, e conferir se algum candidato com escopo já fechado pra
   uma sexta próxima (mesmo critério já usado pro CIHA — "não é Baixa prioridade,
   tem escopo fechado") ainda não está listado.
2. **Colocar em teste** o que está programado pra **daqui a 1 semana** (a próxima
   sexta) — só é possível pros itens que já estão com escopo fechado e código
   pronto pra essa etapa; segue o mesmo padrão já usado no pacote de 28/08
   (implementado e testado com uma semana de antecedência).
3. **Pesquisar novidade** sobre o que está programado pra **daqui a 2 semanas** (a
   sexta seguinte) — só relevante pra item que **já tem pesquisa-base registrada**
   no roadmap (ex.: assinatura digital, glosa estrutural, CIHA); pra candidato sem
   nenhuma pesquisa prévia, essa etapa vira "primeira pesquisa" em vez de
   "atualização", e normalmente já deveria ter sido feita antes de virar candidato.

**Exemplo de aplicação (sexta 28/08/2026)**:
1. Sobe o pacote já pronto de 28/08 (sub-abas SUS/ANS, passada mobile, data do
   dicionário de glosas, acessibilidade).
2. Coloca em teste o pacote de 04/09 (CIHA, DMED, Compatibilidade SIGTAP).
3. Pesquisa se surgiu algo novo sobre os itens de 11/09 (NOTIVISA, assinatura
   digital, CodeQL).

**Why:** o fluxo evita duas armadilhas já discutidas no roadmap — item chegando
sem teste numa sexta (pressão de calendário, ver "Sem cota fixa" acima) e pesquisa
desatualizada virando texto publicado sem checar se a norma mudou (ver o próprio
caso de assinatura digital, onde a versão de maio/2026 do TISS trouxe mudança
recente que só apareceu porque a pesquisa foi feita perto da implementação).
Formaliza como rotina o que já vinha acontecendo de forma pontual.

**Achado concreto que motivou incluir `proximosPassos` no passo 1 (26/08/2026)**:
numa checagem pedida pelo usuário, achei duas falhas na lista "Em breve" — o item
"Ajustes de exibição em telas menores" continuava listado mesmo depois da
investigação de 21/08/2026 ter concluído que **nenhuma correção era necessária**
(nada ia realmente mudar pro usuário quando 28/08 subisse), e DMED/Compatibilidade
SIGTAP (ambos com escopo fechado, agendados pra 04/09, mesmo critério já usado pro
CIHA) **não estavam** na lista — pura omissão. Corrigido nesta mesma sessão. Sem um
passo formal de "atualizar a lista ao subir", esse tipo de esquecimento tende a se
repetir a cada sexta.

**How to apply:**
- Ao preparar a pauta de qualquer sexta, verificar as três janelas (esta semana,
  +1 semana, +2 semanas) antes de decidir o que fazer no dia.
- Item sem escopo fechado não entra na etapa 2 (teste) mesmo que a data esteja
  próxima — só entra quando o escopo fechar, ainda que isso empurre a data.
- No passo 1 (subir), sempre revisar `proximosPassos`: remover o que acabou de ir
  pro ar, remover item cuja investigação concluiu "sem correção necessária" (não
  promete algo que não vai acontecer), e adicionar candidato novo com escopo
  fechado pra sexta próxima que ainda não esteja listado.
- Item sem pesquisa-base não entra na etapa 3 como "atualização" — some da lista
  até ter uma primeira pesquisa registrada como candidato.

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

Cada item abaixo leva uma tag de prioridade — **[Alta]** (bom valor,
baixo/médio esforço, sem decisão de escopo pendente — candidato natural
pra sexta que vem), **[Média]** (valor real, mas exige mais esforço ou
ainda tem decisão de design/escopo em aberto) ou **[Baixa]** (nice-to-have,
sem pedido direto ou precisa de investigação antes de virar candidato de
verdade). É julgamento meu, não do usuário — sirva de ponto de partida
pra decisão final na sexta, não de decisão fechada. **Prática
padrão a partir de agora**: todo novo item que entrar aqui já sai com
essa tag.

**Na sexta (21/08/2026)**: antes de começar a implementar, apresento um
resumo de tudo que foi pedido/registrado nesta semana — cada item com sua
tag de prioridade, esforço estimado e decisões de escopo ainda em aberto
— pra decidirmos juntos o que entra nessa liberação. Esta seção é a fonte
dessa apresentação; ela vai sendo atualizada em tempo real conforme
surgem novos pedidos ao longo da semana, não só na sexta.

Item pedido diretamente pelo usuário (14/08/2026) — **prioridade máxima
pra próxima sexta**, já bem especificado, pronto pra entrar direto na
implementação sem mais definição de escopo:

- **[Alta]** **Tópicos em lista nas Dúvidas frequentes, quando a resposta troca de
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

- **[Média]** **Sub-abas dentro de "Rejeição / Validação de arquivos" (Dúvidas
  frequentes), separando SUS de ANS/TISS**: pedido do usuário (14/08/2026)
  ao ver a subaba já implementada — hoje os 10 itens ficam numa lista só,
  misturando sintomas de faturamento SUS (BPA/AIH/APAC) com os de
  operadoras/TISS (hash MD5, versão do Padrão, habilitação, CID etc.).
  Quem trabalha só com um dos dois lados vê itens irrelevantes junto dos
  relevantes. Proposta: 2 sub-abas dentro da própria subaba (SUS de um
  lado, ANS/TISS do outro) — quem usa as duas frentes continua vendo as
  duas, só que separadas por tipo de faturamento em vez de misturadas.
  **Decisão fechada em 20/08/2026**: cabeçalho de seção (sem sub-navegação
  aninhada nova) — critério do usuário foi economizar espaço/não poluir a tela, e
  isso não adiciona uma linha de sub-abas extra. **Agendado pra 28/08/2026** (ajuste
  de funcionalidade existente, ver "Calendário planejado" mais abaixo).

- **[Alta]** **Agrupar os validadores num menu "Validadores"**: pedido do usuário
  (14/08/2026, com print do topbar) — hoje "Validador de XML TISS" e
  "Validador SUS" são duas abas de topo separadas (junto com Consulta,
  Múltiplos, SUS/SIGTAP, Tabelas TISS, CID-10, Verificadores), e o CIHA
  (candidato registrado acima) seria uma nona aba de topo se entrasse do
  jeito atual. Proposta: criar uma aba de topo "Validadores" e mover
  XML/TISS, SUS e (quando existir) CIHA pra dentro dela como sub-abas,
  mantendo cada validador com sua estrutura interna intacta — inclusive o
  Validador SUS, que já tem suas próprias sub-abas BPA/AIH/APAC
  (`.subtab-btn`/`data-subtab` em `#tab-validador-sus`), então essa
  seria a primeira aba-de-abas com 2 níveis de aninhamento no portal
  (`Validadores` → `Validador SUS` → `BPA/AIH/APAC`). O padrão de subaba
  em si já existe e funciona bem (mesmo mecanismo usado no FAQ,
  `.faq-subtab-btn`/`data-faqtab`), então é extensão de um padrão
  existente, não invenção de um novo.
  - Reduz de 8 pra 7 abas de topo visíveis hoje, e evita que o CIHA vire
    a nona — ajuda direto o achado de overflow mobile do topbar (já
    corrigido uma vez nesta sexta, mas cada aba nova aumenta a pressão de
    novo).
  - Decisão em aberto: implementar a reorganização já com XML/TISS+SUS
    (CIHA entra depois, quando o validador existir) ou esperar o
    validador de CIHA ficar pronto pra fazer tudo de uma vez. Como
    XML/TISS e SUS já existem e estão prontos, dá pra fazer essa parte
    independente do CIHA.

- **[Alta]** **Padronizar "Validador de XML TISS" com o mesmo padrão de sub-abas do
  Validador SUS**: pedido do usuário (14/08/2026, com prints comparando os
  dois), direto ligado ao item anterior — "temos que padronizar o todo
  portal pra ficar todas as telas no mesmo layout". Confirmado
  (`public/index.html`, painel `#tab-validador`): hoje o Validador de XML
  TISS empilha 2 cards na mesma tela — "Validador de XML TISS" (o
  validador em si) e, logo abaixo, "Leitor de Demonstrativo de Glosa
  (DAC)" (ferramenta separada, lê o retorno da operadora). O Validador
  SUS já resolve isso com sub-abas (`Validador BPA` / `Validador AIH` /
  `Validador APAC`). Proposta: aplicar o mesmo padrão aqui — sub-aba
  "XML" (o validador de guia) e sub-aba "DAC" (o leitor de glosa) dentro
  de "Validador de XML TISS", em vez de empilhados na mesma tela.
  - É reaproveitamento direto do mecanismo já existente
    (`.subtab-btn`/`data-subtab`), sem decisão de design nova — mais
    simples que o item anterior (aqui não tem aninhamento de 2 níveis,
    é só extrair os 2 cards que já existem lado a lado em sub-abas).
  - Faz sentido implementar junto com o agrupador "Validadores" acima —
    os dois nascem do mesmo pedido (padronizar layout) e deixam a
    hierarquia final simétrica: `Validadores` → `Validador de XML TISS`
    → (`XML` / `DAC`) e `Validadores` → `Validador SUS` →
    (`BPA` / `AIH` / `APAC`).

- **[Alta]** **Novo item de FAQ: "O que é OCI (Oferta de Cuidado Integrado)?"**: pedido
  do usuário (14/08/2026) — confirmado que o portal **ainda não tem nada**
  sobre OCI (nem FAQ, nem explicação), mas os **códigos de procedimento OCI
  já estão indexados** na busca SIGTAP (ex.: "OCI AVALIAÇÃO DIAGNÓSTICA
  INICIAL DE CÂNCER DE MAMA", achado em `sigtap_procedimentos.json`).
  Pesquisa complementada (14/08/2026) lendo o manual oficial completo —
  [Manual PMAE: Registro da Produção, Controle e Avaliação](https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/guias-e-manuais/2024/manual-pmae-registro-da-producao-controle-e-avaliacao.pdf)
  (atualizado em março/2025; o PDF é baseado em imagem — texto extraído
  localmente com `pdftotext -layout` via poppler/Git; cópia local em
  `manual-pmae-registro-da-producao-controle-e-avaliacao.pdf` na raiz do
  projeto, arquivo não versionado). Rascunho de resposta
  bem mais rico pra subaba SUS do FAQ, já com as regras que mais geram
  dúvida/erro de faturamento:

  - **O que é**: conjuntos de procedimentos (consultas, exames e/ou outros
    procedimentos diagnósticos/terapêuticos) e tecnologias de cuidado
    necessários pra concluir uma etapa da linha de cuidado — ou conduzir um
    agravo específico de resolução rápida — de forma integrada, no âmbito
    do Programa Mais Acesso a Especialistas (PMAE).
  - **Onde estão na Tabela SUS**: Grupo 09 — "Procedimentos para Ofertas
    de Cuidados Integrados". Todo procedimento principal de OCI é
    ambulatorial, tem o Atributo Complementar "Programa Mais Acesso a
    Especialistas (PMAE)" e exige a habilitação **38.01 - Programa Mais
    Acesso a Especialistas** no CNES do estabelecimento.
  - **Como registrar na APAC** (regras que mais pegam quem fatura):
    - 5º dígito do número da APAC tem que ser **"7"** (identifica o tipo de
      autorização do PMAE).
    - Campo "Tipo de APAC" = **"3"** — é sempre APAC única, **não existe
      APAC de continuidade**.
    - Identificação do paciente é **obrigatoriamente por CPF**.
    - Data de início da validade = data do primeiro procedimento realizado
      do conjunto da OCI. Se o procedimento principal tiver o atributo
      "APAC com validade fixa de 2 competências", o intervalo início→fim
      tem que caber em até 2 competências.
    - Caráter de atendimento é sempre **"01 - Eletivo"**.
  - **Procedimentos secundários — a parte que mais gera glosa**:
    - Mínimo de **2 procedimentos secundários** por APAC, e um deles tem
      que ser obrigatoriamente a consulta médica em atenção especializada
      (**0301010072**) ou a teleconsulta (**0301010307**) — o outro
      secundário precisa ser diferente desses dois.
    - Só é possível registrar um secundário se ele for **compatível** com
      o principal no SIGTAP (Relatórios → Compatibilidades). Sem
      compatibilidade cadastrada, o SIA **bloqueia o registro**.
    - Compatibilidade "Obrigatória" (não só "Compatível") força o registro
      desse secundário junto do principal na mesma APAC.
    - A quantidade máxima do secundário é a que está definida na própria
      compatibilidade — não o atributo de quantidade máxima do
      procedimento isoladamente.
  - **Valor e financiamento**: o valor total da APAC é só o valor do
    procedimento principal — os secundários entram com **valor zerado**
    (regra condicionada "0009"). Ainda assim, desde a competência
    março/2025 (Portaria SAES/MS nº 2.630/2025), todo procedimento de OCI
    — principal ou secundário — é financiado por **FAEC** e programado na
    aba FAEC da FPO (mesmo o secundário com valor zero).
  - **Oncologia (Subgrupo 09.01)**: quando o secundário tem o atributo
    "Exige data do resultado diagnóstico de Neoplasia", é obrigatório
    preencher "Data diagnóstico cito/histopatológico" e **CID Principal**
    (CID Secundário é opcional).
  - **Se a OCI não for concluída** dentro do prazo/regras do programa
    (nem todos os procedimentos obrigatórios realizados, ou prazo
    estourado), os procedimentos já feitos podem ser registrados em
    BPA-I normalmente — não ficam perdidos, só saem do fluxo de OCI.
  - **Curiosidade que conecta com outra pesquisa já registrada no
    roadmap**: a exigência de identificação do paciente **por CPF** na
    APAC de OCI é mais um caso do movimento de CPF como identificador
    único do usuário do SUS — ver
    [Observação: Carteira de Identidade Nacional (CIN)](#observação-não-é-candidato-ainda-carteira-de-identidade-nacional-cin)
    logo abaixo, mesma tendência, contexto diferente (lá é sobre
    identificação de beneficiário no TISS/ANS, aqui é registro SUS).
  - Sem decisão de escopo pendente — é só redigir o item (o rascunho acima
    já dá o conteúdo quase pronto) e publicar na subaba SUS do FAQ.

- **[Média]** **Achado relacionado (a partir da pesquisa de OCI): tabela de
  compatibilidade entre procedimentos já disponível localmente**: o manual
  do PMAE confirma que o registro de secundário em APAC de OCI **depende
  inteiramente** da tabela de compatibilidades do SIGTAP (Relatórios →
  Compatibilidades) — é regra de bloqueio do SIA, não sugestão. O usuário
  mostrou esse portal oficial (`sigtap.datasus.gov.br`), que lista pra cada
  OCI principal os procedimentos secundários compatíveis/obrigatórios (com
  tipo e quantidade permitida). O arquivo bruto equivalente,
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
  em geral, tipo "Compatível"/"Obrigatória" como descrito acima), mas é o
  dado que mais importa pra quem fatura OCI. **Agendado pra 04/09/2026** (1ª sexta
  de setembro — é feature nova de verdade: tabela nova, importador novo, endpoint
  novo, não extensão simples do que já existe; ver regra em "Calendário planejado"
  mais abaixo).

- **[Alta pro texto de FAQ / Baixa pro validador]** **Novo item de FAQ +
  candidato de feature: CIHA (Comunicação de
  Informação Hospitalar e Ambulatorial)**: pergunta do usuário (14/08/2026,
  "o que acha?") sobre abordar CIHA no FAQ — pesquisa feita e endossada
  ("sim, conseguimos montar um validador de arquivo CIHA?"). Confirmado
  que o portal ainda não tem nada sobre CIHA.
  - **O que é**: sistema (DATASUS) de reporte obrigatório de produção
    hospitalar/ambulatorial pra estabelecimentos **com ou sem vínculo com
    o SUS** — inclui atendimento por convênio/plano privado, particular,
    programas federais (PRONON/PRONAS/PROADI) etc. Não é instrumento de
    faturamento/repasse como BPA/AIH/APAC/TISS — é só informação, mas o
    não envio pode gerar sanção (perda de benefícios públicos), o que o
    torna uma dor real de compliance mesmo pra hospital 100% privado.
    Base legal: Portaria GM/MS 1.171/2011 (criação, renomeando o antigo
    CIH), reforçada pela Lei 12.653/2012. Estrutura em 3 partes: CIHA01
    (coleta, no estabelecimento), CIHA02 (processamento, na secretaria de
    saúde) e o Módulo Transmissor (envia ao Ministério da Saúde). Envio é
    **mensal**; ausência de movimento também precisa ser comunicada (
    remessa "sem movimento").
  - **Achado importante durante a pesquisa**: existem (pelo menos) **três
    documentos de layout diferentes** pra CIHA, e os dois primeiros que
    encontrei estavam errados/desatualizados — só ficou claro depois que o
    usuário forneceu 2 arquivos reais gerados pelo módulo CIHA do Totvs
    GSH (`2085569202505.txt`, `2221772202607.txt`, ambos na raiz,
    **contêm dado real de paciente — não versionados, não commitar**) pra
    comparar:
    1. `Layout_Arquivos_CIHA.pdf` — layout de **disseminação pública**
       (dbf, 29 campos) — formato de microdados processados (família do
       TabNet), não o que o hospital gera pra enviar. Descartado.
    2. `LayoutCIHA01_v1.0.4.2.docx` (via FTP, zip de 2014) — já era o
       layout de transmissão real, mas **desatualizado**: 390 caracteres
       por linha, não bateu com os arquivos reais do Totvs (609
       caracteres).
    3. `Layout_CIHA01_2024-06.pdf` (baixado de
       `ciha.saude.gov.br/documentos/documentos_ciha1.php` → "Layout da
       interface texto do CIHA01 - 06/2024", achado pelo usuário navegando
       no portal) — **este é o correto e vigente**. 609 caracteres,
       batendo exatamente com os dois arquivos reais do Totvs GSH,
       campo a campo (CNES confere com o nome do arquivo, datas válidas,
       fonte de remuneração/modalidade/motivo de saída batendo com os
       enums documentados, CID principal preenchido com secundário
       zerado conforme a regra).
    - Lição pro processo (a mesma de antes, reforçada): **arquivo real e
      validado do sistema que efetivamente gera o dado vale mais que
      qualquer PDF pra confirmar layout** — foi comparando linha real
      contra o PDF, byte a byte, que os dois layouts errados ficaram
      óbvios. Documento sozinho, sem dado real pra conferir, teria me
      deixado validando contra o layout errado.
  - **Layout confirmado (`Layout_CIHA01_2024-06.pdf`, 38 campos, 609
    caracteres, largura fixa)** — tabela completa (posição, tamanho,
    obrigatoriedade condicional) já extraída e documentada na conversa;
    resumo dos pontos centrais:
    - `DT_CMPT`(1-6) `CO_CNES`(7-13) `TP_ATENDIMENTO`(14, C/I)
      `CO_PROCEDIMENTO`(15-24) `QT_ATENDIMENTO`(25-30)
      `CO_FONTE_REMUNERACAO`(31-32, 12 valores possíveis)
      `CO_OPERADORA`(33-38, registro ANS) `DT_ADMISSAO`(39-46)
      `DT_SAIDA`(47-54) `CO_MODALIDADE`(55-56, 01-Ambulatorial/
      02-Hospitalar) `CO_MOTIVO_SAIDA`(57-58, ~30 códigos de alta/óbito)
      `CO_CID_PRINCIPAL`(61-64) `CO_CID_SECUNDARIO`(65-68) `NU_CNPJ`
      `NU_CNPJ_FONTE_REMUNERACAO` `CO_BENEFICIARIO` `NU_DOCUMENTO_OBITO`
      `NU_TISS`(159-178 — ponte direta com o Validador de XML TISS que o
      portal já tem) `NU_PRONTUARIO` `NU_CNS`(191-205) `NO_PACIENTE`
      (206-275) `DT_NASCIMENTO` `TP_SEXO` endereço completo (logradouro/
      número/complemento/CEP/`CO_MUNICIPIO`/`SG_UF`) `NU_DNV1..5`
      (declaração de nascido vivo, até 5) `QT_DIAS`(UTI)
      `DS_PROCEDIMENTO_GENERICO`(510-609, obrig. só se não-SUS).
    - Obrigatoriedade é condicional em cascata: por `TP_ATENDIMENTO`
      (individualizado exige nome/nascimento/sexo/endereço/etc.), por
      `CO_FONTE_REMUNERACAO` (convênio=01 exige operadora/CNPJ/
      beneficiário/TISS/prontuário; consórcio=13 exige outro CNPJ), por
      `CO_MODALIDADE` (hospitalar exige motivo de saída), por desfecho
      (óbito exige documento de óbito), e por atributo do procedimento na
      Tabela SUS ("Exige CID").
    - Pendência pequena a resolver na implementação: o PDF declara
      `NU_CNPJ` com tamanho 14 mas as posições impressas (069-081) somam
      só 13 — provável erro de digitação do próprio DATASUS (o campo
      seguinte só começa em 083, sobrando a posição 82 sem dono
      declarado). Resolver testando contra mais linhas reais antes de
      fixar a regra.
  - **Por que dá pra validar bem**: é o mesmo tipo de arquivo plano de
    largura fixa que o portal já processa (mesmo padrão dos arquivos
    SIGTAP), e os campos mais sujeitos a erro batem com dados que o
    portal **já indexa**: `CO_CID_PRINCIPAL`/`CO_CID_SECUNDARIO` (tabelas
    de CID-10 já usadas no Checklist e na busca SIGTAP),
    `CO_PROCEDIMENTO` (procedimentos SIGTAP já indexados), `CO_OPERADORA`
    (Operadoras ANS já indexado), possivelmente `CO_CNES` (dado que o
    `cnes-atualizador.js` já trata). Validação viável em duas camadas:
    (1) estrutural — posição/tamanho/tipo de cada campo, preenchimento
    obrigatório conforme a cascata de condições acima; (2) semântica —
    CID, procedimento, operadora e CNES existem e são válidos nas
    tabelas já carregadas.
  - **Escopo pra implementar**: é maior que os itens de FAQ acima (é uma feature
    nova de validação, com regras condicionais em cascata, não só texto).
    **Agendado pra 04/09/2026** (1ª sexta de setembro, junto com o Validador DMED —
    ver "Calendário planejado" mais abaixo), já desbloqueado pra entrar em
    implementação quando a data chegar — layout confirmado, fonte de dado real de
    teste disponível (os dois arquivos do Totvs), e mapeamento de quais campos
    cruzam com dado já indexado no portal está feito.
  - Fontes: [Manual Técnico-Operacional CIHA01 (wiki DATASUS)](https://wiki.saude.gov.br/ciha/index.php/Manual_T%C3%A9cnico-Operacional_CIHA01), [Documentos do CIHA01 (portal oficial)](https://ciha.saude.gov.br/documentos/documentos_ciha1.php) (achado pelo usuário — tem o layout vigente), [Página principal da wiki CIHA](https://wiki.saude.gov.br/ciha/index.php/Página_principal), [Portal CIHA](https://ciha.saude.gov.br/principal/index.php) (sugerido pelo usuário como fonte pro FAQ). Os três PDFs/docx de layout estão salvos na raiz do projeto (não versionados) — `Layout_Arquivos_CIHA.pdf` (descartado), `LayoutCIHA01_v1.0.4.2.docx` (desatualizado), `Layout_CIHA01_2024-06.pdf` (**vigente, usar este**).

- **[Alta]** **Novo item de FAQ: tabela de classificação da Portaria SVS/MS 344/98
  (A1 a F2)**: pedido do usuário (20/08/2026, com print da tabela de classificações).
  Confirmado que o conteúdo hoje está **espalhado e incompleto** — a subaba
  Medicamentos do FAQ já tem os itens "O que são as tarjas dos medicamentos" e "O que
  são as notificações de receita (amarela, azul, branca)", que citam A1/A2/A3
  (Notificação A), B1/B2 (Notificação B) e C1-C5 (Notificação C) soltos dentro da
  prosa, e o item do livro de registro específico cita de novo A1, A2, A3, B1, B2,
  C1, C2, C3, C4, C5 — mas nenhum lugar tem a tabela completa código → classificação
  → o que exige, e faltam **D1/D2** (precursoras/insumos químicos), **E** (plantas
  proscritas) e **F1/F2** (substâncias de uso proscrito) por inteiro, que hoje não
  aparecem em lugar nenhum do FAQ. Baixo esforço — é consolidar/completar conteúdo já
  parcialmente pesquisado num item novo e dedicado, não pesquisa do zero.

- **[Baixa]** **Mostrar a classificação da Portaria 344/98 (A1-F2) na Consulta de
  Medicamentos (CMED)**: mesmo pedido do usuário (20/08/2026) — verificado que a base
  pública que o portal já usa (`TA_PRECO_MEDICAMENTO.csv`, arquivo oficial de preços
  CMED/ANVISA, ver `cmed-atualizador.js`) **não tem essa informação**. As colunas
  disponíveis nesse arquivo são só `TARJA` (vermelha/preta/amarela/sem tarja) e
  `RESTRIÇÃO HOSPITALAR` — já exibidas no card de cada medicamento — que são conceitos
  relacionados mas mais genéricos que a classificação A1-F2. A classificação da
  Portaria 344/98 vem de listas específicas (atualizadas por RDCs da ANVISA), num
  documento separado do preço, sem chave direta em comum com o GGREM/registro usado
  hoje — precisaria de correspondência por nome de substância, o que traz risco de
  descasamento (nome digitado diferente, mais de uma substância por apresentação) e
  manutenção contínua (cada RDC pode mover uma substância de lista). Fica registrado
  como candidato de feature, não pronto pra entrar direto — falta antes achar e
  validar uma fonte oficial estruturada (não só PDF) das listas vigentes da Portaria
  344/98 antes de estimar esforço de verdade.

  **Atualização da pesquisa (21/08/2026)**: localizado e baixado um PDF oficial da
  ANVISA já "compilado" (`PRT_SVS_344_1998_COMP.pdf`, hospedado em
  antigo.anvisa.gov.br, 84 páginas) — texto completo lido e conferido. Confirma que
  esse formato de documento existe e é utilizável como base: traz o regulamento
  inteiro (Art. 1º a 110) mais os Anexos I a XXIV, incluindo as 15 listas de
  substâncias (A1, A2, A3, B1, B2, C1-C5, D1, D2, E, F1-F4) já nomeadas e separadas,
  com o histórico de qual Resolução/RDC alterou cada trecho. **Mas está desatualizado**:
  a última atualização registrada no Anexo I é a nº 51 (RDC 87/2016) — quase 10 anos
  atrás. Busca rápida confirma que a ANVISA seguiu emitindo RDCs alterando essas
  listas depois disso (pelo menos RDC 861/2024, RDC 958/2024, RDC 970/2025 e RDC
  999/2025 — nomes de fármacos podem ter entrado, saído ou mudado de lista nesse
  intervalo). Isso **reforça a conclusão do teste de 28/08 abaixo**, não a substitui: a
  ANVISA não publica uma versão HTML/CSV/JSON viva e sempre atual — só PDFs "Anexo I"
  por Portaria/RDC, sem um "compilado" oficial que se atualize sozinho. Pra ter uma
  lista realmente atual e confiável no portal, o caminho seria: (1) usar esse PDF de
  2016 como esqueleto/estrutura de dados (já que o formato das 15 listas está pronto),
  e (2) aplicar manualmente as alterações de cada RDC publicada depois de 2016 até
  hoje (pelo menos as 4 achadas nesta busca, possivelmente mais) — um trabalho de
  curadoria de dados pontual, não recorrente-automático, mas que precisa ser refeito a
  cada nova RDC que a ANVISA publicar dali pra frente (não tem como isso ficar
  "pronto para sempre"). Sites privados como farmaciasdigitais.com.br dizem manter
  lista "atualizada", mas não são fonte oficial — não servem pra citar diretamente,
  só como pista de quais RDCs procurar.

  **Decisão (21/08/2026)**: vira **mini-projeto de dados**, encaixado na Fase 10 -
  Farmácia (alvo 02/10/2026), com exigência explícita do usuário de **deixar claras
  as origens e a vigência de cada informação** — não é só popular uma tabela, é
  documentar de onde veio cada dado e até quando ele vale.

  Escopo do mini-projeto:
  1. **Baseline**: `PRT_SVS_344_1998_COMP.pdf` (ANVISA, compilado até Atualização nº
     51 / RDC 87, de 28/06/2016) — usado só como esqueleto estrutural das 15 listas
     (A1, A2, A3, B1, B2, C1-C5, D1, D2, E, F1-F4), não como fonte de conteúdo atual.
  2. **Levantamento sistemático de RDCs pós-2016 — concluído em 21/08/2026**: a busca
     rápida do dia anterior tinha achado só 4 RDCs — **subestimativa grande**. A fonte
     certa era a página oficial de changelog da ANVISA
     (gov.br/anvisa/pt-br/assuntos/medicamentos/controlados/lista-substancias), lida
     por completo hoje. Resultado real: **51 RDCs** entre a base de 2016 e a versão
     vigente, RDC nº 1.036/2026 (09/07/2026). Lista completa, em ordem cronológica,
     na tabela abaixo — cada uma ainda **não aplicada** ao baseline, com o tipo de
     alteração (quando a página informa) como pista de por onde começar.
  3. **Aplicar cada RDC** sobre o baseline (inclusão/exclusão/mudança de lista por
     substância), registrando por linha: substância, lista atual, **RDC que originou
     essa posição atual** e **data de publicação dessa RDC**. Com 51 RDCs pra ler e
     aplicar uma a uma, **não é realista terminar tudo numa sentada** — vira trabalho
     incremental nas revisões semanais (ver "Revisão semanal do roadmap" no topo deste
     documento), marcando cada linha da tabela como aplicada conforme for.
  4. **No portal**: cada exibição da classificação leva um aviso do tipo "última
     verificação: [data] — base: Portaria SVS/MS 344/98, compilada até RDC 87/2016 +
     RDCs [lista] aplicadas manualmente", no mesmo padrão de transparência de data já
     usado no Leitor de DAC (Validadores → XML/TISS → DAC). Se 02/10 chegar com o
     levantamento incompleto, o aviso deve refletir isso com honestidade (ex: "48 de
     51 RDCs pós-2016 aplicadas, atualizado até RDC nº 985/2025") em vez de aparentar
     100% de cobertura sem ser verdade.
  5. **Manutenção**: como a ANVISA não tem fonte viva, esse "última verificação" some
     desatualizado assim que sair uma RDC nova — não tem como automatizar; fica
     registrado como processo manual recorrente (não uma tarefa "pronta pra sempre"),
     a ser revisitado em cada ciclo de revisão do portal.

  **Tracker das 51 RDCs a aplicar (levantado em 21/08/2026, nenhuma aplicada ainda)**:

  | RDC | Data | Alteração (conforme changelog ANVISA) | Aplicada? |
  |---|---|---|---|
  | 103/2016 | 31/08/2016 | Inclusões/exclusões/alterações | ☐ |
  | 117/2016 | 19/10/2016 | Múltiplas inclusões e exclusões | ☐ |
  | 130/2016 | 02/12/2016 | Inclusões nas Listas A3, E | ☐ |
  | 143/2017 | 17/03/2017 | Inclusões nas Listas D1, F1, F2 | ☐ |
  | 159/2017 | 02/06/2017 | Inclusões nas Listas C1, F2 | ☐ |
  | 169/2017 | 15/08/2017 | Inclusões nas Listas A1, C1 | ☐ |
  | 175/2017 | 19/09/2017 | Inclusão na Lista F2 | ☐ |
  | 186/2017 | 25/10/2017 | Múltiplas inclusões em várias listas | ☐ |
  | 188/2017 | 13/11/2017 | Inclusões nas Listas A1-F4 | ☐ |
  | 192/2017 | 11/12/2017 | Inclusão na Lista C3 | ☐ |
  | 227/2018 | 17/05/2018 | Inclusões/exclusões nas Listas A3, F1-F3 | ☐ |
  | 246/2018 | 21/08/2018 | Inclusões nas Listas C1, F1-F2 | ☐ |
  | 254/2018 | 10/12/2018 | Inclusão na Lista F2 | ☐ |
  | 265/2019 | 08/02/2019 | Inclusão na Lista F2 (RH-34) | ☐ |
  | 277/2019 | 16/04/2019 | Inclusões nas Listas B1, C1 | ☐ |
  | 300/2019 | 12/08/2019 | Inclusões nas Listas C5, F2 | ☐ |
  | 314/2019 | 10/10/2019 | Inclusões nas Listas D1, F1-F2 | ☐ |
  | 325/2019 | 03/12/2019 | Inclusões/alterações na Lista F2 | ☐ |
  | 337/2020 | 11/02/2020 | Inclusão na Lista C1 | ☐ |
  | 345/2020 | 09/03/2020 | Inclusões/alterações em várias listas | ☐ |
  | 351/2020 | 20/03/2020 | Inclusão na Lista C1 | ☐ |
  | 368/2020 | 07/04/2020 | Inclusão na Lista C1 | ☐ |
  | 372/2020 | 15/04/2020 | Inclusão na Lista C1 | ☐ |
  | 404/2020 | 21/07/2020 | Inclusões/alterações na Lista A3 | ☐ |
  | 473/2021 | 24/03/2021 | Inclusões/remanejamento entre listas | ☐ |
  | 581/2021 | 02/12/2021 | Inclusões/alterações nas Listas B1, C1, F1-F2 | ☐ |
  | 598/2022 | 09/02/2022 | Inclusão na Lista F2 | ☐ |
  | 607/2022 | 23/02/2022 | Exclusão/inclusões nas Listas B1, C1 | ☐ |
  | 676/2022 | 28/04/2022 | Exclusão/inclusões/alterações em várias listas | ☐ |
  | 734/2022 | 11/07/2022 | Exclusões/inclusões/alterações | ☐ |
  | 762/2022 | 24/11/2022 | Inclusões/alterações nas Listas B1, F2 | ☐ |
  | 767/2022 | 08/12/2022 | Inclusão na Lista C1 | ☐ |
  | 784/2023 | 31/03/2023 | Inclusões/alterações em várias listas | ☐ |
  | 804/2023 | 24/07/2023 | Inclusões nas Listas D1, F1-F2 | ☐ |
  | 816/2023 | 15/09/2023 | Exclusões/inclusões/alterações | ☐ |
  | 827/2023 | 24/11/2023 | Inclusões/alterações nas Listas A1, F1 | ☐ |
  | 835/2023 | 13/12/2023 | Inclusões/alterações em várias listas | ☐ |
  | 861/2024 | 06/05/2024 | Exclusões/inclusões/alterações | ☐ |
  | 871/2024 | 17/05/2024 | Exclusão na Lista B1 | ☐ |
  | 877/2024 | 28/05/2024 | Exclusão na Lista B1 | ☐ |
  | 936/2024 | 05/11/2024 | Inclusões nas Listas A3, E | ☐ |
  | 958/2024 | 31/12/2024 | Exclusões/inclusões/alterações | ☐ |
  | 970/2025 | 19/03/2025 | Inclusões/alterações em várias listas | ☐ |
  | 974/2025 | 23/04/2025 | Inclusão na Lista B1 | ☐ |
  | 985/2025 | 29/07/2025 | Inclusões/alterações nas Listas F1-F2 | ☐ |
  | 999/2025 | 24/11/2025 | Inclusões nas Listas B1, C1 | ☐ |
  | 1.011/2026 | 30/01/2026 | Inclusões nas Listas C1, E (vigência 04/08/2026) | ☐ |
  | 1.017/2026 | 20/02/2026 | Inclusões/exclusões/alterações | ☐ |
  | 1.021/2026 | 09/04/2026 | Inclusões/alterações nas Listas F1-F4 | ☐ |
  | 1.023/2026 | 11/05/2026 | Exclusões/inclusões/alterações | ☐ |
  | 1.036/2026 | 09/07/2026 | Inclusões nas Listas D1, F1 — **versão vigente** | ☐ |

  Fonte da lista: [Lista de substâncias sujeitas a controle especial — ANVISA](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/controlados/lista-substancias), consultada em 21/08/2026. A própria página não oferece PDF consolidado — confirma de novo que não existe atalho, cada RDC precisa ser aberta individualmente.

Demais candidatos (levantados em rodadas de revisão anteriores, sem
pedido direto do usuário — prioridade abaixo dos itens acima):

- **[Média]** **Passada mobile completa** — **agendada pra 28/08/2026**, ver
  "Calendário planejado" mais abaixo. Só o overflow do topbar foi corrigido até
  agora (achado #1). Não foi testado em viewport estreito se a grade de
  edições da Consulta por procedimento, os cards do SUS/SIGTAP, as tabelas
  do Validador de XML TISS e o gráfico comparativo continuam legíveis/
  utilizáveis abaixo de ~480px.
- ~~Verificar se existe edição da CBHPM mais recente que 2025-2026~~ — **checado em
  20/08/2026**: existe, mas **ainda não é hora de importar**. Uma nova edição da
  CBHPM foi **lançada/anunciada em 12/06/2026 no 4º Congresso Brasileiro de Medicina**
  (CBMG 2026) — inclui cirurgia robótica, saúde digital, terapias avançadas,
  diagnóstico de alta complexidade e revisão de portes/classificação de auxiliares,
  atualizando o que mudou na medicina nos últimos 4 anos desde a 11ª edição (2022).
  Só que a própria página oficial da AMB (amb.org.br/cbhpm/) **ainda lista 2022 como
  "a última edição"** — nenhuma tabela de valores publicada lá ainda — e a fala do
  próprio dirigente da AMB no lançamento ("o grande desafio é implementar o que está
  sendo lançado hoje... é só o pontapé inicial de uma jornada longa de implementação")
  indica que a negociação com as operadoras pra essa edição valer na prática ainda
  nem começou. Ou seja: existe uma edição nova no horizonte, mas comprar/importar
  agora seria prematuro — não há tabela oficial de valores disponível pra adquirir.
  **Fica como item de observação** (mesmo padrão da observação sobre CIN/CPF mais
  abaixo neste documento) — vale conferir de novo a página oficial da AMB daqui
  algumas semanas/meses, quando a implementação avançar.
  Fontes: [AMB lança nova edição da CBHPM](https://amb.org.br/amb-lanca-nova-edicao-da-cbhpm/), [Nova edição da CBHPM é lançada no CBMG 2026 — APM](https://www.apm.org.br/nova-edicao-da-cbhpm-e-lancada-no-cbmg-2026-inclusao-da-cirurgia-robotica-e-um-dos-destaques/), [CBHPM — AMB (página oficial, ainda lista 2022)](https://amb.org.br/cbhpm/)
- ~~Passada de acessibilidade~~ — **investigada em 20/08/2026, escopo baixo
  confirmado, agendada pra 28/08/2026** — ver "Calendário planejado" mais abaixo
  pro resultado completo da investigação (20 áreas sem `aria-live`, 4 inputs sem
  label, resto já ok).
- **[Média]** Os itens que já estavam na "Transparência de dados" original mas não
  entraram no escopo desta semana continuam válidos como ideia menor — expor a data
  de "última revisão" do dicionário de glosas diretamente na aba onde ele é usado
  (Validador de XML TISS), não só na aba Fontes. Esforço baixo, valor pontual —
  **agendado pra 28/08/2026**, ver "Calendário planejado" mais abaixo.

Sem item de peso maior definido além do que já está no "Calendário planejado" logo
abaixo.

### Itens de Alta prioridade implementados em 20/08/2026 (pra liberação de 21/08)

Antecipado pelo usuário (20/08/2026) — os itens [Alta] acima foram implementados nesta
sessão, testados localmente com Playwright, e sobem pro Git amanhã (21/08) depois de
um dia de teste no servidor local, seguindo a decisão de sempre ter algo testado antes
de liberar (ver "Cadência de release" acima).

- ~~Tópicos em lista no FAQ~~ — **✅ implementado**: levantamento feito em todas as 17
  subabas do FAQ; reformatadas ~13 respostas que misturavam 2+ termos em prosa corrida
  (tarjas, notificações de receita, BPA/AIH/APAC, CBHPM/TUSS/SIGTAP, acreditações,
  liquidação/direção fiscal, tipos de auditoria, pacote fechado/conta aberta — o
  exemplo original —, tipos de diária, hospital-dia/paciente-dia, genérico/similar/
  referência/biológico, institutos de previdência) pro formato de lista com marcador,
  termo em negrito. Nova classe `.faq-lista` no CSS.
- ~~Agrupar validadores num menu "Validadores"~~ — **✅ implementado**: nova aba de topo
  "Validadores" (reduz de 8 pra 7 abas visíveis) com "Validador de XML TISS" e
  "Validador SUS" como subabas de primeiro nível; XML/TISS ganhou subabas internas
  "XML"/"DAC" (item seguinte), e SUS manteve BPA/AIH/APAC intactos — primeira
  aba-de-abas com 2 níveis de aninhamento no portal, como o roadmap antecipava.
  **Achado técnico não previsto no roadmap original**: o mecanismo de subaba
  (`.subtab-btn`/`.subtab-panel`) era global (`document.querySelectorAll` sem escopo)
  — funcionava porque só existia um grupo de subabas na página (BPA/AIH/APAC). Com 3
  grupos simultâneos (Validadores → XML-TISS-vs-SUS, XML-TISS → XML-vs-DAC, SUS →
  BPA/AIH/APAC), o clique num grupo escondia os painéis dos outros grupos por engano.
  Corrigido com um atributo `data-subtab-group` em botões e painéis, escopando a
  consulta no clique — mecanismo genérico, funciona pra qualquer profundidade futura de
  aninhamento. Todos os ~12 links de FAQ que apontavam pras abas antigas
  (`data-goto-tab="validador"`/`"validador-sus"`) foram atualizados; um novo atributo
  `data-goto-subtab2` foi adicionado ao mecanismo de deep-link do FAQ pra alcançar o
  segundo nível (ex: FAQ do CNES → Validadores → SUS → AIH, direto).
- ~~Padronizar "Validador XML TISS" com sub-abas~~ — **✅ implementado** junto com o item
  acima: os dois cards que ficavam empilhados (Validador de XML TISS + Leitor de DAC)
  agora são as subabas "XML" e "DAC" dentro de "Validador de XML TISS".
- ~~FAQ: OCI~~ — **✅ implementado**: item novo na subaba SUS/SIGTAP do FAQ, com o
  conteúdo já pesquisado (regras de APAC, procedimentos secundários, financiamento
  FAEC), em formato de lista.
- ~~FAQ: classificação Portaria 344/98 (A1-F2)~~ — **✅ implementado**: item novo na
  subaba Medicamentos do FAQ, consolidando A1-F2 completo (antes só A1-C5 apareciam
  espalhados em 2 itens diferentes); os itens de tarja e notificação de receita citam
  cruzado pra esse item novo.
- ~~CIHA — texto de FAQ~~ — **✅ implementado**: item novo na subaba SUS/SIGTAP do FAQ,
  com o resumo do que é, quem precisa enviar e o layout confirmado. O **validador de
  arquivo CIHA em si continua fora de escopo** (Alto esforço, sem data), conforme
  confirmado com o usuário — só entrou pro "Em breve" do rodapé como item sendo
  avaliado, sem compromisso.
- **Achado extra, fora da lista original**: a Consulta de Medicamentos (CMED) foi
  conferida contra a classificação 344/98 (candidato [Baixa] registrado acima) — nada
  mudou aí ainda, é só a decisão de manter fora do escopo desta sexta confirmada.

### Item extra do dia, fora da lista original: DMED (pedido do usuário, 20/08/2026)

- ~~FAQ: o que é a DMED, quem entrega, prazo e penalidade~~ — **✅ implementado**: item
  novo na subaba Particular do FAQ, encaixado ao lado do item de nota fiscal/Receita
  Saúde/NFS-e que já existia. Testado com Playwright, sem erro de console.
- **[Média] Validador de arquivo DMED — pesquisa de viabilidade feita, aguardando
  arquivo de exemplo do usuário pra prosseguir**: a Receita Federal publica um leiaute
  **oficial e documentado** do arquivo de importação da DMED (Anexo Único, atualizado
  anualmente por Ato Declaratório Executivo Cofis — o vigente pra DMED 2026 é o ADE
  Cofis nº 27, de 15/12/2025) — não é um formato proprietário/criptografado do
  Programa Gerador (PGD): é um texto plano com campos delimitados por `|` (pipe), um
  registro por linha, pensado justamente pra sistemas de terceiros (contábil/ERP)
  gerarem e o declarante importar no PGD antes de transmitir. Estrutura confirmada
  (lida da versão do Anexo Único referente a 2012-2018 — a estrutura de registros é
  estável há anos, mas o **leiaute vigente de 2026 precisa ser conferido** antes de
  codificar, porque coisas como o código "identificador de estrutura do leiaute"
  mudam a cada ano):
  - Registros, em ordem hierárquica: `Dmed` (cabeçalho, 1º registro) → `RESPO`
    (responsável pelo preenchimento) → `DECPJ` (declarante PJ, com "Tipo do
    declarante": 1-prestador, 2-operadora, 3-ambos) → ramo de operadora (`OPPAS` →
    `TOP` → `RTOP`/`DTOP` → `RDTOP`) e/ou ramo de prestador (`PSS` → `RPPSS` →
    `BRPPSS`) → `FIMDmed` (rodapé, último registro).
  - Regras de validação já documentadas oficialmente e prontas pra virar checagem:
    ordem exata dos registros, cardinalidade (alguns só uma vez, outros repetem),
    ordenação crescente por CPF/CNPJ dentro de cada bloco, obrigatoriedade
    condicional em cascata (ex: "valor pago no ano com o titular" só é obrigatório se
    não existirem os registros de detalhe RTOP/DTOP associados) — o mesmo padrão de
    cascata que o Validador CIHA (candidato registrado acima) já usa.
  - **Sinergia direta com dado que o portal já tem**: os campos CNES e Registro ANS
    dentro do DECPJ/OPPAS já são exatamente os que a aba CNES e a aba Operadoras ANS
    validam hoje — dá pra cruzar automaticamente, sem base de dados nova.
  - **Layout confirmado por arquivo real (20/08/2026)**: o PDF do ADE Cofis nº
    27/2025 (o vigente) não foi encontrado em texto extraível — nem direto em
    normas.receita.fazenda.gov.br/normasinternet2 (site client-side, sem conteúdo
    fora do navegador), nem no LegisWeb (só a publicação em imagem escaneada do
    Diário Oficial, sem o anexo técnico). Em vez de insistir no PDF, o usuário gerou
    um arquivo de exemplo real (`DMED_1_Unidade de Faturamento.txt`, git-ignored —
    contém CPF, nome completo e valores reais, mesmo tratamento dos arquivos CIHA)
    pelo PGD do sistema dele — e ele bate **campo a campo** com a estrutura já
    documentada aqui, inclusive o código "identificador de estrutura do leiaute"
    (`S5830B`) idêntico ao de uma versão anterior do leiaute, confirmando que a
    estrutura não mudou. Mesmo padrão de sucesso do CIHA: arquivo real de produção
    valeu mais que qualquer PDF pra confirmar layout.
  - **Status (20/08/2026)**: implementação **não entra em 21/08** — agendada pra
    **04/09/2026 (1ª sexta de setembro)**, junto com o Validador CIHA (candidato
    acima) — ver "Calendário planejado" abaixo pro raciocínio completo. Layout
    confirmado e arquivo de teste real disponível — só falta a data chegar.
  Fontes: [Leiaute do Arquivo da Dmed — Anexo Único (normas.receita.fazenda.gov.br)](http://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=46204), [Receita Federal aprova novo leiaute do programa da DMED 2026](https://www.contabilex.com.br/noticias/tecnicas/2025/12/17/receita-federal-aprova-novo-leiaute-do-programa-da-dmed-2026.html)

Testado com Playwright antes de considerar pronto: navegação entre os 2 níveis de
subaba preserva estado (ex: volta pra XML/TISS depois de estar na SUS e o DAC
continua selecionado, sem reaparecer o BPA por engano), os ~12 deep-links do FAQ
levam pro lugar certo (inclusive os de 2 níveis), os 3 itens de FAQ novos aparecem e
renderizam a lista corretamente, sem overflow horizontal em mobile (390px) e sem
nenhum erro de console.

## Calendário planejado (definido em 20/08/2026)

Regra nova, definida com o usuário ao organizar o calendário depois da primeira sexta
cheia (21/08): dentro do mês, **toda sexta libera ajuste/melhoria de funcionalidade
que já existe**; **feature nova só libera na 1ª sexta do mês**, mesmo que já esteja
com escopo/layout confirmado e pronta pra codificar. É uma camada a mais em cima da
cadência semanal (ver "Cadência de release" acima) — feature nova espera a virada do
mês por definição, não por falta de prontidão.

**21/08/2026 (sexta) — já fechado, ver "Itens de Alta prioridade implementados"
acima**: menu Validadores, reformatação de listas do FAQ, FAQ de OCI/CIHA(texto)/
Portaria 344-98, FAQ de DMED.

**28/08/2026 (sexta) — ajustes/melhorias de funcionalidade existente**:

Todos os 4 itens abaixo foram **implementados e testados em 21/08/2026** (uma semana
antes da entrega, pra não deixar nada de última hora) — ficam prontos no servidor
local, aguardando só a decisão de subir junto com a liberação de 28/08.

- ~~Sub-abas separando SUS de ANS/TISS em "Rejeição/Validação de arquivos"~~ — **✅
  implementado**: reagrupado com cabeçalho de seção dentro da própria subaba (3
  grupos: "SUS / SIGTAP", "Operadoras / Padrão TISS", "Cadastros e registros (serve
  pros dois)" — os 3 itens que genuinamente se aplicam aos dois lados, como o
  conversor de código e a consulta de OPME, ficaram num terceiro grupo em vez de
  forçado num dos dois primeiros), sem sub-aba aninhada nova, reaproveitando o
  estilo `.conversor-secao-titulo` que já existia. Testado com Playwright: todos os
  ~12 deep-links continuam funcionando após a reorganização.
- ~~Passada mobile completa~~ — **✅ testado em 375px, nenhuma correção precisou ser
  feita**: as 4 áreas apontadas como não verificadas (grade de edições da Consulta
  por procedimento, cards do SUS/SIGTAP, tabelas do Validador de XML TISS — incluindo
  o modal de guia com tabela de materiais — e o gráfico comparativo) já funcionam bem
  sem overflow horizontal nem quebra de layout. O gráfico comparativo já usa SVG com
  `viewBox` responsivo (não pixel fixo), por isso escalou bem sem ajuste.
- ~~Data de "última revisão" do dicionário de glosas~~ — **✅ implementado**: a data
  (04/08/2026) agora aparece direto na descrição do Leitor de DAC (dentro de
  Validadores → XML/TISS → DAC), com nota de que a mesma data e fontes detalhadas
  continuam na aba Fontes.
- ~~Passada de acessibilidade~~ — **✅ implementado**: `aria-live="polite"` adicionado
  às 20 áreas de resultado que atualizam via fetch (script único, não manual item a
  item) e `aria-label` nos 2 campos (busca + relação) do template de linha da aba
  Múltiplos procedimentos. Contraste de cor **continua não avaliado** — não entrou
  no escopo desta rodada, fica como possível item futuro à parte se quiser aprofundar
  a acessibilidade além do que já foi corrigido.
- ~~Classificação 344/98 na CMED~~ — **investigado em 20/08/2026, resultado: não
  cabe em 28/08**. Conferido diretamente o site oficial da ANVISA
  (gov.br/anvisa/.../controlados/lista-substancias): a página **não tem** a lista de
  substâncias em formato estruturado — só um changelog de RDCs/Portarias que
  alteraram a norma ao longo do tempo, cada uma linkando pro PDF próprio, sem tabela
  consolidada em HTML/CSV/JSON. Pra ter essa classificação no portal seria preciso
  compilar manualmente a partir de múltiplos PDFs (trabalho de coleta de dados, não
  só codificação) e manter atualizado a cada RDC nova — fica sem data, precisa virar
  uma sessão de pesquisa/estruturação de dados própria antes de entrar em qualquer
  sexta.

**04/09/2026 (1ª sexta de setembro) — features novas**:
- Validador de arquivo CIHA (layout confirmado, arquivo real de teste disponível).
- Validador de arquivo DMED (layout confirmado por arquivo real, ver acima).
- Tabela de Compatibilidade entre Procedimentos SIGTAP (nova tabela no banco,
  importador e endpoint — feature de verdade, não é extensão do que já existe).
  **Fonte de dados confirmada em 21/08/2026**: dentro do zip oficial já baixado
  (`TabelaUnificada_202607_v2607101010.zip`) existe `rl_procedimento_compativel.txt`
  (12.226 registros, layout oficial documentado em
  `rl_procedimento_compativel_layout.txt`: CO_PROCEDIMENTO_PRINCIPAL,
  CO_REGISTRO_PRINCIPAL, CO_PROCEDIMENTO_COMPATIVEL, CO_REGISTRO_COMPATIVEL,
  TP_COMPATIBILIDADE, QT_PERMITIDA, DT_COMPETENCIA) e também
  `rl_excecao_compatibilidade.txt` (regra de exceção quando um terceiro procedimento
  de restrição também está na guia). Achado de graça, sem precisar baixar nada novo —
  reduz bastante o risco desta entrega, o importador já pode ser desenhado direto em
  cima do layout real.

  ⚠️ **Sinal de atenção, não decisão fechada**: são 3 features de porte real no
  mesmo dia (CIHA é esforço Alto, DMED é um validador completo novo, Compatibilidade
  exige nova tabela+importador+endpoint) — pode não caber tudo com o mesmo padrão de
  qualidade/teste que as liberações anteriores tiveram. Seguindo o princípio já
  estabelecido ("libera o que estiver pronto e testado, não força item sem
  verificação pra caber numa cota"), o esperado é que pelo menos uma dessas três
  escorregue pra 02/10/2026 (a sexta seguinte do padrão mensal) se não estiver
  madura a tempo — decisão de qual, se for o caso, fica pra mais perto da data.

**11/09/2026 (sexta de ajuste) — FAQ: NOTIVISA**: item novo de conteúdo transversal
(decisão de 21/08/2026, ver seção "Frentes transversais de suporte a profissionais
de saúde" abaixo) — pesquisa já concluída, só falta escrever/publicar o item de FAQ.
Esforço baixo, sem dependência de outro item; primeira sexta de ajuste livre depois
do pacote de 04/09.

**Também em 11/09/2026 — FAQ: assinatura digital vs. assinatura eletrônica**: item
novo de conteúdo, pedido do usuário (26/08/2026, "acha válido falar sobre assinatura
digital no FAQ?") — avaliação: **válido e direto ligado ao core do portal** (TISS
exige assinatura nas guias/documentos trocados), diferente de atestado/receituário/
"lei do atestado", que ficam fora por serem prática clínica em si, fora do escopo de
conferência de faturamento (mesmo critério da expansão farmácia/enfermagem: conteúdo
de referência, não orientação clínica/legal de terceiros). **[Alta]** — esforço baixo
(só texto, sem feature nova), pesquisa já concluída, sem decisão de escopo pendente.
Mesma categoria que o item NOTIVISA acima (conteúdo transversal, cabe numa sexta de
ajuste comum, não precisa esperar a 1ª sexta do mês).

- Vai na sub-aba **TISS / TUSS** do FAQ (`faqtab-tiss`), que já tem o padrão de item
  com `faq-portal-link` apontando pro Validador de XML TISS.
- **Pesquisa (26/08/2026)**, fontes primárias — Medida Provisória 2.200-2/2001 (cria a
  ICP-Brasil), Lei 14.063/2020 e o Padrão TISS — Componente Organizacional (versão
  maio/2026, baixado de gov.br/ans):
  - **Assinatura eletrônica** é o termo genérico (Lei 14.063/2020): três tipos com
    validade jurídica — simples, avançada e qualificada — variando o grau de certeza
    sobre a identidade de quem assina.
  - **Assinatura digital ICP-Brasil** é o tipo qualificado: usa certificado emitido
    por Autoridade Certificadora credenciada à ICP-Brasil (MP 2.200-2/2001),
    criptografia assimétrica, presunção legal de autenticidade (art. 10 da MP).
  - **No TISS não é qualquer assinatura eletrônica que vale** — o Componente
    Organizacional (itens 23-24) veda a operadora aceitar substituto em papel do que
    é trocado eletronicamente com certificado ICP-Brasil, e exige que esse
    certificado seja do tipo **e-CNPJ** (instituição) ou **e-CPF** (quando o agente
    atua como pessoa física) — não serve assinatura eletrônica simples/avançada.
  - **Achado novo, versão maio/2026** (mudança recente, vale destacar no FAQ): a
    assinatura da mensagem "Envio de Documentos" passou de **Condicionado** (só
    quando o tipo de documento exigia, conforme Tabela de Domínio 81) para
    **Obrigatório**, independente do tipo de documento — reforça que o padrão está
    ficando mais rígido nesse ponto, não mais permissivo.
  - **Requisitos técnicos** (contexto pra quem desenvolve/audita o gerador de XML,
    não pro usuário final): padrão XAdES formato "Enveloped", política AD-RB
    (DOC-ICP-15.03 v6.1), certificado ICP-Brasil de assinatura tipo A1 a A4,
    propriedade XMLDSIG/XAdES `SigningTime`, validação de cadeia de certificação e
    estado de revogação (LCR ou OCSP) na geração e na recepção.
  - **Conexão com o que o portal já faz**: os 6 XSDs oficiais usados na validação
    estrutural (Fase 6c) incluem `tissAssinaturaDigital_v1.01.xsd` e
    `xmldsig-core-schema.xsd` — o Validador de XML TISS já confere a **estrutura**
    do bloco de assinatura quando presente no arquivo. Precisa deixar explícito no
    FAQ (mesmo padrão de ressalva usado no resto do portal) que isso **não é**
    verificação da validade criptográfica da assinatura em si (exigiria acesso à
    chave privada/cadeia de certificação, que o navegador não tem) — não substitui a
    validação feita pela operadora receptora.
  - Fontes: [MP 2.200-2/2001](https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm),
    Lei 14.063/2020, [Padrão TISS — Componente Organizacional, maio/2026](https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/PadroTISS_ComponenteOrganizacional_202605.pdf)
    (itens 23-24, 146-149, mudanças 8.25/8.27/8.31/8.32 do changelog da própria
    versão).
- **Fora do escopo, por decisão de critério (não é indecisão, é corte
  deliberado)**: atestado médico/"lei do atestado", receituário — são prática
  clínica/legal de terceiros, não faturamento; entrariam em conflito com o critério
  já fixado de "referência, sem interpretação" da expansão farmácia/enfermagem.

**Também em 11/09/2026 — infra: ativar CodeQL** (decisão do usuário, 21/08/2026):
varredura automática de segurança de código, programada pra exatamente uma semana
depois da entrega de CIHA/DMED (04/09) — código novo de parsing de arquivo de
terceiros é justamente o que mais se beneficia da varredura. É ativação de
ferramenta (Settings → Security → Code scanning → Default setup), não
desenvolvimento; não compete com o item de FAQ do mesmo dia. Tracking:
[Issue #12](https://github.com/rafael-bcode/portal-cbhpm/issues/12), milestone
"11/09 — FAQ NOTIVISA".

**18/09/2026 (sexta de ajuste) — Sinalização de risco de glosa estrutural no
Validador de XML TISS**: pedido do usuário (26/08/2026, "vamos mapear tudo que possa
auxiliar o faturista a identificar possíveis glosas que não estejam relacionadas a
contrato") — escopo explicitamente fechado pelo usuário: só **estrutura,
compatibilidade e falta de informação** derivável do próprio XML TISS padrão ANS +
bases que o portal já tem; nada de tabela negociada/contrato prestador-operadora
(decisão já fixada na Fase 3) nem pertinência clínica (julgamento médico, fora do
critério de "referência, sem interpretação" adotado na expansão farmácia/enfermagem).
Só ANS/TISS por ora — SUS fica de fora desta rodada, mas o mesmo raciocínio pode valer
pros validadores BPA/AIH/APAC depois, como frente separada.

É **ajuste do Validador de XML TISS que já existe** (não feature nova — não cria
validador novo nem tabela nova), então não precisa esperar a 1ª sexta do mês. Marca
cada achado como **⚠ "possível risco de glosa"**, nunca como erro certo — mesmo
padrão de linguagem cautelosa já usado no resto do validador — porque sempre existe
caso legítimo de exceção (ex.: "Consultor" numa cirurgia complexa é válido).

- **[Alta] Consistência interna do próprio XML** (sem depender de nenhuma base
  externa nova, só reforçar o parsing que já existe):
  - Datas incoerentes: execução fora do intervalo admissão→alta; autorização
    posterior à execução; alta anterior à admissão.
  - Duplicidade de item: mesmo código + mesma data + mesma via de acesso/lateralidade
    repetido na guia sem diferença aparente.
  - Quantidade de diária maior que os dias entre admissão e alta.
  - Mais de um grau "Cirurgião" (00) no mesmo procedimento (só pode haver um pela
    norma — os demais deveriam ser Auxiliar).
  - Taxa/diária de sala ou centro cirúrgico sem nenhum procedimento cirúrgico na
    mesma guia.
- **[Média] Grau de participação × natureza cirúrgica do procedimento** (o exemplo
  que motivou o item): cruza o grau de participação (Tabela de Domínio 35) de cada
  profissional do item contra `valores_procedimento` (mesma base que já alimenta a
  calculadora de Múltiplos Procedimentos) — **regra validada em 26/08/2026 direto no
  banco de produção**: `porte_anestesico IS NOT NULL AND porte_anestesico <> '0'` OU
  `numero_auxiliares > 0` separa corretamente os ~2.476 códigos genuinamente
  cirúrgicos (ex.: 30205069 Amigdalectomia lingual, 30731208 Tenotomia) dos ~2.401
  não-cirúrgicos (ex.: 10102027 Visita/consulta hospitalar, 10106170 Consulta
  ocupacional — ambos com `porte_anestesico null` e `numero_auxiliares 0`). Sinaliza
  quando um procedimento cirúrgico não tem nenhum profissional em grau "Cirurgião"
  (00), ou quando um procedimento sem porte cirúrgico/anestésico tem alguém em grau
  "Cirurgião" lançado. Esforço médio: a lógica em si é simples, o cuidado maior é
  redigir o texto de alerta pra não soar como acusação de erro certo.
- **Pesquisado e não localizado (26/08/2026) — não é candidato por ora**:
  compatibilidade procedimento×CID e procedimento×OPME do lado TUSS/ANS, equivalente
  ao que o SIGTAP tem (`rl_procedimento_cid`, `rl_procedimento_compativel`, já usados
  nas Fases 8 e no candidato de 04/09). Busca não achou uma tabela pública
  estruturada nesse sentido — só a "Tabela de Compatibilização TUSS-SIP", que serve
  outro propósito (mapear código TUSS pro item de envio obrigatório ao SIP da ANS,
  não compatibilidade clínica procedimento-CID). Fica de fora até aparecer fonte
  melhor — revisitar se o usuário achar/tiver acesso a algo assim futuramente.

**02/10/2026 (1ª sexta de outubro) — Fase 10: Farmácia (segurança do paciente e do
trabalhador)**: **decisão do usuário em 20/08/2026** — data fechada pra essa entrega
específica (não é só uma sinalização de overflow como o resto de setembro). Entre
hoje e 02/10, o trabalho é **levantar e guardar os documentos-fonte** (as 3 listas
MPP/MAV do ISMP Brasil, o Protocolo de Segurança na Prescrição/Uso/Administração de
Medicamentos, o texto da NR-32) pra depois estruturar o conteúdo — mesmo método que
funcionou bem pro CIHA (arquivo/documento fonte primeiro, estrutura de dado depois).
Se sobrar algum item de 04/09 sem terminar a tempo, entra também nessa data.
Também entra aqui o **mini-projeto de dados da classificação Portaria 344/98 (A1-F2)
na CMED** (decisão de 21/08/2026, ver detalhe na seção "[Baixa] Mostrar a
classificação... na Consulta de Medicamentos" acima) — levantamento das RDCs
posteriores a 2016 e aplicação sobre o baseline compilado, com origem e vigência de
cada dado documentadas no próprio portal.

## Frentes transversais de suporte a profissionais de saúde (pesquisa 21/08/2026)

**Contexto**: o usuário perguntou (21/08/2026) o que mais dá pra incluir — FAQ,
pesquisa ou validação — na transição do portal de "suporte a faturamento" pra
"suporte a profissionais de saúde de modo geral". Resposta: não abrir profissão
nova ainda (Farmácia e Enfermagem nem saíram do papel — mantém a regra de "um
módulo de cada vez"), e sim reforçar conteúdo **transversal**, que serve mais de um
público ao mesmo tempo, com baixo esforço. Três frentes identificadas, cada uma com
esforço e encaixe de data avaliados abaixo.

- **[Alta]** **FAQ: NOTIVISA (Sistema de Notificações em Vigilância Sanitária,
  ANVISA)** — pesquisado e confirmado em 21/08/2026. É o sistema oficial pra
  notificar eventos adversos (EA) e queixas técnicas (QT) de medicamentos e outros
  produtos/serviços sob vigilância sanitária. Base legal: **Portaria MS nº 1.660, de
  22/07/2009**. Pode notificar: profissionais de serviços de saúde, empresas
  detentoras de registro, e também cidadãos (paciente/familiar/cuidador) via
  formulário simplificado. Portal oficial: `notivisa.anvisa.gov.br` (área
  profissional, com cadastro/login) e `www16.anvisa.gov.br/notivisaServicos/cidadao/
  notificacao/evento-adverso` (formulário direto pro cidadão, sem cadastro). Serve
  como **conteúdo transversal** — útil pra Farmácia (erro de medicação), Enfermagem
  (evento adverso na administração) e Medicina, não é exclusivo de nenhuma das
  fases já planejadas. **Esforço: baixo** — é um item de FAQ com link oficial,
  mesmo padrão já usado nos itens de "onde consultar" (CIHA/DMED). Não precisa
  esperar feature nova nem entrar só no dia 1ª-sexta-do-mês porque não é código
  novo (banco, importador, endpoint) — é conteúdo, então cabe numa sexta de ajuste
  comum.
  - **Agendado pra 11/09/2026** (sexta de ajuste, a primeira sexta livre depois do
    pacote de 04/09 — que é feature nova de peso: CIHA + DMED + Compatibilidade — e
    depois do já fechado/testado de 28/08). Sem dependência de nenhum outro item.

- **[Média]** **NR-32 como seção transversal, não só dentro de Farmácia** — hoje a
  NR-32 (segurança do trabalhador em serviços de saúde) está pesquisada e
  encaixada só no escopo da Fase 10 (Farmácia). Mas a norma vale pra qualquer
  profissional de saúde, não só farmacêutico — enfermagem, medicina, etc. também
  são "trabalhador de serviço de saúde" pra efeito da NR-32. **Esforço: quase zero**
  — o conteúdo já está pesquisado e baixado (`NR-32_atualizada_2022.pdf`, ver Fase
  10 abaixo); é só uma decisão de estrutura (seção própria de "segurança do
  trabalhador da saúde", referenciada por Farmácia e por Enfermagem, em vez de
  duplicar ou prender só numa aba). **Não precisa de data própria** — é um detalhe
  de implementação a decidir junto da Fase 10 (02/10/2026), sem mudar o escopo já
  fechado pra essa entrega.

- ~~**Completar os protocolos PNSP pendentes (Higiene das Mãos e Identificação do
  Paciente)**~~ — **✅ resolvido em 21/08/2026, os 6 dos 6 protocolos do PNSP estão
  garantidos**:
  - **Higiene das Mãos**: lido por completo (`Protocolo_Higiene_Maos.pdf`, 16 págs.,
    Anexo 01, MS/Anvisa/Fiocruz, 09/07/2013) — "Meus 5 Momentos", técnica de
    higienização simples/antisséptica/fricção alcoólica passo a passo, Estratégia
    Multimodal da OMS, indicadores.
  - **Identificação do Paciente**: bloqueio de download **resolvido** — o link
    original (ANVISA) continuava quebrado, mas o mesmo documento oficial (Anexo 02,
    MS/Anvisa/Fiocruz) está espelhado pela Secretaria de Saúde de Mato Grosso
    (saude.mt.gov.br), que serviu o PDF genuíno sem bloqueio. Lido por completo: uso
    obrigatório de pulseira branca com no mínimo 2 identificadores, especificações
    técnicas da pulseira (cor, tamanho, conforto, durabilidade), procedimento de
    confirmação antes de qualquer cuidado, casos especiais (recém-nascido,
    transferência, paciente sem identidade disponível).
  - Conteúdo já pronto pra entrar no escopo da Fase 11 (06/11/2026) sem risco de
    pesquisa pendente — só falta estruturar como FAQ quando a data chegar.

## Fase 10 — Nova direção estratégica: Farmácia (segurança do paciente e do
trabalhador) — pesquisa feita em 20/08/2026, sem data de implementação ainda

**Contexto**: o usuário levantou (20/08/2026) se vale o esforço, num horizonte não
tão longo, de o portal deixar de ser só suporte a faturamento (CBHPM/SUS/TISS/glosas/
validações) e passar a apoiar outros profissionais — começando por farmácia clínica,
depois enfermagem, um módulo de cada vez pra ficar robusto. Concordamos numa linha
segura: **o portal só reproduz conteúdo de referência oficial (lista/protocolo tal
como publicado), sem gerar interpretação ou orientação clínica própria** — o mesmo
princípio que já rege CID-10/SIGTAP/CBHPM/OPME hoje, aplicado a um domínio novo.
Confirmado com o usuário que essa é a abordagem (não interpretação/geração própria),
o que reduz bastante o risco de responsabilidade — mas o domínio ainda é
categoricamente diferente do resto do portal: errar em dado administrativo custa
glosa (prejuízo financeiro); errar em segurança do paciente pode causar dano real.

**Decisão de escopo (20/08/2026)**: diferente dos outros validadores do portal, essa
frente **não vai ter upload/validação de arquivo** — o usuário confirmou que é conteúdo
de FAQ, e opcionalmente uma **consulta** a algum portal oficial gratuito e confiável
(ex: busca por NR, busca por norma da ANVISA), se eu achar um candidato bom o
suficiente durante a pesquisa. Achei um: ver "Candidato de consulta" no fim desta
seção.

### Duas frentes confirmadas (complementares, não concorrentes)

**1. Segurança do paciente — Medicamentos de Alta Vigilância (MAV) / Potencialmente
Perigosos (MPP)**
- **Base legal confirmada e refinada**: RDC nº 36/2013 (ANVISA, institui ações de
  segurança do paciente em serviços de saúde) + Portaria MS nº 529/2013 (institui o
  PNSP) dão o arcabouço geral; o ato específico que **aprova o próprio Protocolo de
  Segurança na Prescrição, Uso e Administração de Medicamentos** é a **Portaria MS nº
  2.095, de 24/09/2013 (Anexo 03)** — confirmado direto nas referências bibliográficas
  dos dois boletins do ISMP Brasil lidos hoje (não é achado de terceiro, é a fonte
  primária citando a norma). É esse protocolo que detalha a exigência de **dupla
  checagem independente e simultânea** pra MAV.
- **Listas oficiais — conteúdo já extraído por completo em 20/08/2026** (não é mais
  só "fonte mapeada", é conteúdo em mãos): baixados e lidos na íntegra os 2 boletins
  do ISMP Brasil (pasta `fontes-farmacia/`, não versionada — mesmo tratamento dos
  arquivos CIHA/DMED):
  - `ISMP_MPP_Hospitalar_2019.pdf` (9 págs.) — lista completa de uso hospitalar
    (classes terapêuticas + medicamentos específicos) **e** as 10 recomendações de
    segurança pra prevenção de erros (barreiras, protocolos, redução de alternativas
    farmacêuticas, centralização, dupla checagem, alertas automáticos, acesso à
    informação, minimizar consequência, monitoramento de indicadores).
  - `ISMP_MPP_Ambulatorial_ILPI_2022.pdf` (9 págs.) — as duas listas 2022 (uso
    ambulatorial **e** instituições de longa permanência) completas, mais o
    detalhamento das mudanças em relação à versão anterior e o mesmo quadro de 10
    recomendações adaptado a esses contextos.
  - `Portaria_MS_2095_2013.pdf` também baixado (o Anexo 03/protocolo em si, fonte
    primária da dupla checagem) — ainda não lido linha a linha, próximo passo.

  **Listas completas, transcritas na íntegra em 20/08/2026 (não depende do PDF
  local sobreviver — o conteúdo de verdade está aqui):**

  ***Lista MPP — Uso Hospitalar (2019):***
  *Classes terapêuticas:* agonistas adrenérgicos endovenosos (ex.: epinefrina,
  fenilefrina, norepinefrina) · água estéril para injeção/inalação/irrigação em
  embalagens ≥100 mL · analgésicos opioides endovenosos, transdérmicos e orais
  (incl. líquidos concentrados e liberação prolongada) · anestésicos gerais,
  inalatórios e endovenosos (ex.: propofol, cetamina) · antagonistas adrenérgicos
  endovenosos (ex.: propranolol, metoprolol) · antiarrítmicos endovenosos (ex.:
  lidocaína, amiodarona) · antineoplásicos de uso oral e parenteral ·
  antitrombóticos (anticoagulantes: varfarina, heparinas; anticoagulantes orais
  diretos/inibidores do fator Xa: dabigatrana, rivaroxabana, apixabana, edoxabana,
  fondaparinux; inibidores diretos da trombina: bivalirrudina; inibidores da
  glicoproteína IIb/IIIa: abciximabe, tirofibana; trombolíticos: alteplase,
  tenecteplase, estreptoquinase) · bloqueadores neuromusculares (ex.: suxametônio,
  rocurônio, pancurônio, vecurônio) · cloreto de sódio hipertônico injetável
  >0,9% · glicose hipertônica ≥20% · inotrópicos endovenosos (ex.: milrinona,
  deslanosídeo, levosimendana) · insulina subcutânea e endovenosa (todas
  formas/vias) · medicamentos por via epidural ou intratecal · medicamentos
  lipossomais e seus correspondentes convencionais (ex.: anfotericina B) ·
  sedativos orais mínimo/moderado pra crianças (ex.: hidrato de cloral, midazolam,
  cetamina parenteral) · sedativos endovenosos moderados (ex.: dexmedetomidina,
  midazolam, lorazepam) · soluções cardioplégicas · soluções pra diálise
  peritoneal/hemodiálise · soluções de nutrição parenteral · sulfonilureias orais
  (ex.: clorpropamida, glimepirida, glibenclamida, glipizida).
  *Medicamentos específicos:* cloreto de potássio concentrado injetável ·
  epinefrina subcutânea · fosfato de potássio injetável · metotrexato oral (uso
  não oncológico) · nitroprussiato de sódio injetável · ocitocina endovenosa ·
  prometazina injetável · sulfato de magnésio injetável · vasopressina endovenosa
  e intraóssea.

  ***Lista MPP — Uso Ambulatorial (2022):***
  *Classes terapêuticas:* analgésicos opioides endovenosos/transdérmicos/orais ·
  antineoplásicos, exceto hormonais (oral/parenteral; terapia alvo/imunoterapia,
  ex.: palbociclibe, imatinibe, nivolumabe) · antitrombóticos orais/parenterais
  (varfarina, heparinas; anticoagulantes orais diretos: rivaroxabana, apixabana,
  edoxabana; inibidores diretos da trombina: dabigatrana) · imunossupressores
  orais/parenterais (ex.: azatioprina, ciclosporina, tacrolimo) · insulina
  subcutânea/endovenosa · medicamentos contraindicados na gestação (ex.:
  bosentana, isotretinoína, talidomida) · medicamentos pediátricos líquidos que
  requerem medição · sedativos orais mínimo/moderado pra crianças (hidrato de
  cloral, midazolam, cetamina) · sulfonilureias (ex.: glimepirida, glibenclamida).
  *Medicamentos específicos:* ácido valpróico · carbamazepina · epinefrina
  (intramuscular e subcutânea) · fenitoína · lamotrigina · metotrexato oral e
  parenteral (uso não oncológico).

  ***Lista MPP — Instituições de Longa Permanência (2022):***
  *Classes terapêuticas:* analgésicos opioides endovenosos/transdérmicos/orais ·
  análogos de GABA pra dor neuropática (ex.: gabapentina, pregabalina) ·
  antineoplásicos, exceto hormonais (oral/parenteral; terapia alvo/imunoterapia,
  ex.: palbociclibe, imatinibe, dasatinibe) · antiparkinsonianos (incl.
  carbidopa, levodopa e combinações) · antitrombóticos (varfarina, heparinas;
  anticoagulantes orais diretos: rivaroxabana, apixaban, edoxaban; inibidores
  diretos da trombina: dabigatrana) · imunossupressores (ex.: azatioprina,
  ciclosporina, ciclofosfamida, tacrolimo, adalimumabe) · insulina
  subcutânea/endovenosa · soluções de nutrição parenteral · sulfonilureias (ex.:
  glimepirida, glibenclamida).
  *Medicamentos específicos:* digoxina · epinefrina (intramuscular e subcutânea) ·
  fenitoína · metotrexato oral e parenteral (uso não oncológico) · sacubitril +
  valsartana.

  As 3 listas seguem a mesma lógica de organização: **classe terapêutica**
  (todo integrante da classe é MPP) vs. **medicamento específico** (só aquele
  item é MPP, mesmo sem o resto da classe ser). Fonte primária: ISMP Brasil,
  adaptação da lista do ISMP EUA (ISMP MERP + revisão de literatura + consulta a
  especialistas), financiado pela Anvisa via OPAS.

  **10 recomendações de segurança (Quadro 2 do boletim 2019, adaptado no de
  2022) — resumo aplicável a qualquer uma das 3 listas:**
  1. Implantar barreiras que reduzam/dificultem/eliminem erro (seringas orais não
     adaptáveis a sistema EV; etiqueta de alerta em KCl concentrado e alcaloides
     da vinca).
  2. Adotar protocolos claros e detalhados (múltiplas barreiras, padronização de
     dose, protocolos pra antineoplásico/cirurgia/UTI/anticoagulação).
  3. Revisar continuamente a padronização (evitar erro por nome/rótulo/embalagem
     parecidos).
  4. Reduzir o número de apresentações do mesmo medicamento disponíveis.
  5. Centralizar o preparo de misturas EV com MPP na farmácia (reduz interrupção,
     erro de cálculo, falta de padronização).
  6. Dupla checagem independente nos pontos mais vulneráveis (cálculo de dose
     pediátrica/idoso, bomba de infusão, quimioterápico).
  7. Alertas automáticos em sistema informatizado (prescrição eletrônica com
     suporte clínico, alerta de dose/diluição/alergia).
  8. Melhorar acesso à informação (treinamento, lista de MPP divulgada, dose
     máxima, orientação ao paciente/família/cuidador).
  9. Protocolos pra minimizar consequência do erro (comunicação de evento adverso
     — disclosure inicial e final).
  10. Monitorar desempenho via indicadores do PNSP + indicadores complementares.
- **Bulário Eletrônico da ANVISA (bula/interação) — descartado por ora**: existe um
  portal de API (`api.anvisa.gov.br`) mas sem documentação pública aberta, e o
  Bulário (`consultas.anvisa.gov.br/#/bulario`) está **ativamente protegido por
  Cloudflare contra automação** (confirmado tecnicamente em 20/08/2026, inspecionando
  as chamadas de rede reais do site com Playwright — a página só devolveu chamadas de
  challenge anti-bot, nenhum endpoint de dado). É por isso que só existem serviços
  pagos de terceiro (Infosimples e similares) oferecendo essa consulta. **Diluição,
  interação medicamentosa e conteúdo de bula ficam fora de escopo** — não tem fonte
  gratuita/estruturada acessível, e forçar contornar a proteção não é um caminho
  aceitável nem alinhado com a decisão de escopo (sem validação/consulta complexa,
  só FAQ + índice simples).

**2. Segurança do trabalhador — NR-32** (ponto levantado pelo próprio usuário, ao
notar que "nada impede que a gente fale da segurança dos profissionais também")
- **Base legal**: Norma Regulamentadora nº 32 (NR-32), Ministério do Trabalho e
  Emprego — diferente do PNSP/ANVISA (que protege o **paciente**), a NR-32 protege
  **quem manuseia** o medicamento/material biológico no serviço de saúde.
- **Conteúdo confirmado**: risco biológico/químico/físico; Plano de Prevenção de
  Riscos de Acidentes com Materiais Perfurocortantes (obrigatório); imunização ativa
  gratuita obrigatória (tétano, difteria, hepatite B + o que o PCMSO da instituição
  exigir); capacitação em mecânica corporal na movimentação de pacientes/materiais;
  diretrizes de higiene/limpeza/descontaminação pra controle de infecção.
- `NR-32_atualizada_2022.pdf` baixado (texto integral oficial, gov.br/trabalho-e-
  emprego) — sem barreira técnica (diferente do Bulário), ainda não lido linha a
  linha.

### Candidato de consulta: índice de Normas Regulamentadoras (NR-1 a NR-38)

Pedido pelo usuário (20/08/2026): já que não vai ter validação de arquivo nessa
frente, sugerir uma consulta a portal oficial gratuito se eu achar um bom candidato
na pesquisa. Achei: o Ministério do Trabalho mantém, em
gov.br/trabalho-e-emprego, a lista oficial das **38 Normas Regulamentadoras**
(NR-1 a NR-38, com a NR-2 e a NR-27 revogadas — 36 ativas), cada uma com link
próprio, página atualizada em 08/10/2024, **sem proteção anti-bot** (diferente do
Bulário). É pequeno, estável e público — dá pra montar um índice simples (número +
título + link oficial) no mesmo espírito das Tabelas TISS/CID-10 que o portal já
tem, sem precisar de scraping pesado nem risco de quebrar. Pra esse portal, as mais
relevantes seriam as ligadas a serviço de saúde: **NR-32** (segurança em serviços de
saúde), **NR-6** (EPI), **NR-7** (PCMSO), **NR-9** (riscos ambientais/PGR), **NR-15**
(insalubridade), **NR-17** (ergonomia) — mas o índice completo das 36 pode entrar
igual, é barato de manter. Não pesquisei ainda um equivalente pra normas da ANVISA
(a busca de legislação da ANVISA existe em gov.br/anvisa/.../legislacao, mas não
testei se tem a mesma estabilidade/ausência de proteção que o portal do MTE tem —
próximo passo de pesquisa, não confiar sem checar depois do que aconteceu com o
Bulário).

### Status: documentos-fonte levantados, aguardando 02/10/2026

**Decisão do usuário em 20/08/2026**: essa frente entra especificamente em
**02/10/2026** (1ª sexta de outubro) — não é mais só sinalização de overflow, é data
fechada. Entre hoje e lá, o trabalho é justamente esse: levantar e guardar os
documentos-fonte antes de estruturar o conteúdo — **parte considerável já feita**:
4 documentos baixados (`fontes-farmacia/`), 2 deles já lidos e com conteúdo
integralmente extraído (as 3 listas MPP completas + as recomendações de segurança).
Falta: ler a Portaria 2.095/2013 e a NR-32 linha a linha, e confirmar se vale
pesquisar a busca de legislação da ANVISA como consulta adicional. Enfermagem (fase
seguinte, mencionada pelo usuário) fica só registrada como direção declarada — sem
pesquisa ainda, só entra depois da farmácia estar robusta.

Fontes: [RDC nº 36/2013 — ANVISA](https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/publicacoes/protocolo-de-seguranca-na-prescricao-uso-e-administracao-de-medicamentos), [Protocolo de Segurança na Prescrição, Uso e Administração de Medicamentos — Proqualis/Fiocruz](https://proqualis.fiocruz.br/protocolo/protocolo-de-seguranca-na-prescricao-uso-e-administracao-de-medicamentos), [Medicamentos Potencialmente Perigosos — ISMP Brasil](https://ismp-brasil.org/boletins/medicamentos-potencialmente-perigosos/), [Norma Regulamentadora nº 32 — Ministério do Trabalho e Emprego](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-32-nr-32)

## Fase 11 — Nova direção estratégica: Enfermagem — pesquisa feita em 20/08/2026,
entrega prevista 06/11/2026

**Contexto**: sequência natural da Fase 10 (Farmácia) — o usuário pediu (20/08/2026)
pra já pesquisar tudo que for válido pro módulo de Enfermagem: cuidados, legislação,
documentos, rotinas, e principalmente **o que faz parte das atribuições de cada
categoria de enfermagem e o que não faz** (a linha que mais gera dúvida/risco
jurídico na prática). Mesmo escopo e mesma régua de segurança da Farmácia: **sem
validação de arquivo, conteúdo de referência oficial reproduzido, sem interpretação
clínica própria**. Data pedida: 06/11/2026 — confirmado que é a 1ª sexta-feira de
novembro, batendo certinho com a regra "feature nova só na 1ª sexta do mês" (sem
conflito de calendário, diferente do que aconteceu com CIHA/DMED).

### 1. Atribuições — o que é de cada categoria (o pedido central do usuário)

**Base legal, já baixada e com os artigos-chave extraídos literalmente** (não é
resumo de terceiro — é o texto exato da lei/decreto, `fontes-enfermagem/`, git-
ignored por serem documentos grandes de referência):
- **Lei nº 7.498/1986** (`Lei_7498_86.html`) — arts. 11 a 15 e 15-A.
- **Decreto nº 94.406/1987** (`Decreto_94406_87.html`, regulamenta a Lei 7.498) —
  arts. 8 a 15, com o detalhamento mais granular.

Estrutura confirmada (a mesma lógica em ambos, o Decreto é mais detalhado):
- **Enfermeiro — privativo** (art. 8º/I do Decreto, art. 11/I da Lei): direção do
  órgão/serviço de enfermagem; planejamento, organização, coordenação, execução e
  avaliação da assistência de enfermagem; consultoria, auditoria e parecer em
  matéria de enfermagem; **consulta de enfermagem**; **prescrição da assistência de
  enfermagem**; cuidados diretos a pacientes graves com risco de vida; cuidados de
  maior complexidade técnica.
- **Enfermeiro — como integrante da equipe de saúde** (art. 8º/II, art. 11/II): aqui
  mora um limite importante — **prescrição de medicamentos** só é atribuição do
  enfermeiro quando **previamente estabelecidos em programas de saúde pública e em
  rotina aprovada pela instituição** (não é prescrição médica geral); participação
  em vigilância epidemiológica, controle de infecção hospitalar, assistência
  obstétrica (parto sem distocia), educação em saúde.
- **Enfermeira Obstétrica/Obstetriz** (art. 9º do Decreto): assistência ao parto
  normal, identificação de distocias, episiotomia/episiorrafia com anestesia local.
- **Técnico de Enfermagem** (art. 10 do Decreto, art. 12 da Lei): nível médio,
  **assiste o Enfermeiro** (planejamento, cuidados a pacientes graves, vigilância
  epidemiológica, controle de infecção) e **executa o que não é privativo do
  Enfermeiro**.
- **Auxiliar de Enfermagem** (art. 11 do Decreto, art. 13 da Lei) — a lista mais
  detalhada e mais prática de todas: preparar paciente pra consulta/exame; observar
  e descrever sinais e sintomas; **ministrar medicamentos por via oral e
  parenteral**; controle hídrico; curativos; oxigenoterapia, nebulização,
  enteroclisma; conservação e aplicação de vacinas; controle de comunicantes em
  doenças transmissíveis; colher material pra exame laboratorial; cuidados pré/pós-
  operatórios; **circular em sala de cirurgia e, se necessário, instrumentar**
  (conecta direto com o Protocolo de Cirurgia Segura, ver seção 3); desinfecção e
  esterilização; higiene/conforto/segurança do paciente; participar de
  procedimentos pós-morte.
- **Parteiro** (art. 12 do Decreto): cuidados à gestante/parturiente, parto normal
  (inclusive domiciliar), puérpera e recém-nascido — sob supervisão de Enfermeiro
  Obstetra quando em instituição de saúde.
- **Regra de supervisão** (art. 13 do Decreto, art. 15 da Lei): as atividades de
  Técnico e Auxiliar **só podem ser exercidas sob supervisão, orientação e direção
  de Enfermeiro** — é a linha jurídica mais citada em disputa de atribuição.
- **Registro obrigatório** (art. 15 do Decreto): inscrição no Conselho Regional de
  Enfermagem (COREN) da região é condição essencial pra provimento de cargo/
  contratação, em qualquer grau.
- **Achado extra, fora do pedido original mas relevante**: art. 15-A da Lei
  (incluído pela Lei nº 14.434/2022) fixa o **piso salarial nacional do Enfermeiro
  CLT em R$ 4.750,00**, com Técnico em 70% e Auxiliar em 50% desse valor — dado
  prático que pode virar FAQ próprio (fora do escopo de "atribuições", mas do mesmo
  domínio legal).

**Texto literal do Decreto 94.406/87, transcrito em 20/08/2026 (fonte primária,
não depende do arquivo local sobreviver):**

> **Art. 8º** Ao Enfermeiro incumbe: **I - privativamente**: a) direção do órgão de
> enfermagem integrante da estrutura básica da instituição de saúde, pública ou
> privada, e chefia de serviço e de unidade de enfermagem; b) organização e
> direção dos serviços de enfermagem e de suas atividades técnicas e auxiliares
> nas empresas prestadoras desses serviços; c) planejamento, organização,
> coordenação, execução e avaliação dos serviços da assistência de enfermagem;
> d) consultoria, auditoria e emissão de parecer sobre matéria de enfermagem;
> e) consulta de enfermagem; f) prescrição da assistência de enfermagem; g)
> cuidados diretos de enfermagem a pacientes graves com risco de vida; h)
> cuidados de enfermagem de maior complexidade técnica e que exijam conhecimentos
> científicos adequados e capacidade de tomar decisões imediatas. **II - como
> integrante de equipe de saúde**: a) participação no planejamento, execução e
> avaliação da programação de saúde; b) participação na elaboração, execução e
> avaliação dos planos assistenciais de saúde; c) **prescrição de medicamentos
> previamente estabelecidos em programas de saúde pública e em rotina aprovada
> pela instituição de saúde**; d) participação em projetos de construção ou
> reforma de unidades de internação; e) prevenção e controle sistemático da
> infecção hospitalar, inclusive como membro das respectivas comissões; f)
> participação na elaboração de medidas de prevenção e controle sistemático de
> danos que possam ser causados aos pacientes durante a assistência de
> enfermagem; g) participação na prevenção e controle das doenças transmissíveis
> em geral e nos programas de vigilância epidemiológica; h) prestação de
> assistência de enfermagem à gestante, parturiente, puérpera e ao recém-nascido;
> i) participação nos programas e nas atividades de assistência integral à saúde
> individual e de grupos específicos, particularmente daqueles prioritários e de
> alto risco; j) acompanhamento da evolução e do trabalho de parto; l) execução e
> assistência obstétrica em situação de emergência e execução do parto sem
> distocia; m) participação em programas e atividades de educação sanitária; n)
> participação nos programas de treinamento e aprimoramento de pessoal de saúde;
> o) participação nos programas de higiene e segurança do trabalho e de
> prevenção de acidentes e de doenças profissionais e do trabalho; p)
> participação na elaboração e na operacionalização do sistema de referência e
> contra-referência do paciente; q) participação no desenvolvimento de
> tecnologia apropriada à assistência de saúde; r) participação em bancas
> examinadoras em matérias específicas de enfermagem.
>
> **Art. 9º** Às profissionais titulares de diploma ou certificados de Obstetriz
> ou de Enfermeira Obstétrica, além das atividades de que trata o artigo
> precedente, incumbe: I - prestação de assistência à parturiente e ao parto
> normal; II - identificação das distocias obstétricas e tomada de providência
> até a chegada do médico; III - realização de episiotomia e episiorrafia, com
> aplicação de anestesia local, quando necessária.
>
> **Art. 10.** O Técnico de Enfermagem exerce as atividades auxiliares, de nível
> médio técnico, atribuídas à equipe de enfermagem, cabendo-lhe: **I - assistir
> ao Enfermeiro**: a) no planejamento, programação, orientação e supervisão das
> atividades de assistência de enfermagem; b) na prestação de cuidados diretos de
> enfermagem a pacientes em estado grave; c) na prevenção e controle das doenças
> transmissíveis em geral em programas de vigilância epidemiológica; d) na
> prevenção e no controle sistemático da infecção hospitalar; e) na prevenção e
> controle sistemático de danos físicos que possam ser causados a pacientes
> durante a assistência de saúde; f) na execução dos programas referidos nas
> letras i e o do item II do art. 8º. **II** - executar atividades de assistência
> de enfermagem, excetuadas as privativas do enfermeiro e as referidas no art. 9º.
> **III** - integrar a equipe de saúde.
>
> **Art. 11.** O Auxiliar de Enfermagem executa as atividades auxiliares, de
> nível médio, atribuídas à equipe de enfermagem, cabendo-lhe: **I** - preparar o
> paciente para consultas, exames e tratamentos; **II** - observar, reconhecer e
> descrever sinais e sintomas, ao nível de sua qualificação; **III** - executar
> tratamentos especificamente prescritos, ou de rotina, além de outras atividades
> de enfermagem, tais como: a) ministrar medicamentos por via oral e parenteral;
> b) realizar controle hídrico; c) fazer curativos; d) aplicar oxigenoterapia,
> nebulização, enteroclisma, enema e calor ou frio; e) executar tarefas
> referentes à conservação e aplicação de vacinas; f) efetuar o controle de
> pacientes e de comunicantes em doenças transmissíveis; g) realizar testes e
> proceder à sua leitura, para subsídio de diagnóstico; h) colher material para
> exames laboratoriais; i) prestar cuidados de enfermagem pré e pós-operatórios;
> j) circular em sala de cirurgia e, se necessário, instrumentar; l) executar
> atividades de desinfecção e esterilização. **IV** - prestar cuidados de higiene
> e conforto ao paciente e zelar por sua segurança, inclusive: a) alimentá-lo ou
> auxiliá-lo a alimentar-se; b) zelar pela limpeza e ordem do material, de
> equipamentos e de dependências de unidades de saúde. **V** - integrar a equipe
> de saúde. **VI** - participar de atividades de educação em saúde, inclusive:
> a) orientar os pacientes na pós-consulta, quanto ao cumprimento das prescrições
> de enfermagem e médicas; b) auxiliar o Enfermeiro e o Técnico de Enfermagem na
> execução dos programas de educação para a saúde. **VII** - executar os
> trabalhos de rotina vinculados à alta de pacientes. **VIII** - participar dos
> procedimentos pós-morte.
>
> **Art. 12.** Ao Parteiro incumbe: I - prestar cuidados à gestante e à
> parturiente; II - assistir ao parto normal, inclusive em domicílio; III -
> cuidar da puérpera e do recém-nascido. *Parágrafo único.* As atividades de que
> trata este artigo são exercidas sob supervisão de Enfermeiro Obstetra, quando
> realizadas em instituições de saúde, e, sempre que possível, sob controle e
> supervisão de unidade de saúde, quando realizadas em domicílio.
>
> **Art. 13.** As atividades relacionadas nos arts. 10 e 11 somente poderão ser
> exercidas sob supervisão, orientação e direção de Enfermeiro.
>
> **Art. 14.** Incumbe a todo o pessoal de enfermagem: I - cumprir e fazer
> cumprir o Código de Deontologia da Enfermagem; II - quando for o caso, anotar
> no prontuário do paciente as atividades da assistência de enfermagem, para
> fins estatísticos.
>
> **Art. 15.** Na administração pública direta e indireta [...] será exigida
> como condição essencial para provimento de cargos e funções e contratação de
> pessoal de enfermagem, de todos os graus, a prova de inscrição no Conselho
> Regional de Enfermagem da respectiva região.

**Da Lei nº 7.498/1986** (redação equivalente, mais o art. 15-A que só existe na
Lei, incluído pela Lei nº 14.434/2022):

> **Art. 15-A.** O piso salarial nacional dos Enfermeiros contratados sob o
> regime da CLT [...] será de **R$ 4.750,00 (quatro mil setecentos e cinquenta
> reais) mensais**. *Parágrafo único.* O piso salarial dos profissionais
> celetistas [...] é fixado com base no piso estabelecido no caput [...], na
> razão de: I - **70%** para o Técnico de Enfermagem; II - **50%** para o
> Auxiliar de Enfermagem.

### 2. Código de Ética dos Profissionais de Enfermagem (COFEN 564/2017)

Baixado (`COFEN_Codigo_Etica_564_2017.pdf`), ainda não lido linha a linha — próximo
passo antes de novembro. Confirmado por pesquisa: aplica-se a Enfermeiros, Técnicos,
Auxiliares, Obstetrizes, Parteiras e Atendentes de Enfermagem; princípios centrais
são dignidade, autonomia, sigilo, responsabilidade e justiça; revogou a Resolução
COFEN 311/2007.

### 3. Achado extra valioso: 6 dos 6 protocolos do PNSP garantidos e extraídos por
completo (atualizado em 21/08/2026)

Ao baixar a Portaria MS 2.095/2013 pra confirmar a base legal da Farmácia (Fase 10),
o arquivo baixado (`fontes-farmacia/Portaria_MS_2095_2013.pdf`) revelou ser uma
**compilação com vários protocolos do PNSP**, não só o de medicamentos — os que
vieram junto são **centrais pra Enfermagem**, então entram aqui. Fui atrás dos
outros 3 do total de 6 na sequência (`fontes-enfermagem/`):

- **Protocolo de Cirurgia Segura** — ✅ extraído por completo. Baseado na Lista de
  Verificação de Cirurgia Segura da OMS, dividida em 3 fases (antes da indução
  anestésica, antes da incisão/"Pausa Cirúrgica", antes de sair da sala) — passo a
  passo completo de cada fase já extraído. O "condutor da lista de verificação" pode
  ser médico **ou profissional de enfermagem**; a contagem final de compressas/
  instrumentais e a identificação de amostra patológica são explicitamente
  atribuição do **profissional de enfermagem/instrumentador**.
- **Protocolo de Prevenção de Úlcera por Pressão (UPP)** — ✅ extraído por completo.
  As 6 etapas essenciais (avaliação na admissão via Escala de Braden/Braden Q,
  reavaliação diária, inspeção diária da pele, manejo de umidade, otimização
  nutricional, minimizar pressão), classificação de risco (baixo/moderado/alto/muito
  alto) com medidas por faixa, e o estadiamento oficial de UPP (estágio I a IV +
  inclassificável + suspeita de lesão profunda). O texto confirma expressamente:
  **"a avaliação e a prescrição de cuidados com a pele é uma atribuição do
  enfermeiro"** — conecta direto com a seção 1 (Lei 7.498/86).
- **Protocolo de Prevenção de Quedas** (`Protocolo_Prevencao_Quedas.pdf`, Anexo 01,
  fonte oficial direta gov.br/anvisa) — ✅ baixado e extraído por completo. Fatores
  de risco detalhados (demográfico, cognitivo, clínico, medicamentos — inclusive
  lista de classes que aumentam risco de queda), classificação alto/baixo risco,
  tabelas de medidas específicas por fator de risco pra adulto **e** pediátrico,
  procedimentos operacionais e indicadores (índice de quedas por paciente-dia).
- **Protocolo para Higiene das Mãos** (`Protocolo_Higiene_Maos.pdf`, 16 págs., Anexo
  01, 09/07/2013) — ✅ extraído por completo em 21/08/2026: "Meus 5 Momentos" pra
  higiene das mãos, as 3 técnicas (simples/antisséptica/fricção alcoólica) passo a
  passo com tempos mínimos, Estratégia Multimodal da OMS (5 componentes), indicadores
  obrigatórios (consumo de preparação alcoólica e sabonete por 1.000 pacientes-dia).
- **Protocolo de Identificação do Paciente** (Anexo 02) — ✅ **bloqueio resolvido e
  extraído por completo em 21/08/2026**. As duas tentativas anteriores (biblioteca
  digital Anvisa, mirror www20) devolviam página HTML em vez do PDF; o mesmo
  documento oficial (MS/Anvisa/Fiocruz) foi localizado espelhado pela Secretaria de
  Saúde de Mato Grosso (saude.mt.gov.br), que serviu o arquivo genuíno. Conteúdo:
  uso obrigatório de pulseira branca com no mínimo 2 identificadores (nome completo,
  nome da mãe, data de nascimento ou nº de prontuário — nunca número de
  leito/quarto), especificações técnicas da pulseira, confirmação obrigatória antes
  de medicação/sangue/hemoderivados/coleta/dieta/procedimento invasivo, casos
  especiais (recém-nascido, transferência entre serviços, paciente sem identidade
  disponível).
- **Protocolo de Medicamentos**: já coberto na Fase 10 (Farmácia), via citação
  primária dos boletins ISMP Brasil — não precisa buscar de novo aqui.
- **Achado de qualidade de fonte a resolver antes de publicar**: o boletim do ISMP
  Brasil (Fase 10) cita "Anexo 03" como sendo o Protocolo de Medicamentos, mas o PDF
  compilado (fonte diferente — Secretaria de Saúde do Paraná) numera "Anexo 03" como
  Cirurgia Segura e "Anexo 02" como Úlcera por Pressão, enquanto o PDF oficial de
  Quedas (baixado direto do gov.br/anvisa) se identifica como "Anexo 01". A
  numeração pode ter mudado entre publicações/reimpressões do Anexo Único da
  Portaria — **antes de publicar qualquer FAQ citando "Anexo NN", confirmar contra o
  Diário Oficial original**, não confiar na numeração de um PDF de terceiro isolado
  (mesma lição do CIHA).

### 4. Segurança do trabalhador (NR-32) — já é compartilhada com a Fase 10

Não é trabalho duplicado: a NR-32 já pesquisada e baixada na Fase 10 (Farmácia) vale
igual pra Enfermagem — é a categoria profissional mais exposta a risco biológico/
perfurocortante no dia a dia. Reaproveitar o mesmo conteúdo, sem pesquisa nova.

### 5. Candidato de consulta

Mesma ideia da Fase 10 (índice de Normas Regulamentadoras). Ainda não pesquisado se
o site do COFEN tem uma busca de resoluções livre de proteção anti-bot (mesmo
cuidado que o Bulário da ANVISA exigiu) — fica como próximo passo de pesquisa, não
assumir que é livre sem checar.

### 6. Achado extra, pedido do usuário: Protocolo de Sepse (ILAS)

Pedido do usuário (20/08/2026): "se achar algo sobre protocolo de sepse também,
pois é muito usado". Diferente dos 6 protocolos do PNSP (que são de origem
Ministério da Saúde/Anvisa/Fiocruz), **não existe um PCDT único e obrigatório do
Ministério da Saúde especificamente pra sepse** — a referência nacional de fato é o
**Instituto Latino Americano de Sepse (ILAS)**, entidade sem fins lucrativos que
desde 2004 mantém o "Programa de Melhoria de Qualidade em Sepse" em parceria com
hospitais brasileiros, seguindo as diretrizes internacionais da *Surviving Sepsis
Campaign* (SSC) adaptadas ao Brasil — o mesmo tipo de posição institucional que o
ISMP Brasil ocupa pra medicamentos (não é o governo, mas é a referência técnica que
o próprio setor e a literatura tratam como padrão nacional).

- **Baixado**: `ILAS_Protocolo_Sepse_2018.pdf` (14 págs., revisado em agosto/2018 —
  é a versão que hoje está linkada como "o" protocolo de tratamento no site oficial
  ilas.org.br) e `ILAS_Guia_Terapia_Antimicrobiana_2024.pdf` (316 págs., 3ª edição,
  guia complementar mais recente sobre antimicrobianos — baixado mas não lido, é
  denso demais pra essa pesquisa inicial).
- ⚠️ **Verificar antes de publicar**: o protocolo principal é de 2018 (a Surviving
  Sepsis Campaign internacional teve revisão em 2021) — antes de virar FAQ,
  confirmar no site do ILAS se não saiu uma versão mais nova do documento principal
  (só achei o companion de 2024, não uma nova revisão do protocolo-base em si).

**Conteúdo extraído por completo, em 20/08/2026:**
- **Definições** (nomenclatura Sepsis-3, adotada pelo ILAS desde a revisão de 2018):
  *infecção sem disfunção* (antiga "sepse") → *sepse* (antiga "sepse grave": infecção
  + disfunção orgânica) → *choque séptico* (sepse com hipotensão refratária a
  fluido, PAM ≤65 mmHg). SRIS (2+ de: temperatura, FC>90, FR>20/PaCO2<32, leucócitos
  alterados) não define mais sepse, mas segue útil pra **triagem**.
- **Disfunções orgânicas** que caracterizam sepse: hipotensão, oligúria/creatinina
  elevada, relação PaO2/FiO2<300, plaquetas <100.000 (ou queda de 50%), lactato
  acima do valor de referência, rebaixamento de consciência/agitação/delirium,
  bilirrubina >2x o valor de referência.
- **Triagem**: identificação da suspeita é **"usualmente pela enfermagem"** (texto
  literal do protocolo) — confirma a centralidade da Enfermagem nessa frente, igual
  os outros protocolos do PNSP já mapeados. qSOFA (rebaixamento de consciência + FR
  ≥22 + PAS <100) não deve ser usado pra triagem (baixa sensibilidade), só pra
  priorizar gravidade depois da triagem já feita por critério mais sensível.
- **Pacote de 1 hora** (o núcleo prático do protocolo, o "bundle" mais citado):
  1. Coletar exames de disfunção orgânica (gasometria, lactato arterial, hemograma,
     creatinina, bilirrubina, coagulograma).
  2. Lactato arterial dentro da 1ª hora, meta de resultado em 30 min.
  3. Duas hemoculturas de sítios distintos em até 1h (+ outras culturas
     pertinentes) **antes** do antimicrobiano — mas sem atrasar a antibioticoterapia
     se a coleta não for possível a tempo.
  4. Antimicrobiano de amplo espectro, EV, dentro da 1ª hora — dose máxima sem
     ajuste renal/hepático inicial, infusão estendida de betalactâmicos (exceto
     1ª dose em bolus).
  5. Ressuscitação volêmica: 30 mL/kg de cristaloide na 1ª hora se hipotensão ou
     sinais de hipoperfusão (amido contraindicado).
  6. Vasopressor (noradrenalina 1ª escolha) se PAM <65 após volume — pode começar
     em veia periférica enquanto se providencia acesso central.
  7. Reavaliação de lactato em 2-4h se alterado, buscando clareamento.
- **Reavaliação das 6 horas** (choque séptico, hiperlactatemia ou hipoperfusão):
  reavaliação volêmica (PVC, variação de pressão de pulso, elevação passiva de
  MMII, saturação venosa central), transfusão se Hb <7, pressão arterial invasiva
  sob vasopressor.
- **Outras recomendações**: corticoide (hidrocortisona 50mg/6h) só em choque
  séptico refratário; ventilação mecânica protetora (6 mL/kg peso ideal, platô
  <30 cmH2O); sem bicarbonato se pH>7,15; controle glicêmico <180 mg/dL; terapia
  renal substitutiva sem indicação de início precoce por rotina.
- **Papel multiprofissional pós-tratamento agudo**: o texto cita explicitamente
  enfermagem (recuperação funcional), farmácia clínica (adequação da prescrição),
  fisioterapia, fonoaudiologia, psicologia, odontologia e serviço social — reforça
  que sepse não é só "hora 1", é linha de cuidado até a alta.
- **Prevenção de IRAS ligada a sepse**: menor tempo possível de dispositivo
  invasivo (cânula orotraqueal, cateter venoso central, PA invasiva, sonda
  vesical) — conecta com NR-32/controle de infecção já mapeado.

### 5b. Candidato de consulta — adendo

O guia de terapia antimicrobiana do ILAS (316 págs., 2024) é denso demais pra
reproduzir como FAQ, mas poderia virar candidato de **consulta por classe de
antimicrobiano/foco infeccioso** no futuro, se o índice do documento permitir —
não avaliado ainda, fica só registrada a possibilidade.

### O que fica de fora (por ora)

Técnicas/procedimentos de enfermagem propriamente ditos (ex: como puncionar uma
veia, como fazer um curativo passo a passo) **não** entram — isso é ensino técnico/
protocolo clínico de execução, não referência regulatória, e foge do princípio
"conteúdo oficial reproduzido, sem interpretação própria". O que o portal cobre é a
**moldura legal e os protocolos oficiais de segurança do paciente** (que já trazem
passo a passo detalhado quando aplicável, como Cirurgia Segura e UPP acima) — não um
manual de técnica de enfermagem por conta própria.

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

## Observação (sem previsão de entrega): Logo da operadora na busca de Operadoras ANS

Pedido do usuário (27/08/2026): na tela de busca de Operadoras ANS (aba
Verificadores), trazer a logo da operadora pra download junto do card de
resultado (registro, razão social, CNPJ, endereço, contato).

**Verificado no mesmo dia**: a fonte oficial usada por essa tela
(`Relatorio_cadop.csv` da ANS, ver [create-tabela-operadoras-ans.sql](create-tabela-operadoras-ans.sql)
e [operadoras-atualizador.js](operadoras-atualizador.js)) não tem campo de
logo — só dado cadastral (CNPJ, razão social, endereço, contato). Não existe
API pública da ANS que sirva logo de operadora.

**Único caminho encontrado, e por que não é candidato ainda**: heurística de
extrair o domínio do e-mail cadastrado e buscar o favicon via serviço de
terceiro (ex.: `google.com/s2/favicons`) — sem custo, mas com dois problemas
que travam a decisão: (1) cobertura desigual, muita operadora pequena/
cooperativa não tem e-mail com domínio próprio identificável; (2) um botão de
**download** redistribui a marca de ~1.100 empresas privadas sem autorização
— questão de marca registrada, diferente de só exibir o ícone. Precisaria de
uma etapa de pesquisa antes (checar % de cobertura real e decidir "exibir" vs
"baixar") — mesmo padrão já usado antes de CIHA/DMED virarem candidato de
verdade.

**Decisão do usuário (27/08/2026)**: registrar a solicitação e deixar de lado
por ora, sem entrar no calendário planejado nem na lista "Em breve" do
portal.

**O que observar pra virar candidato de verdade**: alguém rodar a pesquisa de
cobertura (quantas das ~1.115 operadoras têm e-mail com domínio próprio
utilizável) e uma decisão de escopo entre "exibir" (mais defensável) e
"baixar" (redistribuição, mais exposto).

## Observação (sem previsão de entrega): Status de deploy do Render visível no GitHub

Pergunta do usuário (27/08/2026), depois de configurar acesso de leitura à API do
Render (ver [[project_deploy_render]]): dá pra centralizar no GitHub a informação de
"qual deploy foi feito, de qual commit/PR, com qual status" em vez de precisar
perguntar?

**Verificado no mesmo dia, direto na API do Render**
(`GET /v1/services/srv-d9qrns1t0dsc738jmqcg`): o Render **não** escreve
status/check de volta pro GitHub pra esse tipo de serviço (web service comum) — só
faz isso pra "Preview Environments" de PR (`pullRequestPreviewsEnabled`), que está
desligado nesse serviço. Não é limitação de acesso — a plataforma simplesmente não
tem esse retorno automático pra web service fora do fluxo de preview.

**Duas opções levantadas**:
1. **Sem construir nada** (❤ escolhida em 27/08/2026, ver decisão abaixo): o Render
   já marca cada deploy com o SHA exato do commit — como já existe acesso de leitura
   à API (`GET /v1/services/{id}/deploys`), a informação já pode ser consultada e
   cruzada com o `git log`/número da PR a qualquer momento, sob demanda. Zero
   manutenção, zero peça nova.
2. **GitHub Deployments de verdade**: um workflow do GitHub Actions, disparado a
   cada push em `main`, que consulta a API do Render e cria um GitHub Deployment
   (apareceria na aba "Environments" do repo e como link "View deployment" na
   própria PR). Exigiria: `RENDER_API_KEY` como GitHub Secret (separado do `.env`
   local), um workflow novo, e manutenção contínua — mais uma peça que pode quebrar.

**Decisão do usuário (27/08/2026)**: manter a opção 1 por ora (consulta sob demanda,
sem nada novo no GitHub). Registrar a opção 2 documentada, caso o usuário queira
visibilidade direto na tela do GitHub/PR no futuro sem precisar perguntar.

**O que observar pra reconsiderar**: se a consulta sob demanda começar a incomodar
(esquecimento de checar, ou querer ver isso de relance sem perguntar), a opção 2 já
está especificada acima, pronta pra implementar sem pesquisa adicional.
