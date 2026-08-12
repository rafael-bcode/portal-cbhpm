const listaEdicoesEl = document.getElementById('lista-edicoes');
const formEl = document.getElementById('form-consulta');
const resultadoAreaEl = document.getElementById('resultado-area');
const buscaInputEl = document.getElementById('busca-descricao');
const buscaResultadosEl = document.getElementById('busca-resultados');
const codigoInputEl = document.getElementById('codigo');

const fmtMoeda = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Escapa texto de origem não confiável (nome de arquivo escolhido pelo
// usuário, conteúdo do XML carregado, resposta de API externa) antes de
// interpolar em innerHTML — sem isso, um arquivo TISS malicioso poderia
// injetar HTML/JS (ex: <ans:descricaoProcedimento>&lt;img ...&gt;</...>,
// que o DOMParser decodifica de volta para texto com tags reais).
function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let edicoesDisponiveis = [];
let debounceTimer = null;
let ultimaConsulta = null;
let ultimaConsultaMultiplos = null;

// ---------- Tema claro/escuro (localStorage, sem login) ----------
// Sem preferência salva, segue prefers-color-scheme do sistema (ver
// style.css). O botão grava uma escolha manual que passa a valer sempre
// neste navegador, até o usuário trocar de novo.
const TEMA_KEY = 'cbhpm_tema';
const btnTemaEl = document.getElementById('btn-tema');

function temaEfetivo() {
  const salvo = localStorage.getItem(TEMA_KEY);
  if (salvo === 'light' || salvo === 'dark') return salvo;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  btnTemaEl.textContent = tema === 'dark' ? '☀️' : '🌙';
  btnTemaEl.title = tema === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro';
}

btnTemaEl.addEventListener('click', () => {
  const novoTema = temaEfetivo() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(TEMA_KEY, novoTema);
  aplicarTema(novoTema);
});

aplicarTema(temaEfetivo());

// ---------- Abas ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
  });
});

document.querySelectorAll('.subtab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.subtab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.subtab-panel').forEach((p) => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`subtab-${btn.dataset.subtab}`).classList.remove('hidden');
  });
});

// ---------- Acesso à aba de Dúvidas frequentes (link no card da barra lateral) ----------
document.getElementById('link-faq-duvidas')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('tab-btn-faq')?.click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------- Atalhos "abrir no portal" dentro das respostas do FAQ ----------
document.querySelectorAll('.faq-portal-link').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${btn.dataset.gotoTab}"]`);
    tabBtn?.click();
    if (btn.dataset.gotoSubtab) {
      const subtabBtn = document.querySelector(`.subtab-btn[data-subtab="${btn.dataset.gotoSubtab}"]`);
      subtabBtn?.click();
    }
    if (btn.dataset.gotoAcao === 'versoes-tiss') {
      document.getElementById('btn-versoes-tiss')?.click();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// ---------- Abas (sub-navegação) dentro do FAQ, por assunto ----------
document.querySelectorAll('.faq-subtab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.faq-subtab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.faq-subtab-panel').forEach((p) => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`faqtab-${btn.dataset.faqtab}`).classList.remove('hidden');
  });
});

// ---------- Indicadores hospitalares (benchmark ANAHP, informado pelo usuário) ----------
// Nomes e definições dos indicadores seguem terminologia padrão do setor (a mesma usada por
// ANVISA/ANAHP/literatura de gestão hospitalar) — descrições escritas por nós, sem copiar texto
// nem valores do site da ANAHP. Os grupos (Econômico-Financeiro, Sustentabilidade, Gestão de
// Pessoas, Assistencial) seguem a mesma organização usada por eles, só pra facilitar comparação.
const CATEGORIAS_INDICADOR = {
  financeiro: 'Econômico-Financeiro',
  sustentabilidade: 'Sustentabilidade',
  pessoas: 'Gestão de Pessoas',
  assistencial: 'Assistencial',
};

const INDICADORES_ANAHP = [
  {
    id: 'indice-glosas',
    categoria: 'financeiro',
    nome: 'Índice de Glosas',
    unidade: '%',
    definicao: 'Percentual do valor faturado que foi glosado (recusado) por operadoras ou pelo SUS no período, sobre o total faturado.',
    sentido: 'menor',
    promo: ['fatura-glosas'],
  },
  {
    id: 'prazo-recebimento',
    categoria: 'financeiro',
    nome: 'Prazo Médio de Recebimento',
    unidade: 'dias',
    definicao: 'Tempo médio, em dias, entre o faturamento de uma conta e o efetivo recebimento do valor pela operadora/SUS/particular.',
    sentido: 'menor',
    promo: [],
  },
  {
    id: 'prazo-pagamento',
    categoria: 'financeiro',
    nome: 'Prazo Médio de Pagamento',
    unidade: 'dias',
    definicao: 'Tempo médio, em dias, entre a compra/serviço recebido e o efetivo pagamento a fornecedores.',
    sentido: 'contexto',
    promo: [],
  },
  {
    id: 'margem-ebitda',
    categoria: 'financeiro',
    nome: 'Margem EBITDA',
    unidade: '%',
    definicao: 'Percentual do EBITDA (lucro antes de juros, impostos, depreciação e amortização) sobre a receita líquida do período.',
    sentido: 'maior',
    promo: [],
  },
  {
    id: 'composicao-despesas',
    categoria: 'financeiro',
    nome: 'Composição de Despesas',
    unidade: '%',
    definicao: 'Distribuição percentual das despesas por natureza (pessoal, materiais, medicamentos, serviços de terceiros etc.) sobre o total de despesas.',
    sentido: 'contexto',
    promo: [],
  },
  {
    id: 'consumo-agua',
    categoria: 'sustentabilidade',
    nome: 'Consumo de Água por Paciente-dia',
    unidade: 'm³',
    definicao: 'Volume de água consumido na instituição, dividido pelo total de pacientes-dia no período.',
    sentido: 'menor',
    promo: [],
  },
  {
    id: 'consumo-energia',
    categoria: 'sustentabilidade',
    nome: 'Consumo de Energia por Paciente-dia',
    unidade: 'kWh',
    definicao: 'Energia elétrica consumida na instituição, dividida pelo total de pacientes-dia no período.',
    sentido: 'menor',
    promo: [],
  },
  {
    id: 'residuos-reciclaveis',
    categoria: 'sustentabilidade',
    nome: 'Geração de Resíduos Recicláveis',
    unidade: '%',
    definicao: 'Percentual dos resíduos gerados pela instituição classificados como recicláveis, sobre o total de resíduos.',
    sentido: 'maior',
    promo: [],
  },
  {
    id: 'rotatividade',
    categoria: 'pessoas',
    nome: 'Rotatividade de Pessoal (Turnover)',
    unidade: '%',
    definicao: 'Percentual de colaboradores desligados (ou substituídos) em relação ao quadro médio de funcionários no período.',
    sentido: 'menor',
    promo: [],
  },
  {
    id: 'absenteismo',
    categoria: 'pessoas',
    nome: 'Absenteísmo (afastamentos até 15 dias)',
    unidade: '%',
    definicao: 'Percentual de horas/dias não trabalhados por afastamento (até 15 dias) em relação ao total de horas/dias previstos.',
    sentido: 'menor',
    promo: [],
  },
  {
    id: 'taxa-ocupacao',
    categoria: 'assistencial',
    nome: 'Taxa de Ocupação',
    unidade: '%',
    definicao: 'Percentual de leitos ocupados em relação ao total de leitos operacionais disponíveis no período.',
    sentido: 'contexto',
    promo: ['watch'],
  },
  {
    id: 'permanencia-uti-adulto',
    categoria: 'assistencial',
    nome: 'Média de Permanência — UTI Adulto',
    unidade: 'dias',
    definicao: 'Tempo médio de internação dos pacientes na UTI adulto, do ingresso à alta/óbito/transferência.',
    sentido: 'menor',
    promo: ['watch'],
  },
  {
    id: 'permanencia-uti-neonatal',
    categoria: 'assistencial',
    nome: 'Média de Permanência — UTI Neonatal',
    unidade: 'dias',
    definicao: 'Tempo médio de internação dos pacientes na UTI neonatal, do ingresso à alta/óbito/transferência.',
    sentido: 'menor',
    promo: ['watch'],
  },
  {
    id: 'permanencia-maternidade',
    categoria: 'assistencial',
    nome: 'Média de Permanência — Maternidade',
    unidade: 'dias',
    definicao: 'Tempo médio de internação das pacientes na maternidade, do ingresso à alta.',
    sentido: 'menor',
    promo: ['watch'],
  },
  {
    id: 'mortalidade-institucional',
    categoria: 'assistencial',
    nome: 'Taxa de Mortalidade Institucional',
    unidade: '%',
    definicao: 'Percentual de óbitos em relação ao total de saídas (altas + óbitos) da instituição no período.',
    sentido: 'menor',
    promo: ['quality'],
  },
  {
    id: 'mortalidade-operatoria',
    categoria: 'assistencial',
    nome: 'Taxa de Mortalidade Operatória',
    unidade: '%',
    definicao: 'Percentual de óbitos ocorridos em decorrência de procedimento cirúrgico, em relação ao total de cirurgias realizadas no período.',
    sentido: 'menor',
    promo: ['quality'],
  },
  {
    id: 'infeccao-corrente-sanguinea',
    categoria: 'assistencial',
    nome: 'Densidade de Incidência de Infecção de Corrente Sanguínea (associada a CVC)',
    unidade: '‰ (por 1000 cateteres-dia)',
    definicao: 'Número de infecções de corrente sanguínea associadas a cateter venoso central (CVC), por 1000 cateteres-dia, no período.',
    sentido: 'menor',
    promo: ['watch', 'quality'],
  },
  {
    id: 'infeccao-trato-urinario',
    categoria: 'assistencial',
    nome: 'Densidade de Incidência de Infecção do Trato Urinário (associada a CVD)',
    unidade: '‰ (por 1000 cateteres-dia)',
    definicao: 'Número de infecções do trato urinário associadas a cateter vesical de demora (CVD), por 1000 cateteres-dia, no período.',
    sentido: 'menor',
    promo: ['watch', 'quality'],
  },
  {
    id: 'pneumonia-vm',
    categoria: 'assistencial',
    nome: 'Densidade de Incidência de Pneumonia (associada à ventilação mecânica)',
    unidade: '‰ (por 1000 ventiladores-dia)',
    definicao: 'Número de pneumonias associadas ao uso de ventilação mecânica (TQT/IOT), por 1000 ventiladores-dia, no período.',
    sentido: 'menor',
    promo: ['watch', 'quality'],
  },
  {
    id: 'infeccao-sitio-cirurgico',
    categoria: 'assistencial',
    nome: 'Taxa de Infecção de Sítio Cirúrgico',
    unidade: '%',
    definicao: 'Percentual de cirurgias que evoluíram com infecção no sítio cirúrgico, em relação ao total de cirurgias realizadas no período.',
    sentido: 'menor',
    promo: ['watch', 'quality'],
  },
  {
    id: 'lesao-por-pressao',
    categoria: 'assistencial',
    nome: 'Incidência de Lesão por Pressão',
    unidade: '‰ (por 1000 pacientes-dia)',
    definicao: 'Número de pacientes que desenvolveram lesão por pressão durante a internação, por 1000 pacientes-dia, no período.',
    sentido: 'menor',
    promo: ['quality'],
  },
  {
    id: 'quedas',
    categoria: 'assistencial',
    nome: 'Incidência de Quedas',
    unidade: '‰ (por 1000 pacientes-dia)',
    definicao: 'Número de quedas de pacientes durante a internação, por 1000 pacientes-dia, no período.',
    sentido: 'menor',
    promo: ['quality'],
  },
  {
    id: 'parto-normal',
    categoria: 'assistencial',
    nome: 'Taxa de Parto Normal',
    unidade: '%',
    definicao: 'Percentual de partos normais em relação ao total de partos realizados no período (a OMS recomenda reduzir cesáreas sem indicação clínica).',
    sentido: 'maior',
    promo: ['quality'],
  },
  {
    id: 'erro-medicacao',
    categoria: 'assistencial',
    nome: 'Taxa de Erros de Medicação',
    unidade: '‰ (por 1000 pacientes-dia)',
    definicao: 'Número de erros de medicação identificados (dose, via, horário, paciente ou medicamento incorretos), por 1000 pacientes-dia, no período.',
    sentido: 'menor',
    promo: ['quality'],
  },
];

const PROMO_INDICADOR = {
  watch: {
    cor: '#0891B2',
    titulo: 'Argus Watch pode ajudar',
    texto: 'Acompanha ocupação, leitos e permanência por unidade em tempo real, e monitora isolamentos (contato/gotícula/aérea) e dispositivos invasivos (CVC, PICC, CVD, TQT/IOT) — a mesma linha de frente que gera esse indicador.',
    href: 'https://argusbc.com.br/',
  },
  quality: {
    cor: '#F59E0B',
    titulo: 'Argus Quality pode ajudar',
    texto: 'Cadastra o indicador com meta, tendência e análise crítica por período, e conecta não conformidades e planos de ação corretiva quando o resultado fugir da meta.',
    href: 'https://argusbc.com.br/',
  },
};

function indicadorPromoHtml(indicador) {
  if (!indicador.promo || indicador.promo.length === 0) return '';
  const boxes = indicador.promo
    .map((chave) => {
      if (chave === 'fatura-glosas') {
        return `
        <div class="eco-card indicador-promo" style="--pcolor:var(--teal)">
          <span class="eco-card-nome">🧾 Você já tem essa ferramenta aqui no portal</span>
          <span class="eco-card-desc">O Validador de XML TISS e a tabela de códigos de glosa ajudam a identificar a causa antes de virar índice de glosa.</span>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
            <button type="button" class="faq-portal-link" data-goto-tab="validador">✅ Validador de XML TISS →</button>
            <button type="button" class="faq-portal-link" data-goto-tab="tiss-tabelas">📋 Tabelas de glosa TISS →</button>
          </div>
        </div>`;
      }
      const p = PROMO_INDICADOR[chave];
      if (!p) return '';
      return `
      <a class="eco-card indicador-promo" style="--pcolor:${p.cor}" href="${p.href}" target="_blank" rel="noopener noreferrer">
        <span class="eco-card-nome">${escaparHtml(p.titulo)}</span>
        <span class="eco-card-desc">${escaparHtml(p.texto)}</span>
      </a>`;
    })
    .join('');
  return `<div class="indicador-promo-grid">${boxes}</div>`;
}

const indicadorSelectEl = document.getElementById('indicador-select');
const indicadorInfoEl = document.getElementById('indicador-info');
const indicadorFormEl = document.getElementById('indicador-form');
const btnIndicadorCompararEl = document.getElementById('btn-indicador-comparar');
const indicadorResultadoAreaEl = document.getElementById('indicador-resultado-area');
const INDICADORES_STORAGE_KEY = 'cbhpm_indicadores_anahp';

if (indicadorSelectEl) {
  const gruposHtml = Object.entries(CATEGORIAS_INDICADOR)
    .map(([chave, rotulo]) => {
      const opcoes = INDICADORES_ANAHP
        .filter((i) => i.categoria === chave)
        .map((i) => `<option value="${i.id}">${escaparHtml(i.nome)}</option>`)
        .join('');
      return `<optgroup label="${escaparHtml(rotulo)}">${opcoes}</optgroup>`;
    })
    .join('');
  indicadorSelectEl.insertAdjacentHTML('beforeend', gruposHtml);

  function carregarComparacoesSalvas() {
    try {
      return JSON.parse(localStorage.getItem(INDICADORES_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function salvarComparacao(id, dados) {
    const todas = carregarComparacoesSalvas();
    todas[id] = dados;
    localStorage.setItem(INDICADORES_STORAGE_KEY, JSON.stringify(todas));
  }

  function renderizarResultado(indicador, periodo, meuValor, benchmark) {
    const diferenca = meuValor - benchmark;
    const diferencaPct = benchmark !== 0 ? (diferenca / Math.abs(benchmark)) * 100 : null;
    let veredito = '';
    let corVeredito = 'var(--ink-soft)';
    if (indicador.sentido === 'menor') {
      veredito = diferenca <= 0 ? '✅ Melhor que o benchmark' : '⚠️ Pior que o benchmark';
      corVeredito = diferenca <= 0 ? '#059669' : '#DC2626';
    } else if (indicador.sentido === 'maior') {
      veredito = diferenca >= 0 ? '✅ Melhor que o benchmark' : '⚠️ Pior que o benchmark';
      corVeredito = diferenca >= 0 ? '#059669' : '#DC2626';
    } else {
      veredito = 'ℹ️ Sem "melhor/pior" único — depende do contexto da instituição';
    }

    indicadorResultadoAreaEl.innerHTML = `
      <div class="grupo grupo-principal" style="margin-top:8px;">
        <div class="grupo-corpo" style="padding:16px;">
          <div class="mp-header" style="margin:0 0 10px;">
            <h3 style="margin:0;">${escaparHtml(indicador.nome)} — ${escaparHtml(periodo || 'período informado')}</h3>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; margin-bottom:12px;">
            <div class="stat-card"><div class="num">${meuValor}${escaparHtml(indicador.unidade)}</div><div class="lbl">Seu resultado</div></div>
            <div class="stat-card"><div class="num">${benchmark}${escaparHtml(indicador.unidade)}</div><div class="lbl">Benchmark ANAHP</div></div>
            <div class="stat-card"><div class="num">${diferenca > 0 ? '+' : ''}${diferenca.toFixed(2)}${escaparHtml(indicador.unidade)}</div><div class="lbl">Diferença absoluta</div></div>
            <div class="stat-card"><div class="num">${diferencaPct === null ? '—' : `${diferencaPct > 0 ? '+' : ''}${diferencaPct.toFixed(1)}%`}</div><div class="lbl">Diferença percentual</div></div>
          </div>
          <p style="font-weight:700; color:${corVeredito}; margin:0 0 4px;">${veredito}</p>
          <p class="ajustes-nota" style="margin:0;">Comparação calculada com os valores que você informou — o benchmark ANAHP não é armazenado nem exibido automaticamente pelo portal.</p>
        </div>
      </div>
      ${indicadorPromoHtml(indicador)}
    `;
    document.querySelectorAll('.faq-portal-link').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${btn.dataset.gotoTab}"]`);
        tabBtn?.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  indicadorSelectEl.addEventListener('change', () => {
    const indicador = INDICADORES_ANAHP.find((i) => i.id === indicadorSelectEl.value);
    indicadorResultadoAreaEl.innerHTML = '';
    if (!indicador) {
      indicadorInfoEl.innerHTML = '';
      indicadorFormEl.classList.add('hidden');
      btnIndicadorCompararEl.classList.add('hidden');
      return;
    }
    indicadorInfoEl.innerHTML = `
      <div class="grupo grupo-principal" style="margin:12px 0;">
        <div class="grupo-corpo" style="padding:14px 16px;">
          <p style="margin:0 0 8px;"><strong>${escaparHtml(indicador.nome)}</strong> <span class="ajustes-nota" style="margin:0;">(unidade: ${escaparHtml(indicador.unidade)})</span></p>
          <p style="margin:0;">${escaparHtml(indicador.definicao)}</p>
        </div>
      </div>
    `;
    indicadorFormEl.classList.remove('hidden');
    btnIndicadorCompararEl.classList.remove('hidden');

    const salvas = carregarComparacoesSalvas();
    const anterior = salvas[indicador.id];
    document.getElementById('indicador-periodo').value = anterior?.periodo || '';
    document.getElementById('indicador-meu-valor').value = anterior?.meuValor ?? '';
    document.getElementById('indicador-benchmark').value = anterior?.benchmark ?? '';
  });

  btnIndicadorCompararEl.addEventListener('click', () => {
    const indicador = INDICADORES_ANAHP.find((i) => i.id === indicadorSelectEl.value);
    if (!indicador) return;
    const periodo = document.getElementById('indicador-periodo').value.trim();
    const meuValor = parseFloat(document.getElementById('indicador-meu-valor').value);
    const benchmark = parseFloat(document.getElementById('indicador-benchmark').value);
    if (Number.isNaN(meuValor) || Number.isNaN(benchmark)) {
      indicadorResultadoAreaEl.innerHTML = '<p class="msg vazio">Informe seu resultado e o benchmark ANAHP (números) pra comparar.</p>';
      return;
    }
    salvarComparacao(indicador.id, { periodo, meuValor, benchmark });
    renderizarResultado(indicador, periodo, meuValor, benchmark);
  });
}

document.getElementById('link-indicadores-anahp')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('tab-btn-indicadores')?.click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------- Favoritos (localStorage, sem login) ----------
const FAVORITOS_KEY = 'cbhpm_favoritos';
const listaFavoritosEl = document.getElementById('lista-favoritos');
const blocoFavoritosEl = document.getElementById('bloco-favoritos');

function carregarFavoritos() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITOS_KEY)) || [];
  } catch {
    return [];
  }
}

function isFavorito(codigo) {
  return carregarFavoritos().some((f) => Number(f.codigo) === Number(codigo));
}

function alternarFavorito(codigo, descricao) {
  const favoritos = carregarFavoritos();
  const idx = favoritos.findIndex((f) => Number(f.codigo) === Number(codigo));
  if (idx >= 0) {
    favoritos.splice(idx, 1);
  } else {
    favoritos.unshift({ codigo: Number(codigo), descricao });
  }
  localStorage.setItem(FAVORITOS_KEY, JSON.stringify(favoritos));
  renderizarFavoritos();
}

function renderizarFavoritos() {
  const favoritos = carregarFavoritos();
  blocoFavoritosEl.classList.toggle('hidden', favoritos.length === 0);
  listaFavoritosEl.innerHTML = favoritos
    .map(
      (f) => `
      <span class="favorito-chip" data-codigo="${f.codigo}" data-desc="${f.descricao.replace(/"/g, '&quot;')}">
        ★ ${f.codigo} — ${f.descricao}
        <button type="button" class="favorito-remover" data-remover="${f.codigo}" aria-label="Remover favorito">&times;</button>
      </span>`
    )
    .join('');
}

listaFavoritosEl.addEventListener('click', (e) => {
  const btnRemover = e.target.closest('.favorito-remover');
  if (btnRemover) {
    alternarFavorito(btnRemover.dataset.remover, '');
    return;
  }
  const chip = e.target.closest('.favorito-chip');
  if (chip) {
    codigoInputEl.value = chip.dataset.codigo;
    buscaInputEl.value = chip.dataset.desc;
  }
});

renderizarFavoritos();

// ---------- Convênios (presets de % de simulação, localStorage, sem login) ----------
// Fase 3 do roadmap: não é um cadastro de contratos por procedimento — é um
// atalho para não redigitar os mesmos percentuais de ajuste toda vez que se
// consulta pelo mesmo convênio.
const CONVENIOS_KEY = 'cbhpm_convenios';
const CAMPOS_CONVENIO = [
  'pctPorte', 'pctUco', 'pctPorteAnestesico', 'valorFilme', 'pctFilme',
  'pct1Auxiliar', 'pct2Auxiliar', 'pct3Auxiliar', 'pct4Auxiliar',
  'pctInstrumentador', 'pctAuxAnestesista',
];

function carregarConvenios() {
  try {
    return JSON.parse(localStorage.getItem(CONVENIOS_KEY)) || [];
  } catch {
    return [];
  }
}

function salvarConvenios(lista) {
  localStorage.setItem(CONVENIOS_KEY, JSON.stringify(lista));
}

function renderizarSelectsConvenio() {
  const convenios = carregarConvenios();
  document.querySelectorAll('.convenio-select').forEach((select) => {
    const atual = select.value;
    select.innerHTML =
      '<option value="">— Manual —</option>' +
      convenios
        .map((c) => `<option value="${c.nome.replace(/"/g, '&quot;')}">${c.nome}</option>`)
        .join('');
    if (convenios.some((c) => c.nome === atual)) select.value = atual;
  });
}

function configurarConvenioUI(prefixo) {
  const idCampo = (campo) => (prefixo ? `${prefixo}-${campo}` : campo);
  const selectEl = document.getElementById(idCampo('convenio-select'));
  const btnSalvarEl = document.getElementById(idCampo('btn-salvar-convenio'));
  const btnExcluirEl = document.getElementById(idCampo('btn-excluir-convenio'));
  if (!selectEl || !btnSalvarEl || !btnExcluirEl) return;

  selectEl.addEventListener('change', () => {
    const convenio = carregarConvenios().find((c) => c.nome === selectEl.value);
    if (!convenio) return;
    CAMPOS_CONVENIO.forEach((campo) => {
      const input = document.getElementById(idCampo(campo));
      if (input && convenio.ajustes[campo] !== undefined) input.value = convenio.ajustes[campo];
    });
  });

  btnSalvarEl.addEventListener('click', () => {
    const nome = window.prompt('Nome do convênio para salvar os percentuais atuais:', selectEl.value || '');
    if (!nome || !nome.trim()) return;

    const ajustes = {};
    CAMPOS_CONVENIO.forEach((campo) => {
      const input = document.getElementById(idCampo(campo));
      if (input) ajustes[campo] = Number(input.value) || 0;
    });

    const convenios = carregarConvenios();
    const nomeLimpo = nome.trim();
    const idx = convenios.findIndex((c) => c.nome === nomeLimpo);
    const registro = { nome: nomeLimpo, ajustes };
    if (idx >= 0) convenios[idx] = registro;
    else convenios.push(registro);

    salvarConvenios(convenios);
    renderizarSelectsConvenio();
    selectEl.value = nomeLimpo;
  });

  btnExcluirEl.addEventListener('click', () => {
    if (!selectEl.value) return;
    if (!window.confirm(`Excluir o convênio "${selectEl.value}"?`)) return;
    salvarConvenios(carregarConvenios().filter((c) => c.nome !== selectEl.value));
    renderizarSelectsConvenio();
  });
}

renderizarSelectsConvenio();
configurarConvenioUI('');
configurarConvenioUI('mp');

// ---------- Autocomplete de busca por descrição ----------
function esconderResultadosBusca() {
  buscaResultadosEl.classList.add('hidden');
  buscaResultadosEl.innerHTML = '';
}

async function buscarProcedimentos(termo) {
  try {
    const resp = await fetch(`/api/buscar-procedimentos?q=${encodeURIComponent(termo)}`);
    const itens = await resp.json();

    if (itens.length === 0) {
      buscaResultadosEl.innerHTML = '<div class="busca-vazio">Nenhum procedimento encontrado.</div>';
    } else {
      buscaResultadosEl.innerHTML = itens
        .map(
          (item) => `
          <div class="busca-item" data-codigo="${item.codigo}" data-desc="${item.descricao.replace(/"/g, '&quot;')}">
            <span class="codigo">${item.codigo}</span>
            <span class="desc">${item.descricao}</span>
          </div>`
        )
        .join('');
    }
    buscaResultadosEl.classList.remove('hidden');
  } catch (err) {
    console.error(err);
  }
}

buscaInputEl.addEventListener('input', () => {
  const termo = buscaInputEl.value.trim();
  clearTimeout(debounceTimer);

  if (termo.length < 2) {
    esconderResultadosBusca();
    return;
  }

  debounceTimer = setTimeout(() => buscarProcedimentos(termo), 250);
});

buscaResultadosEl.addEventListener('click', (e) => {
  const item = e.target.closest('.busca-item');
  if (!item || !item.dataset.codigo) return;

  codigoInputEl.value = item.dataset.codigo;
  buscaInputEl.value = item.dataset.desc;
  esconderResultadosBusca();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.busca-wrapper')) esconderResultadosBusca();
});

// ---------- Modal de ajuda (como o cálculo é feito) ----------
const modalAjudaEl = document.getElementById('modal-ajuda');
document.getElementById('btn-ajuda').addEventListener('click', () => {
  modalAjudaEl.classList.remove('hidden');
});
document.getElementById('btn-fechar-ajuda').addEventListener('click', () => {
  modalAjudaEl.classList.add('hidden');
});
modalAjudaEl.addEventListener('click', (e) => {
  if (e.target === modalAjudaEl) modalAjudaEl.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') modalAjudaEl.classList.add('hidden');
});

// ---------- Badge de versão + histórico de mudanças ----------
const btnVersaoEl = document.getElementById('btn-versao');
const modalVersaoEl = document.getElementById('modal-versao');
const listaVersoesEl = document.getElementById('lista-versoes');

async function carregarVersao() {
  try {
    const resp = await fetch('/api/versao');
    const { versaoAtual, changelog } = await resp.json();

    btnVersaoEl.textContent = `v${versaoAtual}`;

    listaVersoesEl.innerHTML = '';
    changelog.forEach((item) => {
      const bloco = document.createElement('div');
      bloco.className = 'versao-item';

      const head = document.createElement('div');
      head.className = 'versao-item-head';
      const numero = document.createElement('span');
      numero.className = 'versao-numero';
      numero.textContent = `v${item.versao}`;
      const data = document.createElement('span');
      data.className = 'versao-data';
      data.textContent = item.data;
      head.append(numero, data);

      const lista = document.createElement('ul');
      item.mudancas.forEach((mudanca) => {
        const li = document.createElement('li');
        li.textContent = mudanca;
        lista.appendChild(li);
      });

      bloco.append(head, lista);
      listaVersoesEl.appendChild(bloco);
    });
  } catch (err) {
    btnVersaoEl.textContent = 'v?';
    listaVersoesEl.textContent = 'Não foi possível carregar o histórico de versões.';
    console.error(err);
  }
}

btnVersaoEl.addEventListener('click', () => {
  modalVersaoEl.classList.remove('hidden');
});
document.getElementById('btn-fechar-versao').addEventListener('click', () => {
  modalVersaoEl.classList.add('hidden');
});
modalVersaoEl.addEventListener('click', (e) => {
  if (e.target === modalVersaoEl) modalVersaoEl.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') modalVersaoEl.classList.add('hidden');
});

carregarVersao();

// Resumo mostrado fechado no seletor de edições (ex: "Todas as 21 edições
// selecionadas") — evita que a tela abra sempre com a parede de 21
// checkboxes à mostra; o painel completo fica a um clique.
function atualizarResumoEdicoes() {
  const resumoEl = document.getElementById('edicoes-resumo');
  if (!resumoEl) return;
  const total = edicoesDisponiveis.length;
  const marcadas = document.querySelectorAll('input[name="edicao"]:checked').length;
  resumoEl.textContent =
    marcadas === 0
      ? 'Nenhuma edição selecionada'
      : marcadas === total
      ? `Todas as ${total} edições selecionadas`
      : `${marcadas} de ${total} edições selecionadas`;
}

// Carrega a lista de edições e monta os checkboxes
async function carregarEdicoes() {
  try {
    const resp = await fetch('/api/edicoes');
    edicoesDisponiveis = await resp.json();

    listaEdicoesEl.innerHTML = edicoesDisponiveis
      .map(
        (e) => `
        <label class="edicao-item">
          <input type="checkbox" name="edicao" value="${e.id}" checked>
          ${e.nome}
        </label>`
      )
      .join('');

    atualizarResumoEdicoes();
    sugerirDefaultsAuxiliares();
    popularSelectEdicaoMp();
  } catch (err) {
    listaEdicoesEl.innerHTML = '<span class="loading-text">Erro ao carregar edições.</span>';
    console.error(err);
  }
}

document.getElementById('btn-todas').addEventListener('click', () => {
  document.querySelectorAll('input[name="edicao"]').forEach((cb) => (cb.checked = true));
  atualizarResumoEdicoes();
  sugerirDefaultsAuxiliares();
});
document.getElementById('btn-nenhuma').addEventListener('click', () => {
  document.querySelectorAll('input[name="edicao"]').forEach((cb) => (cb.checked = false));
  atualizarResumoEdicoes();
  sugerirDefaultsAuxiliares();
});
listaEdicoesEl.addEventListener('change', (e) => {
  if (e.target.matches('input[name="edicao"]')) {
    atualizarResumoEdicoes();
    sugerirDefaultsAuxiliares();
  }
});

// ---------- Sugestão automática dos % de auxiliar conforme a era da edição ----------
// A CBHPM aumentou os percentuais de auxiliar a partir da edição 2018
// (1º: 30%→60%, 2º: 20%→40%, 3º/4º: 20%→30%). Os campos abaixo só recebem a
// sugestão automática enquanto o usuário não os edita manualmente.
const CAMPOS_AUXILIAR_ERA = ['pct1Auxiliar', 'pct2Auxiliar', 'pct3Auxiliar', 'pct4Auxiliar'];
const DEFAULT_PRE_2018 = { pct1Auxiliar: 30, pct2Auxiliar: 20, pct3Auxiliar: 20, pct4Auxiliar: 20 };
const DEFAULT_POS_2018 = { pct1Auxiliar: 60, pct2Auxiliar: 40, pct3Auxiliar: 30, pct4Auxiliar: 30 };
const camposAuxiliarEditados = new Set();

CAMPOS_AUXILIAR_ERA.forEach((id) => {
  document.getElementById(id).addEventListener('input', () => camposAuxiliarEditados.add(id));
});

document.getElementById('btn-restaurar-auxiliares').addEventListener('click', () => {
  camposAuxiliarEditados.clear();
  sugerirDefaultsAuxiliares();
});

function sugerirDefaultsAuxiliares() {
  const anosSelecionados = Array.from(document.querySelectorAll('input[name="edicao"]:checked'))
    .map((cb) => edicoesDisponiveis.find((e) => e.id === Number(cb.value))?.ano_inicio)
    .filter((ano) => ano !== undefined);

  if (anosSelecionados.length === 0) return;

  const todasPre2018 = anosSelecionados.every((ano) => ano < 2018);
  const defaults = todasPre2018 ? DEFAULT_PRE_2018 : DEFAULT_POS_2018;

  CAMPOS_AUXILIAR_ERA.forEach((id) => {
    if (!camposAuxiliarEditados.has(id)) {
      document.getElementById(id).value = defaults[id];
    }
  });
}

// ---------- Múltiplos procedimentos no mesmo ato (via de acesso) ----------
const mpEdicaoSelectEl = document.getElementById('mp-edicao');
const mpListaEl = document.getElementById('mp-lista');
const mpResultadoAreaEl = document.getElementById('mp-resultado-area');
const formMultiplosEl = document.getElementById('form-multiplos');

const RELACAO_LABELS = {
  principal: 'Principal',
  mesma_via: 'Mesma via',
  via_diferente: 'Via diferente',
  equipe_diferente: 'Equipe diferente',
};
let mpDebounceTimer = null;

function popularSelectEdicaoMp() {
  mpEdicaoSelectEl.innerHTML = edicoesDisponiveis.map((e) => `<option value="${e.id}">${e.nome}</option>`).join('');
  // edicoesDisponiveis vem ordenada por ano_inicio — a última é a mais
  // recente, e é essa que deve abrir selecionada (não a mais antiga, que é
  // o padrão natural de um <select> sem valor explícito).
  const maisRecente = edicoesDisponiveis[edicoesDisponiveis.length - 1];
  if (maisRecente) mpEdicaoSelectEl.value = maisRecente.id;
  aplicarDefaultsAuxiliarMp();
}

// Só há 1 edição selecionada aqui, então a era é exata — sem ambiguidade de mistura.
function aplicarDefaultsAuxiliarMp() {
  const edicao = edicoesDisponiveis.find((e) => e.id === Number(mpEdicaoSelectEl.value));
  if (!edicao) return;
  const defaults = edicao.ano_inicio < 2018 ? DEFAULT_PRE_2018 : DEFAULT_POS_2018;
  Object.entries(defaults).forEach(([id, valor]) => {
    document.getElementById(`mp-${id}`).value = valor;
  });
}
mpEdicaoSelectEl.addEventListener('change', aplicarDefaultsAuxiliarMp);

function mpCriarLinha(relacaoPadrao) {
  const linha = document.createElement('div');
  linha.className = 'mp-linha';
  linha.dataset.codigo = '';
  linha.innerHTML = `
    <div class="busca-wrapper">
      <input type="text" class="mp-busca-input" placeholder="Buscar por código ou descrição" autocomplete="off">
      <div class="busca-dropdown hidden mp-busca-dropdown"></div>
    </div>
    <select class="mp-relacao">
      <option value="principal">Principal</option>
      <option value="mesma_via">Mesma via</option>
      <option value="via_diferente">Via diferente</option>
      <option value="equipe_diferente">Equipe diferente</option>
    </select>
    <button type="button" class="mp-btn-remover" aria-label="Remover procedimento">&times;</button>
  `;
  linha.querySelector('.mp-relacao').value = relacaoPadrao;
  mpListaEl.appendChild(linha);
}

document.getElementById('mp-btn-adicionar').addEventListener('click', () => {
  mpCriarLinha('mesma_via');
});

mpListaEl.addEventListener('click', (e) => {
  if (e.target.closest('.mp-btn-remover')) {
    if (mpListaEl.children.length <= 2) {
      alert('São necessários ao menos 2 procedimentos para simular a sessão.');
      return;
    }
    e.target.closest('.mp-linha').remove();
    return;
  }

  const item = e.target.closest('.busca-item');
  if (item && item.dataset.codigo) {
    const linha = e.target.closest('.mp-linha');
    linha.dataset.codigo = item.dataset.codigo;
    linha.querySelector('.mp-busca-input').value = `${item.dataset.codigo} — ${item.dataset.desc}`;
    linha.querySelector('.mp-busca-dropdown').classList.add('hidden');
  }
});

mpListaEl.addEventListener('input', (e) => {
  if (!e.target.matches('.mp-busca-input')) return;
  const linha = e.target.closest('.mp-linha');
  const dropdown = linha.querySelector('.mp-busca-dropdown');
  const termo = e.target.value.trim();
  linha.dataset.codigo = '';

  clearTimeout(mpDebounceTimer);
  if (termo.length < 2) {
    dropdown.classList.add('hidden');
    return;
  }

  mpDebounceTimer = setTimeout(async () => {
    try {
      const resp = await fetch(`/api/buscar-procedimentos?q=${encodeURIComponent(termo)}`);
      const itens = await resp.json();
      dropdown.innerHTML =
        itens.length === 0
          ? '<div class="busca-vazio">Nenhum procedimento encontrado.</div>'
          : itens
              .map(
                (item) => `
              <div class="busca-item" data-codigo="${item.codigo}" data-desc="${item.descricao.replace(/"/g, '&quot;')}">
                <span class="codigo">${item.codigo}</span>
                <span class="desc">${item.descricao}</span>
              </div>`
              )
              .join('');
      dropdown.classList.remove('hidden');
    } catch (err) {
      console.error(err);
    }
  }, 250);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.mp-linha .busca-wrapper')) {
    document.querySelectorAll('.mp-busca-dropdown').forEach((d) => d.classList.add('hidden'));
  }
});

// ---------- Modal de ajuda (múltiplos procedimentos) ----------
const modalAjudaMpEl = document.getElementById('modal-ajuda-mp');
document.getElementById('btn-ajuda-mp').addEventListener('click', () => {
  modalAjudaMpEl.classList.remove('hidden');
});
document.getElementById('btn-fechar-ajuda-mp').addEventListener('click', () => {
  modalAjudaMpEl.classList.add('hidden');
});
modalAjudaMpEl.addEventListener('click', (e) => {
  if (e.target === modalAjudaMpEl) modalAjudaMpEl.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') modalAjudaMpEl.classList.add('hidden');
});

// ---------- Modal de versões do Padrão TISS ----------
const modalVersoesTissEl = document.getElementById('modal-versoes-tiss');
function abrirModalVersoesTiss() {
  modalVersoesTissEl.classList.remove('hidden');
}
document.getElementById('btn-versoes-tiss').addEventListener('click', abrirModalVersoesTiss);
document.getElementById('btn-fechar-versoes-tiss').addEventListener('click', () => {
  modalVersoesTissEl.classList.add('hidden');
});
modalVersoesTissEl.addEventListener('click', (e) => {
  if (e.target === modalVersoesTissEl) modalVersoesTissEl.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') modalVersoesTissEl.classList.add('hidden');
});

function renderizarResultadoMultiplos(data) {
  if (data.erro) {
    mpResultadoAreaEl.innerHTML = `<div class="msg erro">${data.erro}</div>`;
    return;
  }

  const linhasProcedimentos = data.procedimentos
    .map(
      (p) => `
      <div class="breakdown-row">
        <span class="label">
          ${p.codigo} — ${p.descricao}
          <span class="pct-badge pct-badge-neutro">${RELACAO_LABELS[p.relacao]} · ${p.percentual_relacao}%</span>
          <span class="detail">Porte ${fmtMoeda(p.porte.total_pago)} · UCO ${fmtMoeda(p.uco.total)} · Filme ${fmtMoeda(p.filme.total)}${
            p.porte_anestesico.aplicavel ? ` · Porte Anestésico ${fmtMoeda(p.porte_anestesico.total)}` : ''
          }</span>
        </span>
        <span class="value">${fmtMoeda(p.porte.total_pago + p.uco.total + p.filme.total)}</span>
      </div>`
    )
    .join('');

  const linhaPapel = (papel) => `
    <div class="breakdown-row">
      <span class="label">
        ${papel.papel}
        ${papel.percentual ? `<span class="pct-badge pct-badge-neutro">${papel.percentual}%</span>` : ''}
      </span>
      <span class="value ${papel.total === 0 ? 'zero' : ''}">${fmtMoeda(papel.total)}</span>
    </div>`;

  const s = data.sessao;

  const grupo = (chave, nome, valor, corpoHtml, secundario, aberto) => `
    <details class="grupo ${secundario ? 'grupo-secundario' : 'grupo-principal'}" data-grupo="${chave}" ${aberto ? 'open' : ''}>
      <summary class="grupo-summary">
        <span class="grupo-nome">${nome}</span>
        <span class="grupo-valor">${fmtMoeda(valor)}</span>
      </summary>
      <div class="grupo-corpo">${corpoHtml}</div>
    </details>`;

  const corpoEquipe = `
    <div class="breakdown">${s.equipe.papeis.map(linhaPapel).join('')}</div>
    <div class="referencia-tabela">Base de cálculo (soma dos portes ponderados pela via): ${fmtMoeda(s.equipe.base_calculo)}</div>`;

  mpResultadoAreaEl.innerHTML = `
    <div class="resultado-header">
      <h2>Sessão com ${data.procedimentos.length} procedimentos</h2>
      <div class="resultado-acoes">
        <button type="button" id="btn-mp-exportar-pdf" class="acao-btn">⬇ PDF</button>
        <button type="button" id="btn-mp-exportar-csv" class="acao-btn">⬇ Excel</button>
        <button type="button" id="btn-mp-guia" class="acao-btn">🧾 Guia/Fatura</button>
      </div>
    </div>
    <div class="edicao-card mp-card">
      <div class="edicao-card-head">
        <span class="nome">Procedimentos da sessão</span>
      </div>
      <div class="breakdown">${linhasProcedimentos}</div>

      ${grupo('cirurgiao', 'Valor do procedimento (honorários da sessão)', s.cirurgiao.subtotal, '<div class="referencia-tabela">Soma do porte (já ponderado pela via) + UCO + filme de todos os procedimentos.</div>', false, false)}
      ${s.anestesista.aplicavel ? grupo('anestesista', 'Anestesista (honorário separado, único por sessão)', s.anestesista.total, '<div class="referencia-tabela">Maior porte anestésico entre os procedimentos da sessão.</div>', true, false) : ''}
      ${s.equipe.aplicavel ? grupo('equipe', 'Equipe (auxiliares / instrumentador)', s.equipe.total, corpoEquipe, true, false) : ''}
    </div>
  `;

  ultimaConsultaMultiplos = data;
}

function exportarMultiplosCsv(data) {
  const linhas = [
    ['Código', 'Descrição', 'Relação', '% Relação', 'Porte pago (R$)', 'UCO (R$)', 'Filme (R$)', 'Porte Anestésico (R$)'],
  ];
  data.procedimentos.forEach((p) => {
    linhas.push([
      p.codigo,
      p.descricao,
      RELACAO_LABELS[p.relacao],
      p.percentual_relacao,
      numCsv(p.porte.total_pago),
      numCsv(p.uco.total),
      numCsv(p.filme.total),
      p.porte_anestesico.aplicavel ? numCsv(p.porte_anestesico.total) : '',
    ]);
  });
  linhas.push([]);
  linhas.push(['Valor do procedimento (sessão)', numCsv(data.sessao.cirurgiao.subtotal)]);
  if (data.sessao.anestesista.aplicavel) {
    linhas.push(['Anestesista (sessão)', numCsv(data.sessao.anestesista.total)]);
  }
  if (data.sessao.equipe.aplicavel) {
    linhas.push([]);
    linhas.push(['Equipe', 'Percentual', 'Valor (R$)']);
    data.sessao.equipe.papeis.forEach((p) => linhas.push([p.papel, p.percentual, numCsv(p.total)]));
    linhas.push(['Total equipe', '', numCsv(data.sessao.equipe.total)]);
  }
  baixarCsv('cbhpm-multiplos-procedimentos.csv', linhas);
}

mpResultadoAreaEl.addEventListener('click', (e) => {
  if (e.target.closest('#btn-mp-exportar-pdf')) {
    window.print();
  } else if (e.target.closest('#btn-mp-exportar-csv')) {
    if (ultimaConsultaMultiplos) exportarMultiplosCsv(ultimaConsultaMultiplos);
  } else if (e.target.closest('#btn-mp-guia')) {
    abrirModalGuia('multiplos');
  }
});

// ---------- Guia/fatura simulada (Fase 5 do roadmap) ----------
// Reaproveita o cálculo já feito (consulta única ou múltiplos procedimentos)
// para montar um documento de impressão no formato de guia/fatura. NÃO é um
// XML do Padrão TISS da ANS — guias reais exigem schema oficial e dados de
// credenciamento (CNES, registro ANS) que este portal não coleta.
const modalGuiaEl = document.getElementById('modal-guia');
const campoGuiaEdicaoEl = document.getElementById('campo-guia-edicao');
const guiaEdicaoSelectEl = document.getElementById('guia-edicao');
let fonteGuiaAtual = 'consulta';

function fecharModalGuia() {
  modalGuiaEl.classList.add('hidden');
}

function abrirModalGuia(fonte) {
  fonteGuiaAtual = fonte;

  if (fonte === 'consulta') {
    if (!ultimaConsulta) return;
    campoGuiaEdicaoEl.classList.remove('hidden');
    guiaEdicaoSelectEl.innerHTML = ultimaConsulta.resultados
      .map((r, i) => `<option value="${i}">${r.edicao} (${r.ano})</option>`)
      .join('');
    guiaEdicaoSelectEl.value = String(ultimaConsulta.resultados.length - 1);
  } else {
    if (!ultimaConsultaMultiplos) return;
    campoGuiaEdicaoEl.classList.add('hidden');
  }

  modalGuiaEl.classList.remove('hidden');
}

document.getElementById('btn-fechar-guia').addEventListener('click', fecharModalGuia);
modalGuiaEl.addEventListener('click', (e) => {
  if (e.target === modalGuiaEl) fecharModalGuia();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharModalGuia();
});

function formatarDataBR(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function montarCabecalhoGuia() {
  const paciente = document.getElementById('guia-paciente').value.trim();
  const convenio = document.getElementById('guia-convenio').value.trim();
  const data = document.getElementById('guia-data').value;
  const prestador = document.getElementById('guia-prestador').value.trim();

  return `
    <div class="guia-doc-head">
      <h2>Guia/Fatura</h2>
      <p class="guia-doc-aviso">Documento simulado gerado pelo portal — não é um XML do Padrão TISS da ANS.</p>
      <div class="guia-doc-meta">
        <span>Paciente: <b>${paciente || '—'}</b></span>
        <span>Convênio: <b>${convenio || '—'}</b></span>
        <span>Data do atendimento: <b>${formatarDataBR(data)}</b></span>
        <span>Prestador: <b>${prestador || '—'}</b></span>
      </div>
    </div>`;
}

function gerarGuiaConsulta() {
  const idx = Number(guiaEdicaoSelectEl.value);
  const r = ultimaConsulta.resultados[idx];
  const linhas = [];
  linhas.push(['Cirurgião', r.descricao, r.cirurgiao.subtotal]);
  if (r.anestesista.aplicavel) linhas.push(['Anestesista', `Porte anestésico ${r.anestesista.classificacao ?? '—'}`, r.anestesista.total]);
  if (r.equipe.aplicavel) linhas.push(['Equipe', 'Auxiliares / instrumentador', r.equipe.total]);
  const total = linhas.reduce((soma, l) => soma + l[2], 0);

  return `
    ${montarCabecalhoGuia()}
    <table class="guia-doc-tabela">
      <thead><tr><th>Item</th><th>Descrição</th><th>Valor (R$)</th></tr></thead>
      <tbody>
        ${linhas.map((l) => `<tr><td>${l[0]}</td><td>${l[1]}</td><td>${fmtMoeda(l[2])}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="2">Total</td><td>${fmtMoeda(total)}</td></tr></tfoot>
    </table>`;
}

function gerarGuiaMultiplos() {
  const data = ultimaConsultaMultiplos;
  const linhas = data.procedimentos.map((p) => [
    'Cirurgião',
    `${p.codigo} — ${p.descricao} (${RELACAO_LABELS[p.relacao]})`,
    p.porte.total_pago + p.uco.total + p.filme.total,
  ]);
  if (data.sessao.anestesista.aplicavel) {
    linhas.push(['Anestesista', 'Porte anestésico da sessão (único, maior valor)', data.sessao.anestesista.total]);
  }
  if (data.sessao.equipe.aplicavel) {
    linhas.push(['Equipe', 'Auxiliares / instrumentador da sessão', data.sessao.equipe.total]);
  }
  const total = linhas.reduce((soma, l) => soma + l[2], 0);

  return `
    ${montarCabecalhoGuia()}
    <table class="guia-doc-tabela">
      <thead><tr><th>Item</th><th>Descrição</th><th>Valor (R$)</th></tr></thead>
      <tbody>
        ${linhas.map((l) => `<tr><td>${l[0]}</td><td>${l[1]}</td><td>${fmtMoeda(l[2])}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="2">Total</td><td>${fmtMoeda(total)}</td></tr></tfoot>
    </table>`;
}

document.getElementById('btn-gerar-guia').addEventListener('click', () => {
  const guiaPrintAreaEl = document.getElementById('guia-print-area');
  guiaPrintAreaEl.innerHTML = fonteGuiaAtual === 'consulta' ? gerarGuiaConsulta() : gerarGuiaMultiplos();
  fecharModalGuia();
  document.body.classList.add('modo-guia');
  window.print();
});

window.addEventListener('afterprint', () => {
  document.body.classList.remove('modo-guia');
});

formMultiplosEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const linhas = Array.from(mpListaEl.querySelectorAll('.mp-linha'));
  const procedimentos = linhas.map((linha) => {
    const codigoDigitado = linha.querySelector('.mp-busca-input').value.trim();
    const codigo = linha.dataset.codigo || (/^\d+$/.test(codigoDigitado) ? codigoDigitado : '');
    return { codigo: Number(codigo), relacao: linha.querySelector('.mp-relacao').value };
  });

  if (procedimentos.some((p) => !p.codigo)) {
    mpResultadoAreaEl.innerHTML = '<div class="msg erro">Selecione um procedimento válido em cada linha (busque pela descrição ou digite o código).</div>';
    return;
  }
  if (procedimentos.filter((p) => p.relacao === 'principal').length !== 1) {
    mpResultadoAreaEl.innerHTML = '<div class="msg erro">Marque exatamente um procedimento como "Principal".</div>';
    return;
  }

  const payload = {
    edicaoId: Number(mpEdicaoSelectEl.value),
    procedimentos,
    ajustes: {
      pctPorte: Number(document.getElementById('mp-pctPorte').value) || 0,
      pctUco: Number(document.getElementById('mp-pctUco').value) || 0,
      pctPorteAnestesico: Number(document.getElementById('mp-pctPorteAnestesico').value) || 0,
      valorFilme: Number(document.getElementById('mp-valorFilme').value) || 0,
      pctFilme: Number(document.getElementById('mp-pctFilme').value) || 0,
      pct1Auxiliar: Number(document.getElementById('mp-pct1Auxiliar').value) || 0,
      pct2Auxiliar: Number(document.getElementById('mp-pct2Auxiliar').value) || 0,
      pct3Auxiliar: Number(document.getElementById('mp-pct3Auxiliar').value) || 0,
      pct4Auxiliar: Number(document.getElementById('mp-pct4Auxiliar').value) || 0,
      pctInstrumentador: Number(document.getElementById('mp-pctInstrumentador').value) || 0,
      pctAuxAnestesista: Number(document.getElementById('mp-pctAuxAnestesista').value) || 0,
      pctMesmaVia: Number(document.getElementById('mp-pctMesmaVia').value),
      pctViaDiferente: Number(document.getElementById('mp-pctViaDiferente').value),
      pctEquipeDiferente: Number(document.getElementById('mp-pctEquipeDiferente').value),
    },
  };

  mpResultadoAreaEl.innerHTML = '<div class="msg vazio">Calculando…</div>';

  try {
    const resp = await fetch('/api/consultar-multiplos-procedimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    renderizarResultadoMultiplos(data);
  } catch (err) {
    mpResultadoAreaEl.innerHTML = '<div class="msg erro">Erro ao consultar o servidor.</div>';
    console.error(err);
  }
});

mpCriarLinha('principal');
mpCriarLinha('mesma_via');

function montarComparativo(original, ajustado) {
  const diferenca = ajustado - original;
  const diferencaPct = original !== 0 ? (diferenca / original) * 100 : 0;
  const sinal = diferenca > 0 ? '+' : '';
  const classeDiff = diferenca > 0 ? 'diff-alta' : diferenca < 0 ? 'diff-baixa' : '';

  return `
    <div class="comparativo">
      <div class="comparativo-row">
        <span class="label">Valor original (planilha)</span>
        <span class="value">${fmtMoeda(original)}</span>
      </div>
      <div class="comparativo-row">
        <span class="label">Valor ajustado (simulação)</span>
        <span class="value">${fmtMoeda(ajustado)}</span>
      </div>
      <div class="comparativo-row diferenca ${classeDiff}">
        <span class="label">Diferença</span>
        <span class="value">${sinal}${fmtMoeda(diferenca)} (${sinal}${diferencaPct.toFixed(1)}%)</span>
      </div>
    </div>`;
}

function renderizarResultado(data, ajustes) {
  if (data.erro) {
    resultadoAreaEl.innerHTML = `<div class="msg erro">${data.erro}</div>`;
    return;
  }

  const ajustesCirurgiao =
    ajustes.pctPorte !== 0 || ajustes.pctUco !== 0 || ajustes.pctFilme !== 0 || ajustes.valorFilme !== 0;
  const ajustesAnestesista = ajustes.pctPorteAnestesico !== 0;

  const cards = data.resultados
    .map((r) => {
      const linha = (label, obj, detalhe, mostrarPct) => `
        <div class="breakdown-row">
          <span class="label">
            ${label}
            ${mostrarPct && obj.percentual_aplicado ? `<span class="pct-badge">${obj.percentual_aplicado > 0 ? '+' : ''}${obj.percentual_aplicado}%</span>` : ''}
            <span class="detail">${detalhe}</span>
          </span>
          <span class="value ${obj.total === 0 ? 'zero' : ''}">${fmtMoeda(obj.total)}</span>
        </div>`;

      const linhaPapel = (p) => `
        <div class="breakdown-row">
          <span class="label">
            ${p.papel}
            ${p.percentual ? `<span class="pct-badge pct-badge-neutro">${p.percentual}%</span>` : ''}
          </span>
          <span class="value ${p.total === 0 ? 'zero' : ''}">${fmtMoeda(p.total)}</span>
        </div>`;

      const c = r.cirurgiao;
      const a = r.anestesista;
      const eq = r.equipe;

      const grupo = (chave, nome, valor, corpoHtml, secundario, aberto) => `
        <details class="grupo ${secundario ? 'grupo-secundario' : 'grupo-principal'}" data-grupo="${chave}" ${aberto ? 'open' : ''}>
          <summary class="grupo-summary">
            <span class="grupo-nome">${nome}</span>
            <span class="grupo-valor">${fmtMoeda(valor)}</span>
          </summary>
          <div class="grupo-corpo">${corpoHtml}</div>
        </details>`;

      const corpoCirurgiao = `
        <div class="breakdown">
          ${linha('Porte', c.porte, `${c.porte.classificacao ?? '—'} · fração ${c.porte.fracao} · valor de referência ${fmtMoeda(c.porte.valor_unitario)}`, true)}
          ${linha('UCO', c.uco, `qtd ${c.uco.quantidade} × ${fmtMoeda(c.uco.valor_unitario_referencia)}`, true)}
          ${linha('Filme', c.filme, `${c.filme.quantidade_m2} m² × ${fmtMoeda(c.filme.valor_informado)}`, true)}
        </div>
        ${ajustesCirurgiao ? montarComparativo(c.subtotal_original_planilha, c.subtotal) : ''}`;

      const corpoAnestesista = `
        <div class="breakdown">
          ${linha('Porte Anestésico', a, `classe ${a.classificacao ?? '—'} · valor de referência ${fmtMoeda(a.valor_unitario)}`, true)}
        </div>
        ${ajustesAnestesista ? montarComparativo(a.total_original_planilha, a.total) : ''}`;

      const corpoEquipe = `
        <div class="breakdown">
          ${eq.papeis.map(linhaPapel).join('')}
        </div>
        <div class="referencia-tabela">
          Nº de auxiliares previsto nesta tabela: ${eq.quantidade_auxiliares_procedimento}
          · valor de referência da planilha: ${fmtMoeda(eq.total_original_planilha)}
        </div>`;

      return `
        <div class="edicao-card">
          <div class="edicao-card-head">
            <span class="nome">${r.edicao}</span>
            <span class="ano">${r.ano}</span>
          </div>
          <div class="edicao-card-desc">${r.descricao}</div>

          ${grupo('cirurgiao', 'Valor do procedimento (honorários)', c.subtotal, corpoCirurgiao, false, false)}
          ${a.aplicavel ? grupo('anestesista', 'Anestesista (honorário separado)', a.total, corpoAnestesista, true, false) : ''}
          ${eq.aplicavel ? grupo('equipe', 'Equipe (auxiliares / instrumentador)', eq.total, corpoEquipe, true, false) : ''}
        </div>`;
    })
    .join('');

  const descricaoAtual = data.resultados[0]?.descricao || '';

  const mapeamentoHtml = (data.mapeamento_amb_tuss && data.mapeamento_amb_tuss.length > 0)
    ? `<div class="amb-tuss-box">
        <span class="amb-tuss-label">Códigos equivalentes</span>
        ${data.mapeamento_amb_tuss
          .map((m) => {
            const itens = [
              m.codigo_amb90 ? `AMB 90: <b>${m.codigo_amb90}</b>` : '',
              m.codigo_amb92 ? `AMB 92: <b>${m.codigo_amb92}</b>` : '',
              m.codigo_amb96 ? `AMB 96: <b>${m.codigo_amb96}</b>` : '',
              m.codigo_amb99 ? `AMB 99: <b>${m.codigo_amb99}</b>` : '',
              m.codigo_tuss ? `TUSS: <b>${m.codigo_tuss}</b>` : '',
            ].filter(Boolean).join(' &nbsp;·&nbsp; ');
            return `<div class="amb-tuss-item">${itens || 'Sem equivalência mapeada'}</div>`;
          })
          .join('')}
      </div>`
    : '';

  resultadoAreaEl.innerHTML = `
    <div class="resultado-header">
      <h2>Código <span class="codigo-tag">${data.codigo}</span></h2>
      <div class="resultado-acoes">
        <button type="button" id="btn-favoritar" class="acao-btn ${isFavorito(data.codigo) ? 'ativo' : ''}" data-codigo="${data.codigo}" data-descricao="${descricaoAtual.replace(/"/g, '&quot;')}">
          ${isFavorito(data.codigo) ? '★ Favoritado' : '☆ Favoritar'}
        </button>
        <button type="button" id="btn-exportar-pdf" class="acao-btn">⬇ PDF</button>
        <button type="button" id="btn-exportar-csv" class="acao-btn">⬇ Excel</button>
        <button type="button" id="btn-guia" class="acao-btn">🧾 Guia/Fatura</button>
      </div>
    </div>
    ${mapeamentoHtml}
    <div class="cards-grid">${cards}</div>
  `;

  montarDashboard(data);
  ultimaConsulta = data;
}

// ---------- Exportar (PDF via impressão do navegador / Excel via CSV) ----------
function csvEscape(valor) {
  const s = String(valor ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function numCsv(v) {
  return Number(v).toFixed(2).replace('.', ',');
}
function baixarCsv(nomeArquivo, linhas) {
  const conteudo = String.fromCharCode(0xfeff) + linhas.map((linha) => linha.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportarConsultaCsv(data) {
  const linhas = [
    ['Código', data.codigo],
    [],
    ['Edição', 'Ano', 'Porte (R$)', 'UCO (R$)', 'Filme (R$)', 'Valor do Procedimento (R$)', 'Valor Original Planilha (R$)', 'Anestesista (R$)', 'Equipe Total (R$)'],
  ];
  data.resultados.forEach((r) => {
    linhas.push([
      r.edicao,
      r.ano,
      numCsv(r.cirurgiao.porte.total),
      numCsv(r.cirurgiao.uco.total),
      numCsv(r.cirurgiao.filme.total),
      numCsv(r.cirurgiao.subtotal),
      numCsv(r.cirurgiao.subtotal_original_planilha),
      r.anestesista.aplicavel ? numCsv(r.anestesista.total) : '',
      r.equipe.aplicavel ? numCsv(r.equipe.total) : '',
    ]);
  });
  baixarCsv(`cbhpm-codigo-${data.codigo}.csv`, linhas);
}

resultadoAreaEl.addEventListener('click', (e) => {
  if (e.target.closest('#btn-favoritar')) {
    const btn = e.target.closest('#btn-favoritar');
    alternarFavorito(btn.dataset.codigo, btn.dataset.descricao);
    btn.classList.toggle('ativo');
    btn.textContent = btn.classList.contains('ativo') ? '★ Favoritado' : '☆ Favoritar';
  } else if (e.target.closest('#btn-exportar-pdf')) {
    window.print();
  } else if (e.target.closest('#btn-exportar-csv')) {
    if (ultimaConsulta) exportarConsultaCsv(ultimaConsulta);
  } else if (e.target.closest('#btn-guia')) {
    abrirModalGuia('consulta');
  }
});

// ---------- Dashboard comparativo (um gráfico de barras por item) ----------
const dashboardAreaEl = document.getElementById('dashboard-area');
const chartTooltipEl = document.getElementById('chart-tooltip');

function graficoBarras(itens, corVar) {
  const W = 340;
  const H = 190;
  const padTop = 24;
  const padBottom = 22;
  const padSide = 10;
  const baselineY = H - padBottom;
  const plotH = H - padTop - padBottom;
  const plotW = W - padSide * 2;

  const maxValor = Math.max(...itens.map((i) => i.valor), 0.01);
  const slot = plotW / itens.length;
  const barW = Math.min(24, slot * 0.55);

  // Rotulagem seletiva: com poucas barras cabe o valor em cima de cada uma;
  // com muitas, só o eixo (espaçado para não colidir) e o valor fica no hover.
  const mostrarValores = itens.length <= 6;
  const maxEixoLabels = Math.max(1, Math.floor(plotW / 30));
  const passoEixo = Math.ceil(itens.length / maxEixoLabels);

  const gridlines = [0.25, 0.5, 0.75]
    .map((frac) => {
      const y = baselineY - plotH * frac;
      return `<line class="grafico-gridline" x1="${padSide}" y1="${y}" x2="${W - padSide}" y2="${y}"></line>`;
    })
    .join('');

  const barras = itens
    .map((item, idx) => {
      const cx = padSide + slot * idx + slot / 2;
      const x = cx - barW / 2;
      const barH = maxValor > 0 ? (item.valor / maxValor) * plotH : 0;
      const yTop = baselineY - barH;
      const r = Math.min(4, barH, barW / 2);

      const path =
        barH <= 0
          ? ''
          : `<path class="grafico-barra" fill="${corVar}"
              d="M${x},${baselineY}
                 L${x},${yTop + r}
                 Q${x},${yTop} ${x + r},${yTop}
                 L${x + barW - r},${yTop}
                 Q${x + barW},${yTop} ${x + barW},${yTop + r}
                 L${x + barW},${baselineY} Z"></path>`;

      const valorLabel = mostrarValores
        ? `<text class="grafico-valor-label" x="${cx}" y="${yTop - 6}" text-anchor="middle">${fmtMoeda(item.valor).replace('R$', '').trim()}</text>`
        : '';
      const eixoLabel =
        idx % passoEixo === 0 || idx === itens.length - 1
          ? `<text class="grafico-eixo-label" x="${cx}" y="${baselineY + 14}" text-anchor="middle">${item.label}</text>`
          : '';

      return `
        <g>
          ${path}
          ${valorLabel}
          ${eixoLabel}
          <rect class="grafico-hit" data-edicao="${item.edicaoNome}" data-valor="${fmtMoeda(item.valor)}"
            x="${padSide + slot * idx}" y="${padTop - 12}" width="${slot}" height="${plotH + 12}" fill="transparent"></rect>
        </g>`;
    })
    .join('');

  return `
    <svg class="grafico-svg" viewBox="0 0 ${W} ${H}" role="img">
      ${gridlines}
      <line class="grafico-baseline" x1="${padSide}" y1="${baselineY}" x2="${W - padSide}" y2="${baselineY}"></line>
      ${barras}
    </svg>`;
}

function montarDashboard(data) {
  dashboardAreaEl.innerHTML = '';

  if (data.erro || !data.resultados || data.resultados.length < 2) {
    return;
  }

  const grupos = [];

  grupos.push({
    titulo: 'Valor do procedimento (honorários)',
    cor: 'var(--teal)',
    itens: data.resultados.map((r) => ({
      label: String(r.ano),
      edicaoNome: r.edicao,
      valor: r.cirurgiao.subtotal,
    })),
  });

  if (data.resultados.some((r) => r.anestesista.aplicavel)) {
    grupos.push({
      titulo: 'Anestesista (honorário separado)',
      cor: 'var(--amber)',
      itens: data.resultados.map((r) => ({
        label: String(r.ano),
        edicaoNome: r.edicao,
        valor: r.anestesista.aplicavel ? r.anestesista.total : 0,
      })),
    });
  }

  const primeiraEquipe = data.resultados.find((r) => r.equipe.aplicavel)?.equipe;
  if (primeiraEquipe) {
    primeiraEquipe.papeis.forEach((papel, idx) => {
      const itens = data.resultados.map((r) => ({
        label: String(r.ano),
        edicaoNome: r.edicao,
        valor: r.equipe.aplicavel ? r.equipe.papeis[idx].total : 0,
      }));
      if (itens.some((i) => i.valor > 0)) {
        grupos.push({ titulo: `Equipe — ${papel.papel}`, cor: 'var(--amber)', itens });
      }
    });
  }

  const cards = grupos
    .map(
      (g) => `
      <div class="grafico-card">
        <div class="grafico-titulo">${g.titulo}</div>
        ${graficoBarras(g.itens, g.cor)}
      </div>`
    )
    .join('');

  dashboardAreaEl.innerHTML = `
    <h2 class="dashboard-titulo">Comparativo entre edições selecionadas</h2>
    <div class="dashboard-grid">${cards}</div>
  `;
}

dashboardAreaEl.addEventListener('pointerover', (e) => {
  const hit = e.target.closest('.grafico-hit');
  if (!hit) return;
  chartTooltipEl.innerHTML = `
    <div class="tt-edicao"></div>
    <div class="tt-valor"></div>`;
  chartTooltipEl.querySelector('.tt-edicao').textContent = hit.dataset.edicao;
  chartTooltipEl.querySelector('.tt-valor').textContent = hit.dataset.valor;
  chartTooltipEl.classList.remove('hidden');
});
dashboardAreaEl.addEventListener('pointermove', (e) => {
  if (chartTooltipEl.classList.contains('hidden')) return;
  chartTooltipEl.style.left = `${e.clientX + 14}px`;
  chartTooltipEl.style.top = `${e.clientY + 14}px`;
});
dashboardAreaEl.addEventListener('pointerout', (e) => {
  if (!e.target.closest('.grafico-hit')) return;
  chartTooltipEl.classList.add('hidden');
});

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const codigo = document.getElementById('codigo').value.trim();
  const edicoesSelecionadas = Array.from(
    document.querySelectorAll('input[name="edicao"]:checked')
  ).map((cb) => Number(cb.value));

  if (edicoesSelecionadas.length === 0) {
    resultadoAreaEl.innerHTML = '<div class="msg erro">Selecione ao menos uma edição.</div>';
    return;
  }

  const payload = {
    codigo: Number(codigo),
    edicoes: edicoesSelecionadas,
    ajustes: {
      pctPorte: Number(document.getElementById('pctPorte').value) || 0,
      pctUco: Number(document.getElementById('pctUco').value) || 0,
      pctPorteAnestesico: Number(document.getElementById('pctPorteAnestesico').value) || 0,
      valorFilme: Number(document.getElementById('valorFilme').value) || 0,
      pctFilme: Number(document.getElementById('pctFilme').value) || 0,
      pct1Auxiliar: Number(document.getElementById('pct1Auxiliar').value) || 0,
      pct2Auxiliar: Number(document.getElementById('pct2Auxiliar').value) || 0,
      pct3Auxiliar: Number(document.getElementById('pct3Auxiliar').value) || 0,
      pct4Auxiliar: Number(document.getElementById('pct4Auxiliar').value) || 0,
      pctInstrumentador: Number(document.getElementById('pctInstrumentador').value) || 0,
      pctAuxAnestesista: Number(document.getElementById('pctAuxAnestesista').value) || 0,
    },
  };

  resultadoAreaEl.innerHTML = '<div class="msg vazio">Consultando…</div>';

  try {
    const resp = await fetch('/api/consultar-procedimento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    renderizarResultado(data, payload.ajustes);
  } catch (err) {
    resultadoAreaEl.innerHTML = '<div class="msg erro">Erro ao consultar o servidor.</div>';
    console.error(err);
  }
});

// ---------- Validador de XML TISS ----------
// Roda inteiramente no navegador — o arquivo nunca é enviado a um servidor.
// Não é um validador oficial certificado pela ANS: cobre checagens
// estruturais e aritméticas documentadas no Componente Organizacional do
// Padrão TISS (hash MD5, versão, tipos de guia, códigos de tabela, valores
// por item e total da guia) e a convenção de nomenclatura de arquivo de
// algumas operadoras Unimed (0/2/5).
const validadorArquivoEl = document.getElementById('validador-arquivo');
const validadorResultadoEl = document.getElementById('validador-resultado-area');

const TISS_VERSOES_CONHECIDAS = ['4.00.00', '4.00.01', '4.01.00', '4.02.00', '4.03.00'];
const TISS_VERSAO_VIGENTE = '4.03.00'; // obrigatória desde 01/07/2026 (Ofício-Circular nº 6/2025/COEST/GPIND/DIRAD-DIDES/DIDES)
const TISS_CODIGOS_TABELA = {
  '00': 'Tabela própria das operadoras',
  '18': 'Diárias, taxas e gases medicinais',
  '19': 'Materiais e OPME',
  '20': 'Medicamentos',
  '22': 'Procedimentos e eventos em saúde (TUSS)',
  '90': 'Tabela própria — pacote odontológico',
  '98': 'Tabela própria — pacotes',
};
const UNIMED_ROTULOS_ARQUIVO = {
  '0': 'Resumo de internação e médicos não credenciados',
  '2': 'SP-SADT credenciados',
  '5': 'Honorário individual dos credenciados',
};
// Tabela de Domínio 25 "Código da Despesa" (codigoDespesa, elemento
// <ans:despesa> dentro de <ans:outrasDespesas>) — a tabela anterior estava
// errada (03 não é "Gases Medicinais", 07 não é "OPME") e um arquivo real
// do usuário expôs o erro (agulha/seringa/luva vinham com código 03,
// taxas de aplicação vinham com código 07). Corrigida com dois PDFs
// oficiais independentes ("Tabelas de Domínio do Padrão TISS", versões
// 3.02.00 e 4.02.00) — só existem 6 códigos nessa tabela, não 9.
const TISS_CODIGOS_DESPESA = {
  '01': 'Gases medicinais',
  '02': 'Medicamentos',
  '03': 'Materiais',
  '05': 'Diárias',
  '07': 'Taxas e aluguéis',
  '08': 'OPME',
};
// Tabela de Domínio 26 "Conselho Profissional" e Tabela de Domínio 35
// "Grau de Participação" do Padrão TISS — verificadas por extração de texto
// direta do PDF oficial "Tabelas de Domínio do Padrão TISS" (não é palpite).
const TISS_CONSELHOS = {
  '01': 'Conselho Regional de Assistência Social (CRAS)',
  '02': 'Conselho Regional de Enfermagem (COREN)',
  '03': 'Conselho Regional de Farmácia (CRF)',
  '04': 'Conselho Regional de Fonoaudiologia (CRFA)',
  '05': 'Conselho Regional de Fisioterapia e Terapia Ocupacional (CREFITO)',
  '06': 'Conselho Regional de Medicina (CRM)',
  '07': 'Conselho Regional de Nutrição (CRN)',
  '08': 'Conselho Regional de Odontologia (CRO)',
  '09': 'Conselho Regional de Psicologia (CRP)',
  '10': 'Outros Conselhos',
};
const TISS_GRAU_PARTICIPACAO = {
  '00': 'Cirurgião',
  '01': '1º Auxiliar',
  '02': '2º Auxiliar',
  '03': '3º Auxiliar',
  '04': '4º Auxiliar',
  '05': 'Instrumentador',
  '06': 'Anestesista',
  '07': 'Auxiliar de Anestesista',
  '08': 'Consultor',
  '09': 'Perfusionista',
  '10': 'Pediatra na sala de parto',
  '11': 'Auxiliar SADT',
  '12': 'Clínico',
  '13': 'Intensivista',
};
// Tabelas de domínio 23, 36, 48, 50, 52, 59 e 61 do Padrão TISS — usadas na
// impressão da guia SP/SADT no layout oficial ANS. Extraídas diretamente de
// public/tiss-tabelas-dominio.json (já verificado contra fonte oficial —
// ver aba Tabelas TISS), não são palpite. Tabela 50 (Tipo de Atendimento)
// tem só os códigos confirmados na nossa fonte; a crítica oficial da ANS
// (dicionário de glosas, código 1602) cita outros códigos (05,06,07,11,14–22)
// que não estão em public/tiss-tabelas-dominio.json — por isso o fallback
// abaixo mostra o código bruto quando não encontrado, em vez de inventar.
const TISS_CARATER_ATENDIMENTO = { '1': 'Eletivo', '2': 'Urgência/Emergência' };
const TISS_INDICADOR_ACIDENTE = { '0': 'Trabalho', '1': 'Trânsito', '2': 'Outros', '9': 'Não Acidente' };
const TISS_TECNICA_UTILIZADA = { '1': 'Convencional', '2': 'Vídeo', '3': 'Robótica' };
const TISS_TIPO_ATENDIMENTO = {
  '01': 'Remoção', '02': 'Pequena Cirurgia', '03': 'Outras Terapias', '04': 'Consulta',
  '08': 'Quimioterapia', '09': 'Radioterapia', '10': 'Terapia Renal Substitutiva (TRS)',
  '13': 'Pequeno atendimento (sutura, gesso e outros)', '23': 'Exame',
};
const TISS_TIPO_CONSULTA = { '1': 'Primeira Consulta', '2': 'Retorno', '3': 'Pré-natal', '4': 'Por encaminhamento' };
const TISS_VIA_ACESSO = { '1': 'Única', '2': 'Mesma via', '3': 'Diferentes vias' };
const TISS_REGIME_ATENDIMENTO = { '01': 'Ambulatorial', '02': 'Domiciliar', '03': 'Internação', '04': 'Pronto-socorro', '05': 'TELESSAÚDE' };
const TISS_MOTIVO_ENCERRAMENTO = {
  '11': 'Alta Curado', '12': 'Alta Melhorado', '14': 'Alta a pedido',
  '15': 'Alta com previsão de retorno para acompanhamento do paciente',
  '16': 'Alta por Evasão', '18': 'Alta por outros motivos', '19': 'Alta de Paciente Agudo em Psiquiatria',
  '21': 'Permanência, por características próprias da doença', '22': 'Permanência, por intercorrência',
  '23': 'Permanência, por impossibilidade sócio-familiar',
  '24': 'Permanência, por processo de doação de órgãos/tecidos/células - doador vivo',
  '25': 'Permanência, por processo de doação de órgãos/tecidos/células - doador morto',
  '26': 'Permanência, por mudança de procedimento', '27': 'Permanência, por reoperação', '28': 'Permanência, outros motivos',
  '31': 'Transferido para outro estabelecimento', '32': 'Transferência para internação domiciliar',
  '41': 'Óbito com declaração de óbito fornecida pelo médico assistente',
  '42': 'Óbito com declaração de óbito fornecida pelo IML', '43': 'Óbito com declaração de óbito fornecida pelo SVO',
  '51': 'Encerramento administrativo', '61': 'Alta da mãe/puérpera e do recém-nascido',
  '62': 'Alta da mãe/puérpera e permanência do recém-nascido', '63': 'Alta da mãe/puérpera e óbito do recém-nascido',
  '64': 'Alta da mãe/puérpera com óbito fetal', '65': 'Óbito da gestante e do concepto',
  '66': 'Óbito da mãe/puérpera e alta do recém-nascido', '67': 'Óbito da mãe/puérpera e permanência do recém-nascido',
};
// Tabelas 41, 55 e 57 — usadas na impressão da guia de Resumo de Internação.
const TISS_REGIME_INTERNACAO = { '1': 'Hospitalar', '2': 'Hospital-dia', '3': 'Domiciliar' };
const TISS_TIPO_FATURAMENTO = { '1': 'Parcial', '2': 'Final', '3': 'Complementar', '4': 'Total' };
const TISS_TIPO_INTERNACAO = { '1': 'Clínica', '2': 'Cirúrgica', '3': 'Obstétrica', '4': 'Pediátrica', '5': 'Psiquiátrica' };
// Tabela 60 (Unidade de Medida) — usada no Anexo de Outras Despesas
// (campo 13, unidadeMedida). Extraída de public/tiss-tabelas-dominio.json
// (já verificado contra fonte oficial), só a sigla (não a descrição longa).
const TISS_UNIDADE_MEDIDA = {
  '001': 'AMP', '002': 'BUI', '003': 'BG', '004': 'BOLS', '005': 'CX', '006': 'CAP', '007': 'CARP',
  '008': 'COM', '009': 'DOSE', '010': 'DRG', '011': 'ENV', '012': 'FLAC', '013': 'FR', '014': 'FA',
  '015': 'GAL', '016': 'GLOB', '017': 'GTS', '018': 'G', '019': 'L', '020': 'MCG', '021': 'MUI',
  '022': 'MG', '023': 'ML', '024': 'OVL', '025': 'PAS', '026': 'LT', '027': 'PER', '028': 'PIL',
  '029': 'PT', '030': 'KG', '031': 'SER', '032': 'SUP', '033': 'TABLE', '034': 'TUB', '035': 'TB',
  '036': 'UN', '037': 'UI', '038': 'CM', '039': 'CONJ', '040': 'KIT', '041': 'MÇ', '042': 'M',
  '043': 'PC', '044': 'PÇ', '045': 'RL', '046': 'GY', '047': 'CGY', '048': 'PAR', '049': 'ADES',
  '050': 'COM EFEV', '051': 'COM MST', '052': 'SACHE', '053': 'M', '054': 'M²', '055': 'M³',
  '056': 'MG/peso', '057': 'MG/M²', '058': 'CAL', '059': 'UI/M²', '060': 'UI/ML', '061': 'CM³',
};
const TISS_UF_SIGLA = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF', '98': 'EX',
};
const GRUPO_PROCEDIMENTOS = 'Procedimentos (honorários)';
const GRUPO_CONSULTAS = 'Consultas';
const ORDEM_GRUPOS_DESPESA = [
  ...Object.values(TISS_CODIGOS_DESPESA),
  GRUPO_PROCEDIMENTOS,
  GRUPO_CONSULTAS,
];

let operadorasAnsCache = null;
async function carregarOperadorasAns() {
  if (operadorasAnsCache) return operadorasAnsCache;
  try {
    const resp = await fetch('operadoras-ans.json');
    operadorasAnsCache = await resp.json();
  } catch {
    operadorasAnsCache = {};
  }
  return operadorasAnsCache;
}

let cboMedicosCache = null;
async function carregarCboMedicos() {
  if (cboMedicosCache) return cboMedicosCache;
  try {
    const resp = await fetch('cbo-medicos.json');
    cboMedicosCache = await resp.json();
  } catch {
    cboMedicosCache = {};
  }
  return cboMedicosCache;
}

// Validação estrutural contra o XSD oficial do Padrão TISS 4.03.00 — a
// checagem mais rigorosa do validador (schema real da ANS, não só os campos
// que já conferimos manualmente). Roda inteiramente no navegador via
// xmllint-wasm (libxml2 compilado para WebAssembly, ver
// vendor/xmllint-wasm/LICENSE), carregado sob demanda (só quando o usuário
// usa o validador) para não pesar no carregamento inicial da página.
// Os 6 arquivos XSD (ver public/tiss-xsd/) são o "Componente de
// Comunicação" oficial baixado de gov.br/ans — ver atualizar-tiss-xsd.js.
const TISS_XSD_ARQUIVOS = [
  'tissV4_03_00.xsd',
  'tissSimpleTypesV4_03_00.xsd',
  'tissComplexTypesV4_03_00.xsd',
  'tissGuiasV4_03_00.xsd',
  'tissAssinaturaDigital_v1.01.xsd',
  'xmldsig-core-schema.xsd',
];

let tissXsdCache = null;
async function carregarXsdTiss() {
  if (tissXsdCache) return tissXsdCache;
  const [modulo, ...conteudos] = await Promise.all([
    import('./vendor/xmllint-wasm/index-browser.mjs'),
    ...TISS_XSD_ARQUIVOS.map((nome) => fetch(`tiss-xsd/${nome}`).then((r) => r.text())),
  ]);
  const [principal, ...deps] = conteudos;
  tissXsdCache = {
    validateXML: modulo.validateXML,
    principal,
    preload: deps.map((c, i) => ({ fileName: TISS_XSD_ARQUIVOS[i + 1], contents: c })),
  };
  return tissXsdCache;
}

async function validarEstruturaXsdTiss(textoXml, nomeArquivo) {
  try {
    const { validateXML, principal, preload } = await carregarXsdTiss();
    const resultado = await validateXML({
      xml: [{ fileName: nomeArquivo, contents: textoXml }],
      schema: [principal],
      preload,
    });
    return { disponivel: true, valid: resultado.valid, erros: resultado.errors.map((e) => e.message) };
  } catch (err) {
    console.error('Falha ao validar contra o XSD do Padrão TISS:', err);
    return { disponivel: false, valid: null, erros: [], erroCarregamento: err.message };
  }
}

function detectarEncodingXml(bytes) {
  const inicio = new TextDecoder('ascii').decode(bytes.slice(0, 200));
  const m = inicio.match(/encoding=["']([\w-]+)["']/i);
  if (!m) return 'utf-8';
  const enc = m[1].toLowerCase();
  return enc === 'iso-8859-1' || enc === 'latin1' ? 'iso-8859-1' : 'utf-8';
}

async function lerArquivoTiss(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const encoding = detectarEncodingXml(bytes);
  return new TextDecoder(encoding).decode(bytes);
}

// Algoritmo oficial do hash do epílogo TISS (Componente Organizacional, item
// 115 "HASH MD-5"): MD5 sobre a concatenação literal do conteúdo de cada
// tag-folha, na ordem em que aparecem, excluindo nomes de tags/atributos e a
// própria tag <ans:hash>, codificado em ISO-8859-1. Verificado nesta sessão
// contra hashes reais (inclusive com acentuação) antes de ser usado aqui.
function calcularHashTiss(textoXml) {
  const semProlog = textoXml.replace(/^<\?xml[^>]*\?>\s*/, '');
  let concatenado = '';
  const re = /<([A-Za-z][\w:.-]*)\b[^>]*>([^<]*)<\/\1>/g;
  let m;
  while ((m = re.exec(semProlog)) !== null) {
    if (m[1] === 'ans:hash') continue;
    concatenado += m[2];
  }
  const bytes = [];
  for (let i = 0; i < concatenado.length; i++) {
    const code = concatenado.charCodeAt(i);
    bytes.push(code <= 0xff ? code : 0x3f);
  }
  return md5Hex(bytes);
}

function filhosTiss(el, nomeLocal) {
  return el ? Array.from(el.children).filter((c) => c.localName === nomeLocal) : [];
}
function filhoTiss(el, nomeLocal) {
  return filhosTiss(el, nomeLocal)[0] || null;
}
function textoDeTiss(el, nomeLocal) {
  const f = filhoTiss(el, nomeLocal);
  return f ? f.textContent.trim() : '';
}
function buscarProfundoTiss(el, nomeLocal) {
  if (el.localName === nomeLocal) return el;
  for (const filho of el.children) {
    const achado = buscarProfundoTiss(filho, nomeLocal);
    if (achado) return achado;
  }
  return null;
}
function numDeTiss(texto) {
  if (texto === '' || texto === undefined || texto === null) return null;
  const n = Number(String(texto).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Extrai a identificação de um profissional a partir de qualquer bloco que
// tenha esses campos (profissionalSolicitante, profissionalExecutante,
// equipeSadt, identificacaoEquipe, profissionais de guiaHonorarios) — os
// nomes dos elementos variam ligeiramente entre eles (nomeProfissional/
// nomeProf, conselhoProfissional/conselho, CBOS/CBO, grauPart/
// grauParticipacao — confirmado no XSD oficial), então tenta as duas formas.
function extrairProfissionalTiss(el) {
  if (!el) return null;
  const nome = textoDeTiss(el, 'nomeProfissional') || textoDeTiss(el, 'nomeProf');
  const conselho = textoDeTiss(el, 'conselhoProfissional') || textoDeTiss(el, 'conselho');
  const numeroConselho = textoDeTiss(el, 'numeroConselhoProfissional');
  const uf = textoDeTiss(el, 'UF');
  const cbo = textoDeTiss(el, 'CBOS') || textoDeTiss(el, 'CBO');
  const grauPart = textoDeTiss(el, 'grauPart') || textoDeTiss(el, 'grauParticipacao');
  if (!nome && !conselho && !numeroConselho && !cbo) return null;
  return { nome, conselho, numeroConselho, uf, cbo, grauPart };
}

// Profissionais da equipe de um procedimento executado — o nome do bloco
// muda conforme o tipo de guia (confirmado no XSD oficial,
// tissComplexTypesV4_03_00.xsd): guiaSP-SADT usa <equipeSadt> direto (0..N,
// ct_procedimentoExecutadoSadt); guiaResumoInternacao usa <identEquipe>
// <identificacaoEquipe> (0..N, ct_procedimentoExecutadoInt); guiaHonorarios
// (honorário individual dos credenciados) usa <profissionais> direto (0..N,
// ct_procedimentoExecutadoHonorIndiv) — mesmos dados, nomes diferentes.
function extrairProfissionaisItemTiss(itemEl) {
  const lista = [];
  filhosTiss(itemEl, 'equipeSadt').forEach((el) => {
    const p = extrairProfissionalTiss(el);
    if (p) lista.push(p);
  });
  filhosTiss(itemEl, 'identEquipe').forEach((wrapper) => {
    const p = extrairProfissionalTiss(filhoTiss(wrapper, 'identificacaoEquipe'));
    if (p) lista.push(p);
  });
  filhosTiss(itemEl, 'profissionais').forEach((el) => {
    const p = extrairProfissionalTiss(el);
    if (p) lista.push(p);
  });
  return lista;
}

function analisarItemTiss(itemEl, procEl, extras = {}) {
  const codigoTabela = textoDeTiss(procEl, 'codigoTabela');
  const codigoProcedimento = textoDeTiss(procEl, 'codigoProcedimento');
  const descricaoProcedimento = textoDeTiss(procEl, 'descricaoProcedimento') || textoDeTiss(itemEl, 'descricaoProcedimento');
  const dataExecucao = textoDeTiss(itemEl, 'dataExecucao');
  const quantidade = numDeTiss(textoDeTiss(itemEl, 'quantidadeExecutada')) ?? 1;
  const reducao = numDeTiss(textoDeTiss(itemEl, 'reducaoAcrescimo')) ?? 1;
  const valorUnitario = numDeTiss(textoDeTiss(itemEl, 'valorUnitario'));
  const valorTotal = numDeTiss(textoDeTiss(itemEl, 'valorTotal'));
  const esperado = valorUnitario !== null ? Number((valorUnitario * quantidade * reducao).toFixed(2)) : null;
  const ok = valorTotal !== null && esperado !== null ? Math.abs(valorTotal - esperado) <= 0.02 : null;
  const profissionais = extrairProfissionaisItemTiss(itemEl);
  return {
    codigoTabela,
    codigoProcedimento,
    descricaoProcedimento,
    dataExecucao,
    quantidade,
    reducao,
    valorUnitario,
    valorTotal,
    esperado,
    ok,
    codigoDespesa: extras.codigoDespesa || '',
    grupo: extras.grupo || GRUPO_PROCEDIMENTOS,
    profissionais,
  };
}

function analisarGuiaTiss(guiaEl, tipo) {
  const cabecalho = filhoTiss(guiaEl, 'cabecalhoGuia') || filhoTiss(guiaEl, 'cabecalhoConsulta');
  const registroANS = textoDeTiss(cabecalho, 'registroANS');
  const numeroGuiaPrestador = textoDeTiss(cabecalho, 'numeroGuiaPrestador');

  const profissionais = [];
  const dadosSolicitante = filhoTiss(guiaEl, 'dadosSolicitante');
  const solicitante = extrairProfissionalTiss(filhoTiss(dadosSolicitante, 'profissionalSolicitante'));
  if (solicitante) profissionais.push({ ...solicitante, papel: 'Solicitante' });
  // guiaConsulta tem o profissional executante direto na guia (não dentro de equipeSadt).
  const executanteConsulta = extrairProfissionalTiss(filhoTiss(guiaEl, 'profissionalExecutante'));
  if (executanteConsulta) profissionais.push({ ...executanteConsulta, papel: 'Executante' });

  const itens = [];
  const registrarItemProcedimento = (pe) => {
    const proc = filhoTiss(pe, 'procedimento');
    if (!proc) return;
    const item = analisarItemTiss(pe, proc, { grupo: GRUPO_PROCEDIMENTOS });
    itens.push(item);
    item.profissionais.forEach((p) => {
      if (!profissionais.some((existente) => existente.numeroConselho === p.numeroConselho && existente.grauPart === p.grauPart)) {
        profissionais.push({ ...p, papel: 'Equipe' });
      }
    });
  };
  // guiaSP-SADT / guiaResumoInternacao usam procedimentosExecutados/procedimentoExecutado;
  // guiaHonorarios (honorário individual dos credenciados) usa
  // procedimentosRealizados/procedimentoRealizado — nomes diferentes,
  // mesma forma de item (confirmado no XSD oficial, tissGuiasV4_03_00.xsd).
  filhosTiss(filhoTiss(guiaEl, 'procedimentosExecutados'), 'procedimentoExecutado').forEach(registrarItemProcedimento);
  filhosTiss(filhoTiss(guiaEl, 'procedimentosRealizados'), 'procedimentoRealizado').forEach(registrarItemProcedimento);
  const outrasDespesas = filhoTiss(guiaEl, 'outrasDespesas');
  filhosTiss(outrasDespesas, 'despesa').forEach((d) => {
    const servico = filhoTiss(d, 'servicosExecutados');
    if (servico) {
      const codigoDespesa = textoDeTiss(d, 'codigoDespesa');
      const grupo = TISS_CODIGOS_DESPESA[codigoDespesa] || `Despesa (código ${codigoDespesa || '?'})`;
      itens.push(analisarItemTiss(servico, servico, { codigoDespesa, grupo }));
    }
  });

  // guiaConsulta não tem quantidade/redução/valorTotal por item — só um
  // valorProcedimento único embutido em dadosAtendimento/procedimento.
  let consultaItem = null;
  if (tipo === 'guiaConsulta') {
    const dadosAtendimento = filhoTiss(guiaEl, 'dadosAtendimento');
    const proc = filhoTiss(dadosAtendimento, 'procedimento');
    if (proc) {
      consultaItem = {
        codigoTabela: textoDeTiss(proc, 'codigoTabela'),
        codigoProcedimento: textoDeTiss(proc, 'codigoProcedimento'),
        descricaoProcedimento: '',
        dataExecucao: textoDeTiss(dadosAtendimento, 'dataAtendimento'),
        quantidade: 1,
        valorTotal: numDeTiss(textoDeTiss(proc, 'valorProcedimento')),
        grupo: GRUPO_CONSULTAS,
        profissionais: executanteConsulta ? [executanteConsulta] : [],
      };
    }
  }

  const valorTotalEl = filhoTiss(guiaEl, 'valorTotal');
  let valorTotal = null;
  if (valorTotalEl) {
    const campos = ['valorProcedimentos', 'valorDiarias', 'valorTaxasAlugueis', 'valorMateriais', 'valorMedicamentos', 'valorOPME', 'valorGasesMedicinais'];
    let soma = 0;
    campos.forEach((c) => {
      soma += numDeTiss(textoDeTiss(valorTotalEl, c)) || 0;
    });
    const valorTotalGeral = numDeTiss(textoDeTiss(valorTotalEl, 'valorTotalGeral'));
    const somaItens = itens.reduce((s, it) => s + (it.valorTotal || 0), 0);
    valorTotal = {
      soma: Number(soma.toFixed(2)),
      valorTotalGeral,
      okComponentes: valorTotalGeral !== null ? Math.abs(soma - valorTotalGeral) <= 0.02 : null,
      somaItens: Number(somaItens.toFixed(2)),
      okItens: itens.length > 0 && valorTotalGeral !== null ? Math.abs(somaItens - valorTotalGeral) <= 0.02 : null,
    };
  } else {
    // guiaHonorarios não tem o wrapper <valorTotal> — só um campo flat
    // <valorTotalHonorarios> (confirmado no XSD oficial).
    const valorTotalHonorarios = numDeTiss(textoDeTiss(guiaEl, 'valorTotalHonorarios'));
    if (valorTotalHonorarios !== null) {
      const somaItens = itens.reduce((s, it) => s + (it.valorTotal || 0), 0);
      valorTotal = {
        soma: null,
        valorTotalGeral: valorTotalHonorarios,
        okComponentes: null,
        somaItens: Number(somaItens.toFixed(2)),
        okItens: itens.length > 0 ? Math.abs(somaItens - valorTotalHonorarios) <= 0.02 : null,
      };
    }
  }

  return { tipo, registroANS, numeroGuiaPrestador, itens, consultaItem, valorTotal, profissionais };
}

async function validarArquivoTiss(file) {
  const textoXml = await lerArquivoTiss(file);
  const hashCalculado = calcularHashTiss(textoXml);

  const doc = new DOMParser().parseFromString(textoXml, 'text/xml');
  const erroParse = doc.querySelector('parsererror');

  const resultado = {
    nomeArquivo: file.name,
    tamanhoBytes: file.size,
    erroParse: erroParse ? erroParse.textContent.trim() : null,
    hash: { calculado: hashCalculado, declarado: null, ok: null },
    versao: '',
    operadoraDestino: { registro: '', nome: null },
    prestadorOrigem: '',
    prestadorOrigemCnpj: '',
    numeroLote: '',
    tiposGuia: {},
    guias: [],
    unimed: null,
    xsd: null,
  };

  if (resultado.erroParse) return resultado;

  const raiz = doc.documentElement;
  const cabecalho = filhoTiss(raiz, 'cabecalho');
  const epilogo = filhoTiss(raiz, 'epilogo');

  resultado.hash.declarado = epilogo ? textoDeTiss(epilogo, 'hash').toLowerCase() : '';
  resultado.hash.ok = resultado.hash.declarado ? resultado.hash.declarado === hashCalculado : null;
  resultado.versao = textoDeTiss(cabecalho, 'Padrao');

  const origem = filhoTiss(cabecalho, 'origem');
  const identPrestador = filhoTiss(origem, 'identificacaoPrestador');
  if (identPrestador) {
    const cnpj = textoDeTiss(identPrestador, 'CNPJ');
    const codigoOperadora = textoDeTiss(identPrestador, 'codigoPrestadorNaOperadora');
    resultado.prestadorOrigem = cnpj ? `CNPJ ${cnpj}` : codigoOperadora ? `Código na operadora ${codigoOperadora}` : '';
    resultado.prestadorOrigemCnpj = cnpj.replace(/\D/g, '');
  }

  const destino = filhoTiss(cabecalho, 'destino');
  resultado.operadoraDestino.registro = textoDeTiss(destino, 'registroANS');
  const operadoras = await carregarOperadorasAns();
  if (resultado.operadoraDestino.registro && operadoras[resultado.operadoraDestino.registro]) {
    resultado.operadoraDestino.nome = operadoras[resultado.operadoraDestino.registro].razaoSocial;
  }

  const cboMedicos = await carregarCboMedicos();
  const loteGuias = buscarProfundoTiss(raiz, 'loteGuias');
  if (loteGuias) {
    resultado.numeroLote = textoDeTiss(loteGuias, 'numeroLote');
    const guiasTISS = filhoTiss(loteGuias, 'guiasTISS');
    if (guiasTISS) {
      Array.from(guiasTISS.children).forEach((guiaEl) => {
        const tipo = guiaEl.localName;
        resultado.tiposGuia[tipo] = (resultado.tiposGuia[tipo] || 0) + 1;
        const guia = analisarGuiaTiss(guiaEl, tipo);
        const enriquecerProfissional = (p) => {
          p.conselhoNome = TISS_CONSELHOS[p.conselho] || (p.conselho ? `Conselho ${p.conselho}` : '');
          p.cboDescricao = cboMedicos[p.cbo] || '';
          p.grauPartDescricao = TISS_GRAU_PARTICIPACAO[p.grauPart] || '';
        };
        // Enriquece tanto a lista agregada da guia (aba Profissionais) quanto
        // o(s) profissional(is) de cada item individual (coluna Profissional
        // na tabela de cada grupo) — são objetos separados.
        guia.profissionais.forEach(enriquecerProfissional);
        guia.itens.forEach((it) => it.profissionais.forEach(enriquecerProfissional));
        if (guia.consultaItem) guia.consultaItem.profissionais.forEach(enriquecerProfissional);
        // Guarda o elemento XML bruto e o contexto do arquivo (prestador/
        // operadora) na própria guia — usado pela impressão no layout
        // oficial ANS (extrai campos que o parser "enxuto" acima não
        // guarda, como senha, CNES, indicação clínica etc.).
        guia.elementoXml = guiaEl;
        guia.contextoArquivo = {
          prestadorOrigem: resultado.prestadorOrigem,
          prestadorOrigemCnpj: resultado.prestadorOrigemCnpj,
          operadoraNome: resultado.operadoraDestino.nome,
          registroOperadora: resultado.operadoraDestino.registro,
        };
        resultado.guias.push(guia);
      });
    }
  }

  const nomeOperadora = resultado.operadoraDestino.nome || '';
  if (/unimed/i.test(nomeOperadora)) {
    const digitoArquivo = (file.name.match(/^(\d)/) || [])[1] || null;
    const digitoLoteMatch = resultado.numeroLote.match(/^(\d)/);
    const digitoLote = digitoLoteMatch ? digitoLoteMatch[1] : null;
    // Só faz sentido comparar o dígito do nome do arquivo com o do lote
    // para os tipos "2" e "5": nesses casos o lote é o número-base do
    // lote "0" com o dígito do tipo prefixado na frente (ex: base 33628 →
    // lote "233628" no arquivo 2, "533628" no arquivo 5). O arquivo "0" é
    // o lote original — o número pode começar com qualquer dígito (é só o
    // sequencial do sistema que gerou o lote), então não há conferência
    // possível a partir de um único arquivo "0" (confirmado pelo usuário,
    // que viu um falso positivo com lote "33628" num arquivo tipo "0").
    const bateComLote = digitoArquivo && digitoArquivo !== '0' && digitoLote ? digitoArquivo === digitoLote : null;
    // Lote-base, para comparar entre os 3 arquivos de um mesmo envio: no
    // "0" é o lote inteiro; no "2"/"5" é o lote sem o dígito do tipo à
    // frente — só quando esse dígito realmente confere.
    let loteBase = null;
    if (resultado.numeroLote) {
      if (digitoArquivo === '0') loteBase = resultado.numeroLote;
      else if (digitoArquivo && digitoLote === digitoArquivo) loteBase = resultado.numeroLote.slice(1);
    }
    resultado.unimed = {
      digitoArquivo,
      digitoLote,
      rotuloArquivo: digitoArquivo ? UNIMED_ROTULOS_ARQUIVO[digitoArquivo] || null : null,
      bateComLote,
      loteBase,
    };
  }

  resultado.xsd = await validarEstruturaXsdTiss(textoXml, file.name);

  return resultado;
}

// Card compacto na grade (resumo + link para o detalhe): o detalhe item a
// item e os profissionais já ficam completos e melhor organizados (por
// grupo, em abas) no modal aberto ao clicar no card — repetir tudo aqui
// inline só duplicava a informação e poluía a tela.
function renderizarGuiaTiss(g, indice) {
  const itensProblema = g.itens.filter((it) => it.ok === false);
  const totalProblema = g.valorTotal && (g.valorTotal.okComponentes === false || g.valorTotal.okItens === false);
  const statusGeral = itensProblema.length === 0 && !totalProblema;
  const qtdItens = g.itens.length || (g.consultaItem ? 1 : 0);
  const qtdProfissionais = (g.profissionais || []).length;

  const totalHtml = g.valorTotal
    ? `<div class="total-row">
        <span class="label">Total da guia ${totalProblema ? '⚠' : '✔'}</span>
        <div style="text-align:right">
          <div class="value">${fmtMoeda(g.valorTotal.valorTotalGeral ?? 0)}</div>
          ${g.valorTotal.okComponentes === false ? `<div class="original">soma dos componentes do total: ${fmtMoeda(g.valorTotal.soma)}</div>` : ''}
          ${g.valorTotal.okItens === false ? `<div class="original">soma dos itens: ${fmtMoeda(g.valorTotal.somaItens)}</div>` : ''}
        </div>
      </div>`
    : '';

  const resumoPartes = [
    qtdItens > 0 ? `${qtdItens} item${qtdItens === 1 ? '' : 'ns'}` : '',
    qtdProfissionais > 0 ? `${qtdProfissionais} profissional${qtdProfissionais === 1 ? '' : 'is'}` : '',
  ].filter(Boolean);

  return `
    <div class="edicao-card">
      <div class="edicao-card-head clicavel" data-guia-indice="${indice}" role="button" tabindex="0" title="Clique para ver os lançamentos desta guia agrupados por tipo">
        <span class="nome">${escaparHtml(g.tipo)}${g.numeroGuiaPrestador ? ` — ${escaparHtml(g.numeroGuiaPrestador)}` : ''}</span>
        <span class="ano">${statusGeral ? '✔' : '⚠'}</span>
      </div>
      ${resumoPartes.length ? `<div class="edicao-card-desc">${resumoPartes.join(' · ')}</div>` : ''}
      ${totalHtml}
    </div>`;
}

// Busca opt-in de CNPJ (só roda quando o usuário clica no botão — não é
// automático). É a ÚNICA parte do validador que sai do navegador: envia o
// CNPJ do prestador (dado público de registro empresarial, não dado do
// paciente) à BrasilAPI (https://brasilapi.com.br), um agregador público e
// gratuito de dados abertos. Confirmado CORS aberto (access-control-allow-
// origin: *) antes de usar.
const cnpjBrasilApiCache = {};
async function buscarCnpjBrasilApi(cnpj) {
  if (cnpjBrasilApiCache[cnpj]) return cnpjBrasilApiCache[cnpj];
  const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!resp.ok) {
    if (resp.status === 404) throw new Error('CNPJ não encontrado');
    throw new Error(`HTTP ${resp.status}`);
  }
  const dados = await resp.json();
  cnpjBrasilApiCache[cnpj] = dados;
  return dados;
}

function itensDaGuia(guia) {
  const linhas = guia.itens.slice();
  if (guia.consultaItem) linhas.push(guia.consultaItem);
  return linhas;
}

function montarItensParaAgrupamento(resultado) {
  const linhas = [];
  resultado.guias.forEach((g) => linhas.push(...itensDaGuia(g)));
  return linhas;
}

function agruparItens(itens) {
  const porGrupo = new Map();
  itens.forEach((it) => {
    const grupo = it.grupo || GRUPO_PROCEDIMENTOS;
    if (!porGrupo.has(grupo)) porGrupo.set(grupo, []);
    porGrupo.get(grupo).push(it);
  });
  const ordenados = ORDEM_GRUPOS_DESPESA.filter((g) => porGrupo.has(g)).concat(
    Array.from(porGrupo.keys()).filter((g) => !ORDEM_GRUPOS_DESPESA.includes(g))
  );
  return { porGrupo, ordenados };
}

function agruparPorTipoDespesa(resultado) {
  return agruparItens(montarItensParaAgrupamento(resultado));
}

// Visão agrupada por Tipo de Despesa (ANS) — subtotais de todo o arquivo
// (procedimentos, consultas e outrasDespesas) pelos grupos oficiais
// (Material, Medicamento, Diárias etc., mais Procedimentos/Consultas para
// itens que não usam codigoDespesa). O detalhe item a item de cada grupo
// fica na tela de cada guia (clique no card da guia), não aqui.
function renderizarGruposDespesa(resultado) {
  const { porGrupo, ordenados } = agruparPorTipoDespesa(resultado);
  if (ordenados.length === 0) return '';

  let totalGeral = 0;
  const linhasHtml = ordenados
    .map((grupo) => {
      const itensGrupo = porGrupo.get(grupo);
      const subtotal = itensGrupo.reduce((s, it) => s + (it.valorTotal || 0), 0);
      totalGeral += subtotal;
      return `
        <div class="breakdown-row">
          <span class="label">${escaparHtml(grupo)} <span class="detail">${itensGrupo.length} lançamento(s)</span></span>
          <span class="value">${fmtMoeda(subtotal)}</span>
        </div>`;
    })
    .join('');

  return `
    <details class="grupo grupo-principal" style="margin-top:16px;">
      <summary class="grupo-summary">
        <span class="grupo-nome">Por tipo de despesa (ANS) — visão geral do arquivo</span>
        <span class="grupo-valor">${fmtMoeda(totalGeral)}</span>
      </summary>
      <div class="grupo-corpo">
        <div class="breakdown">${linhasHtml}</div>
        <p class="ajustes-nota" style="margin:10px 16px 0;">Para ver os lançamentos item a item por grupo, clique numa guia na lista abaixo.</p>
        <div style="margin:6px 16px 0;">
          <button type="button" id="btn-exportar-grupos-csv" class="acao-btn">⬇ Exportar CSV (todos os itens)</button>
        </div>
      </div>
    </details>`;
}

// Tela de detalhe de uma guia (aberta ao clicar no card da guia): quebra
// SÓ os itens daquela guia em abas por grupo de despesa, mais uma aba de
// profissionais e uma de resumo/total — em vez de misturar tudo do XML.
// Profissional(is) de um item, formatado para a coluna da tabela — mostra
// nome + função (grau de participação) de cada um, já que um procedimento
// pode ter mais de um profissional (ex: cirurgião + auxiliar).
function formatarProfissionaisItemHtml(profissionais) {
  if (!profissionais || profissionais.length === 0) return '—';
  return profissionais
    .map((p) => {
      const nome = escaparHtml(p.nome) || '—';
      const funcao = escaparHtml(p.grauPartDescricao);
      return funcao ? `${nome} <span class="detail">(${funcao})</span>` : nome;
    })
    .join('<br>');
}

function renderizarTabelaGrupoModal(itensGrupo) {
  const subtotal = itensGrupo.reduce((s, it) => s + (it.valorTotal || 0), 0);
  const linhasHtml = itensGrupo
    .map(
      (it) => `
      <tr>
        <td class="col-data">${it.dataExecucao ? escaparHtml(formatarDataBR(it.dataExecucao)) : '—'}</td>
        <td>${escaparHtml(it.codigoProcedimento) || '—'}</td>
        <td>${escaparHtml(it.descricaoProcedimento) || '—'}</td>
        <td>${formatarProfissionaisItemHtml(it.profissionais)}</td>
        <td style="text-align:right">${it.quantidade ?? 1}</td>
        <td style="text-align:right">${fmtMoeda(it.valorTotal ?? 0)}</td>
      </tr>`
    )
    .join('');
  return `
    <div style="overflow-x:auto;">
      <table class="guia-doc-tabela guia-doc-tabela-itens">
        <thead><tr><th>Data</th><th>Código</th><th>Descrição</th><th>Profissional</th><th style="text-align:right">Qtd.</th><th style="text-align:right">Valor</th></tr></thead>
        <tbody>${linhasHtml}</tbody>
        <tfoot><tr><td colspan="5" style="text-align:right; font-weight:700;">Subtotal</td><td style="text-align:right; font-weight:700;">${fmtMoeda(subtotal)}</td></tr></tfoot>
      </table>
    </div>`;
}

function renderizarProfissionaisGuiaModal(guia) {
  const linhas = (guia.profissionais || [])
    .map((p) => {
      const crm = p.numeroConselho
        ? `${escaparHtml(p.conselhoNome) || 'Conselho ' + (escaparHtml(p.conselho) || '?')} nº ${escaparHtml(p.numeroConselho)}${p.uf ? '/' + escaparHtml(p.uf) : ''}`
        : '';
      const cbo = p.cbo ? `CBO ${escaparHtml(p.cbo)}${p.cboDescricao ? ` (${escaparHtml(p.cboDescricao)})` : ''}` : '';
      const funcao = escaparHtml(p.grauPartDescricao) || escaparHtml(p.papel);
      const detalhes = [crm, cbo].filter(Boolean).join(' · ');
      return `
        <div class="breakdown-row">
          <span class="label">${escaparHtml(p.nome) || '—'} <span class="detail">${detalhes || '—'}</span></span>
          <span class="value zero">${funcao}</span>
        </div>`;
    })
    .join('');
  return `<div class="breakdown">${linhas || '<div class="breakdown-row"><span class="label">Nenhum profissional identificado nesta guia</span></div>'}</div>`;
}

function renderizarResumoGuiaModal(guia) {
  const itensProblema = guia.itens.filter((it) => it.ok === false);
  const totalProblema = guia.valorTotal && (guia.valorTotal.okComponentes === false || guia.valorTotal.okItens === false);
  const qtdItens = itensDaGuia(guia).length;

  const problemasHtml = itensProblema.length
    ? `<div class="breakdown">
        ${itensProblema
          .map(
            (it) => `
          <div class="breakdown-row">
            <span class="label">${escaparHtml(it.codigoProcedimento) || '—'} <span class="detail">esperado ${fmtMoeda(it.esperado)}</span></span>
            <span class="value zero">${fmtMoeda(it.valorTotal ?? 0)}</span>
          </div>`
          )
          .join('')}
      </div>`
    : '';

  const totalHtml = guia.valorTotal
    ? `<div class="breakdown"><div class="total-row">
        <span class="label">Total da guia ${totalProblema ? '⚠' : '✔'}</span>
        <div style="text-align:right">
          <div class="value">${fmtMoeda(guia.valorTotal.valorTotalGeral ?? 0)}</div>
          ${guia.valorTotal.okComponentes === false ? `<div class="original">soma dos componentes do total: ${fmtMoeda(guia.valorTotal.soma)}</div>` : ''}
          ${guia.valorTotal.okItens === false ? `<div class="original">soma dos itens: ${fmtMoeda(guia.valorTotal.somaItens)}</div>` : ''}
        </div>
      </div></div>`
    : '';

  return `
    <div class="breakdown">
      <div class="breakdown-row"><span class="label">Tipo de guia</span><span class="value zero">${escaparHtml(guia.tipo)}</span></div>
      ${guia.numeroGuiaPrestador ? `<div class="breakdown-row"><span class="label">Número da guia (prestador)</span><span class="value zero">${escaparHtml(guia.numeroGuiaPrestador)}</span></div>` : ''}
      <div class="breakdown-row"><span class="label">Itens lançados</span><span class="value zero">${qtdItens}</span></div>
      <div class="breakdown-row"><span class="label">Profissionais</span><span class="value zero">${(guia.profissionais || []).length}</span></div>
    </div>
    ${itensProblema.length ? `<p class="ajustes-nota" style="margin:10px 16px 0;">⚠ ${itensProblema.length} item(ns) com valor divergente do esperado:</p>${problemasHtml}` : ''}
    ${totalHtml}`;
}

// Identifica um "contratado" (choice codigoPrestadorNaOperadora | cpfContratado
// | cnpjContratado, ct_contratadoDados do XSD oficial) e devolve rótulo + valor
// prontos para exibição, já que o campo impresso na guia oficial é só um
// ("Código na Operadora") mas o XML pode trazer qualquer um dos 3.
function extrairContratadoTiss(el) {
  if (!el) return { rotulo: '', valor: '' };
  const codigo = textoDeTiss(el, 'codigoPrestadorNaOperadora');
  if (codigo) return { rotulo: 'Código na operadora', valor: codigo };
  const cnpj = textoDeTiss(el, 'cnpjContratado');
  if (cnpj) return { rotulo: 'CNPJ', valor: cnpj };
  const cpf = textoDeTiss(el, 'cpfContratado');
  if (cpf) return { rotulo: 'CPF', valor: cpf };
  return { rotulo: '', valor: '' };
}

// Ordena itens por data + hora inicial — o XML fonte não garante ordem
// cronológica (confirmado num arquivo real de quimioterapia: os itens vêm
// agrupados por medicamento, com as 3 datas do ciclo intercaladas — ex.
// Topotecana 27/04, 22/04, 13/04, depois Cloreto de Sódio 27/04, 22/04,
// 13/04, e assim por diante), o que deixa a tabela impressa ilegível sem
// essa ordenação.
function ordenarPorDataHora(itens, campoData, campoHora) {
  return itens.slice().sort((a, b) => {
    const chaveA = `${a[campoData] || ''} ${a[campoHora] || ''}`;
    const chaveB = `${b[campoData] || ''} ${b[campoHora] || ''}`;
    return chaveA.localeCompare(chaveB);
  });
}

// Anexo de Outras Despesas ("21.202 v008") — usado tanto na guia SP/SADT
// quanto na de Resumo de Internação (mesma estrutura XML, <outrasDespesas>
// <despesa>, ct_outrasDespesas no XSD oficial), por isso é extraído por uma
// função à parte e reaproveitado nas duas impressões.
function extrairOutrasDespesasTiss(guiaEl) {
  const outrasDespesas = filhoTiss(guiaEl, 'outrasDespesas');
  const despesas = filhosTiss(outrasDespesas, 'despesa').map((d) => {
    const servico = filhoTiss(d, 'servicosExecutados');
    return {
      codigoDespesa: textoDeTiss(d, 'codigoDespesa'),
      data: servico ? textoDeTiss(servico, 'dataExecucao') : '',
      horaInicial: servico ? textoDeTiss(servico, 'horaInicial') : '',
      horaFinal: servico ? textoDeTiss(servico, 'horaFinal') : '',
      codigoTabela: servico ? textoDeTiss(servico, 'codigoTabela') : '',
      codigoProcedimento: servico ? textoDeTiss(servico, 'codigoProcedimento') : '',
      descricaoProcedimento: servico ? textoDeTiss(servico, 'descricaoProcedimento') : '',
      quantidade: servico ? textoDeTiss(servico, 'quantidadeExecutada') : '',
      unidadeMedida: servico ? textoDeTiss(servico, 'unidadeMedida') : '',
      fator: servico ? textoDeTiss(servico, 'reducaoAcrescimo') : '',
      valorUnitario: servico ? numDeTiss(textoDeTiss(servico, 'valorUnitario')) : null,
      valorTotal: servico ? numDeTiss(textoDeTiss(servico, 'valorTotal')) : null,
      registroAnvisa: servico ? textoDeTiss(servico, 'registroANVISA') : '',
      refFabricante: servico ? textoDeTiss(servico, 'codigoRefFabricante') : '',
      autorizacaoFuncionamento: servico ? textoDeTiss(servico, 'autorizacaoFuncionamento') : '',
    };
  });
  return ordenarPorDataHora(despesas, 'data', 'horaInicial');
}

function renderizarTabelaOutrasDespesas(despesas) {
  if (!despesas || despesas.length === 0) return '';
  const linhasHtml = despesas
    .map(
      (d) => `
      <tr>
        <td>${escaparHtml(TISS_CODIGOS_DESPESA[d.codigoDespesa] || d.codigoDespesa || '—')}</td>
        <td>${escaparHtml(d.data ? formatarDataBR(d.data) : '—')}</td>
        <td>${escaparHtml(d.horaInicial || '—')} a ${escaparHtml(d.horaFinal || '—')}</td>
        <td>${escaparHtml(d.codigoTabela || '—')}</td>
        <td>${escaparHtml(d.codigoProcedimento || '—')}</td>
        <td>${escaparHtml(d.descricaoProcedimento || '—')}</td>
        <td class="go-num">${escaparHtml(d.quantidade || '—')}</td>
        <td>${escaparHtml(TISS_UNIDADE_MEDIDA[d.unidadeMedida] || d.unidadeMedida || '—')}</td>
        <td class="go-num">${escaparHtml(d.fator || '—')}</td>
        <td class="go-num">${d.valorUnitario !== null ? fmtMoeda(d.valorUnitario) : '—'}</td>
        <td class="go-num">${d.valorTotal !== null ? fmtMoeda(d.valorTotal) : '—'}</td>
        <td>${escaparHtml(d.registroAnvisa || '—')}</td>
      </tr>`
    )
    .join('');
  return `
    <div class="go-anexo-despesas">
      <div class="go-secao-titulo">Anexo — outras despesas (materiais, medicamentos, taxas, OPME, gases e diárias)</div>
      <table class="go-tabela">
        <thead>
          <tr>
            <th>Cód. despesa</th><th>Data</th><th>Horário</th><th>Tabela</th><th>Código</th><th>Descrição</th>
            <th>Qtde.</th><th>Unid.</th><th>Fator</th><th>Valor unit. (R$)</th><th>Valor total (R$)</th><th>Registro ANVISA</th>
          </tr>
        </thead>
        <tbody>${linhasHtml}</tbody>
      </table>
    </div>`;
}

// Extrai da guia SP/SADT (elemento XML bruto) todos os campos usados na
// impressão no layout oficial ANS (formulário em papel, numerado 1 a 68 —
// "Padrão TISS - Componente de Conteúdo e Estrutura"). É um extrator à
// parte de analisarGuiaTiss (que só pega o necessário pra conferência) pois
// o formulário oficial pede campos que a conferência não usa (senha, CNES,
// indicação clínica, dados de autorização etc.).
function extrairDadosImpressaoSPSADT(guiaEl) {
  const cabecalho = filhoTiss(guiaEl, 'cabecalhoGuia');
  const autorizacao = filhoTiss(guiaEl, 'dadosAutorizacao');
  const beneficiario = filhoTiss(guiaEl, 'dadosBeneficiario');
  const dadosSolicitante = filhoTiss(guiaEl, 'dadosSolicitante');
  const profissionalSolicitante = extrairProfissionalTiss(filhoTiss(dadosSolicitante, 'profissionalSolicitante'));
  const dadosSolicitacao = filhoTiss(guiaEl, 'dadosSolicitacao');
  const dadosExecutante = filhoTiss(guiaEl, 'dadosExecutante');
  const dadosAtendimento = filhoTiss(guiaEl, 'dadosAtendimento');
  const valorTotalEl = filhoTiss(guiaEl, 'valorTotal');

  const procedimentosBrutos = filhosTiss(filhoTiss(guiaEl, 'procedimentosExecutados'), 'procedimentoExecutado').map((pe) => {
    const proc = filhoTiss(pe, 'procedimento');
    const equipe = filhosTiss(pe, 'equipeSadt').map((eq) => ({
      grauPart: textoDeTiss(eq, 'grauPart'),
      nome: textoDeTiss(eq, 'nomeProf'),
      conselho: textoDeTiss(eq, 'conselho'),
      numeroConselho: textoDeTiss(eq, 'numeroConselhoProfissional'),
      uf: textoDeTiss(eq, 'UF'),
      cbo: textoDeTiss(eq, 'CBOS'),
    }));
    return {
      sequencial: textoDeTiss(pe, 'sequencialItem'),
      data: textoDeTiss(pe, 'dataExecucao'),
      horaInicial: textoDeTiss(pe, 'horaInicial'),
      horaFinal: textoDeTiss(pe, 'horaFinal'),
      codigoTabela: proc ? textoDeTiss(proc, 'codigoTabela') : '',
      codigoProcedimento: proc ? textoDeTiss(proc, 'codigoProcedimento') : '',
      descricaoProcedimento: proc ? textoDeTiss(proc, 'descricaoProcedimento') : '',
      quantidade: textoDeTiss(pe, 'quantidadeExecutada'),
      viaAcesso: textoDeTiss(pe, 'viaAcesso'),
      tecnica: textoDeTiss(pe, 'tecnicaUtilizada'),
      fator: textoDeTiss(pe, 'reducaoAcrescimo'),
      valorUnitario: numDeTiss(textoDeTiss(pe, 'valorUnitario')),
      valorTotal: numDeTiss(textoDeTiss(pe, 'valorTotal')),
      equipe,
    };
  });
  const procedimentos = ordenarPorDataHora(procedimentosBrutos, 'data', 'horaInicial');

  const equipeConsolidada = [];
  procedimentos.forEach((p) =>
    p.equipe.forEach((eq) => {
      if (!equipeConsolidada.some((e) => e.numeroConselho === eq.numeroConselho && e.grauPart === eq.grauPart)) {
        equipeConsolidada.push(eq);
      }
    })
  );

  return {
    registroANS: textoDeTiss(cabecalho, 'registroANS'),
    numeroGuiaPrestador: textoDeTiss(cabecalho, 'numeroGuiaPrestador'),
    guiaPrincipal: textoDeTiss(cabecalho, 'guiaPrincipal'),
    numeroGuiaOperadora: textoDeTiss(autorizacao, 'numeroGuiaOperadora'),
    dataAutorizacao: textoDeTiss(autorizacao, 'dataAutorizacao'),
    senha: textoDeTiss(autorizacao, 'senha'),
    dataValidadeSenha: textoDeTiss(autorizacao, 'dataValidadeSenha'),
    numeroCarteira: textoDeTiss(beneficiario, 'numeroCarteira'),
    atendimentoRN: textoDeTiss(beneficiario, 'atendimentoRN'),
    solicitante: extrairContratadoTiss(filhoTiss(dadosSolicitante, 'contratadoSolicitante')),
    nomeContratadoSolicitante: textoDeTiss(dadosSolicitante, 'nomeContratadoSolicitante'),
    profissionalSolicitante,
    caraterAtendimento: textoDeTiss(dadosSolicitacao, 'caraterAtendimento'),
    dataSolicitacao: textoDeTiss(dadosSolicitacao, 'dataSolicitacao'),
    indicacaoClinica: textoDeTiss(dadosSolicitacao, 'indicacaoClinica'),
    executante: extrairContratadoTiss(filhoTiss(dadosExecutante, 'contratadoExecutante')),
    cnes: textoDeTiss(dadosExecutante, 'CNES'),
    tipoAtendimento: textoDeTiss(dadosAtendimento, 'tipoAtendimento'),
    indicacaoAcidente: textoDeTiss(dadosAtendimento, 'indicacaoAcidente'),
    tipoConsulta: textoDeTiss(dadosAtendimento, 'tipoConsulta'),
    regimeAtendimento: textoDeTiss(dadosAtendimento, 'regimeAtendimento'),
    motivoEncerramento: textoDeTiss(dadosAtendimento, 'motivoEncerramento'),
    procedimentos,
    equipeConsolidada,
    outrasDespesas: extrairOutrasDespesasTiss(guiaEl),
    observacao: textoDeTiss(guiaEl, 'observacao'),
    valores: {
      procedimentos: numDeTiss(textoDeTiss(valorTotalEl, 'valorProcedimentos')),
      taxasAlugueis: numDeTiss(textoDeTiss(valorTotalEl, 'valorTaxasAlugueis')),
      materiais: numDeTiss(textoDeTiss(valorTotalEl, 'valorMateriais')),
      medicamentos: numDeTiss(textoDeTiss(valorTotalEl, 'valorMedicamentos')),
      opme: numDeTiss(textoDeTiss(valorTotalEl, 'valorOPME')),
      gasesMedicinais: numDeTiss(textoDeTiss(valorTotalEl, 'valorGasesMedicinais')),
      total: numDeTiss(textoDeTiss(valorTotalEl, 'valorTotalGeral')),
    },
  };
}

function campoOficial(rotulo, valor) {
  return `<div class="go-campo"><span class="go-rotulo">${escaparHtml(rotulo)}</span><span class="go-valor">${valor === '' || valor === null || valor === undefined ? '—' : escaparHtml(String(valor))}</span></div>`;
}

function montarHtmlImpressaoSPSADT(dados, contexto) {
  const profSolic = dados.profissionalSolicitante;
  const procedimentosHtml = dados.procedimentos
    .map(
      (p) => `
      <tr>
        <td>${escaparHtml(p.data ? formatarDataBR(p.data) : '—')}</td>
        <td>${escaparHtml(p.horaInicial || '—')} a ${escaparHtml(p.horaFinal || '—')}</td>
        <td>${escaparHtml(p.codigoTabela || '—')}</td>
        <td>${escaparHtml(p.codigoProcedimento || '—')}</td>
        <td>${escaparHtml(p.descricaoProcedimento || '—')}</td>
        <td class="go-num">${escaparHtml(p.quantidade || '—')}</td>
        <td>${escaparHtml(TISS_VIA_ACESSO[p.viaAcesso] || p.viaAcesso || '—')}</td>
        <td>${escaparHtml(TISS_TECNICA_UTILIZADA[p.tecnica] || p.tecnica || '—')}</td>
        <td class="go-num">${escaparHtml(p.fator || '—')}</td>
        <td class="go-num">${p.valorUnitario !== null ? fmtMoeda(p.valorUnitario) : '—'}</td>
        <td class="go-num">${p.valorTotal !== null ? fmtMoeda(p.valorTotal) : '—'}</td>
      </tr>`
    )
    .join('');

  const equipeHtml = dados.equipeConsolidada
    .map(
      (eq) => `
      <tr>
        <td>${escaparHtml(TISS_GRAU_PARTICIPACAO[eq.grauPart] || eq.grauPart || '—')}</td>
        <td>${escaparHtml(eq.nome || '—')}</td>
        <td>${escaparHtml(TISS_CONSELHOS[eq.conselho] || eq.conselho || '—')}</td>
        <td>${escaparHtml(eq.numeroConselho || '—')}</td>
        <td>${escaparHtml(TISS_UF_SIGLA[eq.uf] || eq.uf || '—')}</td>
        <td>${escaparHtml(eq.cbo || '—')}</td>
      </tr>`
    )
    .join('');

  return `
    <div class="guia-oficial">
      <div class="go-cabecalho">
        <div class="go-cabecalho-prestador">
          <div class="go-prestador">${escaparHtml(contexto.razaoSocialExecutante || contexto.prestadorOrigem || 'Prestador não identificado')}</div>
          <div class="go-operadora">${escaparHtml(contexto.operadoraNome || (contexto.registroOperadora ? `Operadora — registro ANS ${contexto.registroOperadora}` : 'Operadora não identificada'))}</div>
        </div>
        <div class="go-titulo">
          GUIA DE SERVIÇO PROFISSIONAL / SERVIÇO<br>AUXILIAR DE DIAGNÓSTICO E TERAPIA — SP/SADT
        </div>
        <div class="go-campo go-campo-guia-prestador">
          <span class="go-rotulo">2 - Nº guia no prestador</span>
          <span class="go-valor">${escaparHtml(dados.numeroGuiaPrestador || '—')}</span>
        </div>
      </div>
      <p class="go-aviso">Reprodução do layout oficial do Padrão TISS/ANS a partir dos dados do XML já validado neste portal — não substitui a guia original nem é enviada a nenhuma operadora. Alguns campos do formulário em papel (nome, validade da carteira e CNS do beneficiário) não existem mais no XML desde a versão 4.00.00 do Padrão (removidos por adequação à LGPD). O nome do contratado (campo 30) é buscado pelo CNPJ na BrasilAPI ao clicar em imprimir (mesma fonte pública do botão "Buscar CNPJ") — se a consulta falhar, mostra o CNPJ.</p>

      <div class="go-grid go-grid-2">
        ${campoOficial('1 - Registro ANS', dados.registroANS)}
        ${campoOficial('3 - Nº guia principal', dados.guiaPrincipal)}
      </div>
      <div class="go-grid go-grid-4">
        ${campoOficial('4 - Data da autorização', dados.dataAutorizacao ? formatarDataBR(dados.dataAutorizacao) : '')}
        ${campoOficial('5 - Senha', dados.senha)}
        ${campoOficial('6 - Data de validade da senha', dados.dataValidadeSenha ? formatarDataBR(dados.dataValidadeSenha) : '')}
        ${campoOficial('7 - Nº guia atribuído pela operadora', dados.numeroGuiaOperadora)}
      </div>

      <div class="go-secao-titulo">Dados do beneficiário</div>
      <div class="go-grid go-grid-5">
        ${campoOficial('8 - Nº da carteira', dados.numeroCarteira)}
        <div class="go-campo"><span class="go-rotulo">9 - Validade da carteira</span><span class="go-valor go-valor-obs">retirado do XML (LGPD)</span></div>
        <div class="go-campo"><span class="go-rotulo">10 - Nome</span><span class="go-valor go-valor-obs">retirado do XML (LGPD)</span></div>
        <div class="go-campo"><span class="go-rotulo">11 - Cartão Nacional de Saúde</span><span class="go-valor go-valor-obs">retirado do XML (LGPD)</span></div>
        ${campoOficial('12 - Atendimento a RN', dados.atendimentoRN === 'S' ? 'Sim' : dados.atendimentoRN === 'N' ? 'Não' : dados.atendimentoRN)}
      </div>

      <div class="go-secao-titulo">Dados do solicitante</div>
      <div class="go-grid go-grid-2">
        ${campoOficial(`13 - ${dados.solicitante.rotulo || 'Código na operadora'}`, dados.solicitante.valor)}
        ${campoOficial('14 - Nome do contratado', dados.nomeContratadoSolicitante)}
      </div>
      <div class="go-grid go-grid-5">
        ${campoOficial('15 - Nome do profissional solicitante', profSolic ? profSolic.nome : '')}
        ${campoOficial('16 - Conselho profissional', profSolic ? (TISS_CONSELHOS[profSolic.conselho] || profSolic.conselho) : '')}
        ${campoOficial('17 - Nº no conselho', profSolic ? profSolic.numeroConselho : '')}
        ${campoOficial('18 - UF', profSolic ? (TISS_UF_SIGLA[profSolic.uf] || profSolic.uf) : '')}
        ${campoOficial('19 - Código CBO', profSolic ? profSolic.cbo : '')}
      </div>

      <div class="go-secao-titulo">Dados da solicitação / procedimentos ou itens assistenciais solicitados</div>
      <div class="go-grid go-grid-3">
        ${campoOficial('21 - Caráter do atendimento', TISS_CARATER_ATENDIMENTO[dados.caraterAtendimento] || dados.caraterAtendimento)}
        ${campoOficial('22 - Data da solicitação', dados.dataSolicitacao ? formatarDataBR(dados.dataSolicitacao) : '')}
        <div class="go-campo go-campo-larga"><span class="go-rotulo">23 - Indicação clínica</span><span class="go-valor">${escaparHtml(dados.indicacaoClinica || '—')}</span></div>
      </div>

      <div class="go-secao-titulo">Dados do contratado executante</div>
      <div class="go-grid go-grid-3">
        ${campoOficial(`29 - ${dados.executante.rotulo || 'Código na operadora'}`, dados.executante.valor)}
        ${campoOficial('30 - Nome do contratado', contexto.razaoSocialExecutante || contexto.prestadorOrigem)}
        ${campoOficial('31 - Código CNES', dados.cnes)}
      </div>

      <div class="go-secao-titulo">Dados do atendimento</div>
      <div class="go-grid go-grid-5">
        ${campoOficial('32 - Tipo de atendimento', TISS_TIPO_ATENDIMENTO[dados.tipoAtendimento] || dados.tipoAtendimento)}
        ${campoOficial('33 - Indicação de acidente', TISS_INDICADOR_ACIDENTE[dados.indicacaoAcidente] || dados.indicacaoAcidente)}
        ${campoOficial('34 - Tipo de consulta', TISS_TIPO_CONSULTA[dados.tipoConsulta] || dados.tipoConsulta)}
        ${campoOficial('35 - Motivo de encerramento do atendimento', TISS_MOTIVO_ENCERRAMENTO[dados.motivoEncerramento] || dados.motivoEncerramento)}
        ${campoOficial('Regime de atendimento', TISS_REGIME_ATENDIMENTO[dados.regimeAtendimento] || dados.regimeAtendimento)}
      </div>

      <div class="go-secao-titulo">Dados da execução / procedimentos e exames realizados (36 a 47)</div>
      <table class="go-tabela">
        <thead>
          <tr>
            <th>Data</th><th>Horário</th><th>Tabela</th><th>Código</th><th>Descrição</th>
            <th>Qtde.</th><th>Via</th><th>Téc.</th><th>Fator</th><th>Valor unit. (R$)</th><th>Valor total (R$)</th>
          </tr>
        </thead>
        <tbody>${procedimentosHtml || '<tr><td colspan="11" class="go-vazio">Nenhum procedimento executado informado</td></tr>'}</tbody>
      </table>

      <div class="go-secao-titulo">Identificação do(s) profissional(is) executante(s) (48 a 55)</div>
      <table class="go-tabela">
        <thead><tr><th>Grau de participação</th><th>Nome</th><th>Conselho</th><th>Nº conselho</th><th>UF</th><th>CBO</th></tr></thead>
        <tbody>${equipeHtml || '<tr><td colspan="6" class="go-vazio">Nenhum profissional executante informado</td></tr>'}</tbody>
      </table>

      ${renderizarTabelaOutrasDespesas(dados.outrasDespesas)}

      ${dados.observacao ? `<div class="go-secao-titulo">58 - Observação / Justificativa</div><p class="go-observacao">${escaparHtml(dados.observacao)}</p>` : ''}

      <div class="go-secao-titulo">Totais</div>
      <div class="go-totais">
        <div class="go-campo"><span class="go-rotulo">59 - Procedimentos (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.procedimentos || 0)}</span></div>
        <div class="go-campo"><span class="go-rotulo">60 - Taxas e aluguéis (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.taxasAlugueis || 0)}</span></div>
        <div class="go-campo"><span class="go-rotulo">61 - Materiais (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.materiais || 0)}</span></div>
        <div class="go-campo"><span class="go-rotulo">62 - OPME (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.opme || 0)}</span></div>
        <div class="go-campo"><span class="go-rotulo">63 - Medicamentos (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.medicamentos || 0)}</span></div>
        <div class="go-campo"><span class="go-rotulo">64 - Gases medicinais (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.gasesMedicinais || 0)}</span></div>
        <div class="go-campo go-campo-total"><span class="go-rotulo">65 - Total geral (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.total || 0)}</span></div>
      </div>

      <div class="go-assinaturas">
        <div class="go-assinatura">Assinatura do responsável pela autorização</div>
        <div class="go-assinatura">Assinatura do beneficiário ou responsável</div>
        <div class="go-assinatura">Assinatura do contratado</div>
      </div>
    </div>`;
}

// Extrai da guia Resumo de Internação (elemento XML bruto) os campos usados
// na impressão no layout oficial ANS (formulário "21.203 v008" — Padrão
// TISS Componente de Conteúdo e Estrutura). Estrutura confirmada no XSD
// oficial (ctm_internacaoResumoGuia, tissGuiasV4_03_00.xsd) e no modelo em
// PDF fornecido.
function extrairDadosImpressaoResumoInternacao(guiaEl) {
  const cabecalho = filhoTiss(guiaEl, 'cabecalhoGuia');
  const autorizacao = filhoTiss(guiaEl, 'dadosAutorizacao');
  const beneficiario = filhoTiss(guiaEl, 'dadosBeneficiario');
  const dadosExecutante = filhoTiss(guiaEl, 'dadosExecutante');
  const dadosInternacao = filhoTiss(guiaEl, 'dadosInternacao');
  const dadosSaida = filhoTiss(guiaEl, 'dadosSaidaInternacao');
  const valorTotalEl = filhoTiss(guiaEl, 'valorTotal');

  const diagnosticos = filhosTiss(dadosSaida, 'diagnostico').map((d) => d.textContent.trim());
  const declaracao = filhoTiss(dadosInternacao, 'declaracoes');

  const procedimentosBrutos = filhosTiss(filhoTiss(guiaEl, 'procedimentosExecutados'), 'procedimentoExecutado').map((pe) => {
    const proc = filhoTiss(pe, 'procedimento');
    const equipe = filhosTiss(pe, 'identEquipe')
      .map((ie) => extrairProfissionalTiss(filhoTiss(ie, 'identificacaoEquipe')))
      .filter(Boolean);
    return {
      data: textoDeTiss(pe, 'dataExecucao'),
      horaInicial: textoDeTiss(pe, 'horaInicial'),
      horaFinal: textoDeTiss(pe, 'horaFinal'),
      codigoTabela: proc ? textoDeTiss(proc, 'codigoTabela') : '',
      codigoProcedimento: proc ? textoDeTiss(proc, 'codigoProcedimento') : '',
      descricaoProcedimento: proc ? textoDeTiss(proc, 'descricaoProcedimento') : '',
      quantidade: textoDeTiss(pe, 'quantidadeExecutada'),
      viaAcesso: textoDeTiss(pe, 'viaAcesso'),
      tecnica: textoDeTiss(pe, 'tecnicaUtilizada'),
      fator: textoDeTiss(pe, 'reducaoAcrescimo'),
      valorUnitario: numDeTiss(textoDeTiss(pe, 'valorUnitario')),
      valorTotal: numDeTiss(textoDeTiss(pe, 'valorTotal')),
      equipe,
    };
  });
  const procedimentos = ordenarPorDataHora(procedimentosBrutos, 'data', 'horaInicial');

  const equipeConsolidada = [];
  procedimentos.forEach((p) =>
    p.equipe.forEach((eq) => {
      if (!equipeConsolidada.some((e) => e.numeroConselho === eq.numeroConselho && e.grauPart === eq.grauPart)) {
        equipeConsolidada.push(eq);
      }
    })
  );

  return {
    registroANS: textoDeTiss(cabecalho, 'registroANS'),
    numeroGuiaPrestador: textoDeTiss(cabecalho, 'numeroGuiaPrestador'),
    numeroGuiaSolicitacaoInternacao: textoDeTiss(guiaEl, 'numeroGuiaSolicitacaoInternacao'),
    numeroGuiaOperadora: textoDeTiss(autorizacao, 'numeroGuiaOperadora'),
    dataAutorizacao: textoDeTiss(autorizacao, 'dataAutorizacao'),
    senha: textoDeTiss(autorizacao, 'senha'),
    dataValidadeSenha: textoDeTiss(autorizacao, 'dataValidadeSenha'),
    numeroCarteira: textoDeTiss(beneficiario, 'numeroCarteira'),
    atendimentoRN: textoDeTiss(beneficiario, 'atendimentoRN'),
    executante: extrairContratadoTiss(filhoTiss(dadosExecutante, 'contratadoExecutante')),
    cnes: textoDeTiss(dadosExecutante, 'CNES'),
    caraterAtendimento: textoDeTiss(dadosInternacao, 'caraterAtendimento'),
    tipoFaturamento: textoDeTiss(dadosInternacao, 'tipoFaturamento'),
    dataInicioFaturamento: textoDeTiss(dadosInternacao, 'dataInicioFaturamento'),
    horaInicioFaturamento: textoDeTiss(dadosInternacao, 'horaInicioFaturamento'),
    dataFinalFaturamento: textoDeTiss(dadosInternacao, 'dataFinalFaturamento'),
    horaFinalFaturamento: textoDeTiss(dadosInternacao, 'horaFinalFaturamento'),
    tipoInternacao: textoDeTiss(dadosInternacao, 'tipoInternacao'),
    regimeInternacao: textoDeTiss(dadosInternacao, 'regimeInternacao'),
    declaracaoNascido: textoDeTiss(declaracao, 'declaracaoNascido'),
    diagnosticoObito: textoDeTiss(declaracao, 'diagnosticoObito'),
    declaracaoObito: textoDeTiss(declaracao, 'declaracaoObito'),
    indicadorDORN: textoDeTiss(declaracao, 'indicadorDORN'),
    cidPrincipal: diagnosticos[0] || '',
    cid2: diagnosticos[1] || '',
    cid3: diagnosticos[2] || '',
    cid4: diagnosticos[3] || '',
    indicacaoAcidente: textoDeTiss(dadosSaida, 'indicadorAcidente'),
    motivoEncerramento: textoDeTiss(dadosSaida, 'motivoEncerramento'),
    procedimentos,
    equipeConsolidada,
    outrasDespesas: extrairOutrasDespesasTiss(guiaEl),
    observacao: textoDeTiss(guiaEl, 'observacao'),
    valores: {
      procedimentos: numDeTiss(textoDeTiss(valorTotalEl, 'valorProcedimentos')),
      diarias: numDeTiss(textoDeTiss(valorTotalEl, 'valorDiarias')),
      taxasAlugueis: numDeTiss(textoDeTiss(valorTotalEl, 'valorTaxasAlugueis')),
      materiais: numDeTiss(textoDeTiss(valorTotalEl, 'valorMateriais')),
      medicamentos: numDeTiss(textoDeTiss(valorTotalEl, 'valorMedicamentos')),
      opme: numDeTiss(textoDeTiss(valorTotalEl, 'valorOPME')),
      gasesMedicinais: numDeTiss(textoDeTiss(valorTotalEl, 'valorGasesMedicinais')),
      total: numDeTiss(textoDeTiss(valorTotalEl, 'valorTotalGeral')),
    },
  };
}

function montarHtmlImpressaoResumoInternacao(dados, contexto) {
  const procedimentosHtml = dados.procedimentos
    .map(
      (p) => `
      <tr>
        <td>${escaparHtml(p.data ? formatarDataBR(p.data) : '—')}</td>
        <td>${escaparHtml(p.horaInicial || '—')} a ${escaparHtml(p.horaFinal || '—')}</td>
        <td>${escaparHtml(p.codigoTabela || '—')}</td>
        <td>${escaparHtml(p.codigoProcedimento || '—')}</td>
        <td>${escaparHtml(p.descricaoProcedimento || '—')}</td>
        <td class="go-num">${escaparHtml(p.quantidade || '—')}</td>
        <td>${escaparHtml(TISS_VIA_ACESSO[p.viaAcesso] || p.viaAcesso || '—')}</td>
        <td>${escaparHtml(TISS_TECNICA_UTILIZADA[p.tecnica] || p.tecnica || '—')}</td>
        <td class="go-num">${escaparHtml(p.fator || '—')}</td>
        <td class="go-num">${p.valorUnitario !== null ? fmtMoeda(p.valorUnitario) : '—'}</td>
        <td class="go-num">${p.valorTotal !== null ? fmtMoeda(p.valorTotal) : '—'}</td>
      </tr>`
    )
    .join('');

  const equipeHtml = dados.equipeConsolidada
    .map(
      (eq) => `
      <tr>
        <td>${escaparHtml(TISS_GRAU_PARTICIPACAO[eq.grauPart] || eq.grauPart || '—')}</td>
        <td>${escaparHtml(eq.nome || '—')}</td>
        <td>${escaparHtml(TISS_CONSELHOS[eq.conselho] || eq.conselho || '—')}</td>
        <td>${escaparHtml(eq.numeroConselho || '—')}</td>
        <td>${escaparHtml(TISS_UF_SIGLA[eq.uf] || eq.uf || '—')}</td>
        <td>${escaparHtml(eq.cbo || '—')}</td>
      </tr>`
    )
    .join('');

  return `
    <div class="guia-oficial">
      <div class="go-cabecalho">
        <div class="go-cabecalho-prestador">
          <div class="go-prestador">${escaparHtml(contexto.razaoSocialExecutante || contexto.prestadorOrigem || 'Prestador não identificado')}</div>
          <div class="go-operadora">${escaparHtml(contexto.operadoraNome || (contexto.registroOperadora ? `Operadora — registro ANS ${contexto.registroOperadora}` : 'Operadora não identificada'))}</div>
        </div>
        <div class="go-titulo">GUIA DE RESUMO DE INTERNAÇÃO</div>
        <div class="go-campo go-campo-guia-prestador">
          <span class="go-rotulo">2 - Nº guia no prestador</span>
          <span class="go-valor">${escaparHtml(dados.numeroGuiaPrestador || '—')}</span>
        </div>
      </div>
      <p class="go-aviso">Reprodução do layout oficial do Padrão TISS/ANS a partir dos dados do XML já validado neste portal — não substitui a guia original nem é enviada a nenhuma operadora. Nome, validade da carteira e CNS do beneficiário não existem mais no XML desde a v4.00.00 (LGPD). Nome do contratado (campo 14) buscado pelo CNPJ na BrasilAPI ao clicar em imprimir.</p>

      <div class="go-grid go-grid-2">
        ${campoOficial('1 - Registro ANS', dados.registroANS)}
        ${campoOficial('3 - Nº guia de solicitação de internação', dados.numeroGuiaSolicitacaoInternacao)}
      </div>
      <div class="go-grid go-grid-4">
        ${campoOficial('4 - Data da autorização', dados.dataAutorizacao ? formatarDataBR(dados.dataAutorizacao) : '')}
        ${campoOficial('5 - Senha', dados.senha)}
        ${campoOficial('6 - Data de validade da senha', dados.dataValidadeSenha ? formatarDataBR(dados.dataValidadeSenha) : '')}
        ${campoOficial('7 - Nº guia atribuído pela operadora', dados.numeroGuiaOperadora)}
      </div>

      <div class="go-secao-titulo">Dados do beneficiário</div>
      <div class="go-grid go-grid-5">
        ${campoOficial('8 - Nº da carteira', dados.numeroCarteira)}
        <div class="go-campo"><span class="go-rotulo">9 - Validade da carteira</span><span class="go-valor go-valor-obs">retirado do XML (LGPD)</span></div>
        <div class="go-campo"><span class="go-rotulo">10 - Nome</span><span class="go-valor go-valor-obs">retirado do XML (LGPD)</span></div>
        <div class="go-campo"><span class="go-rotulo">11 - Cartão Nacional de Saúde</span><span class="go-valor go-valor-obs">retirado do XML (LGPD)</span></div>
        ${campoOficial('12 - Atendimento a RN', dados.atendimentoRN === 'S' ? 'Sim' : dados.atendimentoRN === 'N' ? 'Não' : dados.atendimentoRN)}
      </div>

      <div class="go-secao-titulo">Dados do contratado executante</div>
      <div class="go-grid go-grid-3">
        ${campoOficial(`13 - ${dados.executante.rotulo || 'Código na operadora'}`, dados.executante.valor)}
        ${campoOficial('14 - Nome do contratado', contexto.razaoSocialExecutante || contexto.prestadorOrigem)}
        ${campoOficial('15 - Código CNES', dados.cnes)}
      </div>

      <div class="go-secao-titulo">Dados da internação</div>
      <div class="go-grid go-grid-4">
        ${campoOficial('16 - Caráter do atendimento', TISS_CARATER_ATENDIMENTO[dados.caraterAtendimento] || dados.caraterAtendimento)}
        ${campoOficial('17 - Tipo de faturamento', TISS_TIPO_FATURAMENTO[dados.tipoFaturamento] || dados.tipoFaturamento)}
        ${campoOficial('18/19 - Início do faturamento', dados.dataInicioFaturamento ? `${formatarDataBR(dados.dataInicioFaturamento)} ${dados.horaInicioFaturamento || ''}` : '')}
        ${campoOficial('20/21 - Fim do faturamento', dados.dataFinalFaturamento ? `${formatarDataBR(dados.dataFinalFaturamento)} ${dados.horaFinalFaturamento || ''}` : '')}
        ${campoOficial('22 - Tipo de internação', TISS_TIPO_INTERNACAO[dados.tipoInternacao] || dados.tipoInternacao)}
        ${campoOficial('23 - Regime de internação', TISS_REGIME_INTERNACAO[dados.regimeInternacao] || dados.regimeInternacao)}
      </div>

      <div class="go-secao-titulo">Diagnósticos e encerramento</div>
      <div class="go-grid go-grid-5">
        ${campoOficial('24 - CID 10 principal', dados.cidPrincipal)}
        ${campoOficial('25 - CID 10 (2)', dados.cid2)}
        ${campoOficial('26 - CID 10 (3)', dados.cid3)}
        ${campoOficial('27 - CID 10 (4)', dados.cid4)}
        ${campoOficial('28 - Indicação de acidente', TISS_INDICADOR_ACIDENTE[dados.indicacaoAcidente] || dados.indicacaoAcidente)}
        ${campoOficial('29 - Motivo de encerramento da internação', TISS_MOTIVO_ENCERRAMENTO[dados.motivoEncerramento] || dados.motivoEncerramento)}
        ${campoOficial('30 - Nº declaração de nascido vivo', dados.declaracaoNascido)}
        ${campoOficial('31 - CID 10 óbito', dados.diagnosticoObito)}
        ${campoOficial('32 - Nº declaração de óbito', dados.declaracaoObito)}
        ${campoOficial('33 - Indicador D.O. de RN', dados.indicadorDORN === 'S' ? 'Sim' : dados.indicadorDORN === 'N' ? 'Não' : dados.indicadorDORN)}
      </div>

      <div class="go-secao-titulo">Procedimentos e exames realizados (34 a 47)</div>
      <table class="go-tabela">
        <thead>
          <tr>
            <th>Data</th><th>Horário</th><th>Tabela</th><th>Código</th><th>Descrição</th>
            <th>Qtde.</th><th>Via</th><th>Téc.</th><th>Fator</th><th>Valor unit. (R$)</th><th>Valor total (R$)</th>
          </tr>
        </thead>
        <tbody>${procedimentosHtml || '<tr><td colspan="11" class="go-vazio">Nenhum procedimento executado informado</td></tr>'}</tbody>
      </table>

      <div class="go-secao-titulo">Identificação da equipe (46 a 53)</div>
      <table class="go-tabela">
        <thead><tr><th>Grau de participação</th><th>Nome</th><th>Conselho</th><th>Nº conselho</th><th>UF</th><th>CBO</th></tr></thead>
        <tbody>${equipeHtml || '<tr><td colspan="6" class="go-vazio">Nenhum profissional executante informado</td></tr>'}</tbody>
      </table>

      ${renderizarTabelaOutrasDespesas(dados.outrasDespesas)}

      ${dados.observacao ? `<div class="go-secao-titulo">65 - Observações / Justificativa</div><p class="go-observacao">${escaparHtml(dados.observacao)}</p>` : ''}

      <div class="go-secao-titulo">Totais</div>
      <div class="go-totais">
        <div class="go-campo"><span class="go-rotulo">54 - Procedimentos (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.procedimentos || 0)}</span></div>
        <div class="go-campo"><span class="go-rotulo">55 - Diárias (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.diarias || 0)}</span></div>
        <div class="go-campo"><span class="go-rotulo">56 - Taxas e aluguéis (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.taxasAlugueis || 0)}</span></div>
        <div class="go-campo"><span class="go-rotulo">57 - Materiais (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.materiais || 0)}</span></div>
        <div class="go-campo"><span class="go-rotulo">58 - OPME (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.opme || 0)}</span></div>
        <div class="go-campo"><span class="go-rotulo">59 - Medicamentos (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.medicamentos || 0)}</span></div>
        <div class="go-campo"><span class="go-rotulo">60 - Gases medicinais (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.gasesMedicinais || 0)}</span></div>
        <div class="go-campo go-campo-total"><span class="go-rotulo">61 - Total geral (R$)</span><span class="go-valor">${fmtMoeda(dados.valores.total || 0)}</span></div>
      </div>

      <div class="go-assinaturas">
        <div class="go-assinatura">62 — Data / 63 - Assinatura do contratado</div>
        <div class="go-assinatura">64 - Assinatura do(s) auditor(es) da operadora</div>
      </div>
    </div>`;
}

// Extrai da guia Consulta (elemento XML bruto) os campos usados na
// impressão no layout oficial ANS (formulário "21.200 v008" — Padrão TISS
// Componente de Conteúdo e Estrutura). Estrutura confirmada no XSD oficial
// (ctm_consultaGuia, tissGuiasV4_03_00.xsd) e no modelo em PDF fornecido —
// é a guia mais simples do padrão: um único procedimento embutido em
// dadosAtendimento, sem tabela de itens nem equipe (só um profissional
// executante direto na guia, sem CPF/código próprio — diferente de
// equipeSadt/identEquipe usados nas outras guias).
function extrairDadosImpressaoConsulta(guiaEl) {
  const cabecalho = filhoTiss(guiaEl, 'cabecalhoConsulta');
  const beneficiario = filhoTiss(guiaEl, 'dadosBeneficiario');
  const contratadoExecutante = filhoTiss(guiaEl, 'contratadoExecutante');
  const dadosAtendimento = filhoTiss(guiaEl, 'dadosAtendimento');
  const proc = filhoTiss(dadosAtendimento, 'procedimento');

  return {
    registroANS: textoDeTiss(cabecalho, 'registroANS'),
    numeroGuiaPrestador: textoDeTiss(cabecalho, 'numeroGuiaPrestador'),
    numeroGuiaOperadora: textoDeTiss(guiaEl, 'numeroGuiaOperadora'),
    numeroCarteira: textoDeTiss(beneficiario, 'numeroCarteira'),
    atendimentoRN: textoDeTiss(beneficiario, 'atendimentoRN'),
    contratado: extrairContratadoTiss(contratadoExecutante),
    cnes: textoDeTiss(contratadoExecutante, 'CNES'),
    executante: extrairProfissionalTiss(filhoTiss(guiaEl, 'profissionalExecutante')),
    indicacaoAcidente: textoDeTiss(guiaEl, 'indicacaoAcidente'),
    dataAtendimento: textoDeTiss(dadosAtendimento, 'dataAtendimento'),
    tipoConsulta: textoDeTiss(dadosAtendimento, 'tipoConsulta'),
    codigoTabela: proc ? textoDeTiss(proc, 'codigoTabela') : '',
    codigoProcedimento: proc ? textoDeTiss(proc, 'codigoProcedimento') : '',
    valorProcedimento: proc ? numDeTiss(textoDeTiss(proc, 'valorProcedimento')) : null,
    observacao: textoDeTiss(guiaEl, 'observacao'),
  };
}

function montarHtmlImpressaoConsulta(dados, contexto) {
  return `
    <div class="guia-oficial">
      <div class="go-cabecalho">
        <div class="go-cabecalho-prestador">
          <div class="go-prestador">${escaparHtml(contexto.razaoSocialExecutante || contexto.prestadorOrigem || 'Prestador não identificado')}</div>
          <div class="go-operadora">${escaparHtml(contexto.operadoraNome || (contexto.registroOperadora ? `Operadora — registro ANS ${contexto.registroOperadora}` : 'Operadora não identificada'))}</div>
        </div>
        <div class="go-titulo">GUIA DE CONSULTA</div>
        <div class="go-campo go-campo-guia-prestador">
          <span class="go-rotulo">2 - Nº guia no prestador</span>
          <span class="go-valor">${escaparHtml(dados.numeroGuiaPrestador || '—')}</span>
        </div>
      </div>
      <p class="go-aviso">Reprodução do layout oficial do Padrão TISS/ANS a partir dos dados do XML já validado neste portal — não substitui a guia original nem é enviada a nenhuma operadora. Nome, validade da carteira e CNS do beneficiário não existem mais no XML desde a v4.00.00 (LGPD). Nome do contratado (campo 10) buscado pelo CNPJ na BrasilAPI ao clicar em imprimir.</p>

      <div class="go-grid go-grid-2">
        ${campoOficial('1 - Registro ANS', dados.registroANS)}
        ${campoOficial('3 - Número da guia atribuído pela operadora', dados.numeroGuiaOperadora)}
      </div>

      <div class="go-secao-titulo">Dados do beneficiário</div>
      <div class="go-grid go-grid-5">
        ${campoOficial('4 - Número da carteira', dados.numeroCarteira)}
        <div class="go-campo"><span class="go-rotulo">5 - Validade da carteira</span><span class="go-valor go-valor-obs">retirado do XML (LGPD)</span></div>
        ${campoOficial('6 - Atendimento a RN', dados.atendimentoRN === 'S' ? 'Sim' : dados.atendimentoRN === 'N' ? 'Não' : dados.atendimentoRN)}
        <div class="go-campo"><span class="go-rotulo">7 - Nome</span><span class="go-valor go-valor-obs">retirado do XML (LGPD)</span></div>
        <div class="go-campo"><span class="go-rotulo">8 - Cartão Nacional de Saúde</span><span class="go-valor go-valor-obs">retirado do XML (LGPD)</span></div>
      </div>

      <div class="go-secao-titulo">Dados do contratado</div>
      <div class="go-grid go-grid-3">
        ${campoOficial(`9 - ${dados.contratado.rotulo || 'Código na operadora'}`, dados.contratado.valor)}
        ${campoOficial('10 - Nome do contratado', contexto.razaoSocialExecutante || contexto.prestadorOrigem)}
        ${campoOficial('11 - Código CNES', dados.cnes)}
      </div>
      <div class="go-grid go-grid-5">
        ${campoOficial('12 - Nome do profissional executante', dados.executante ? dados.executante.nome : '')}
        ${campoOficial('13 - Conselho profissional', dados.executante ? (TISS_CONSELHOS[dados.executante.conselho] || dados.executante.conselho) : '')}
        ${campoOficial('14 - Número no conselho', dados.executante ? dados.executante.numeroConselho : '')}
        ${campoOficial('15 - UF', dados.executante ? (TISS_UF_SIGLA[dados.executante.uf] || dados.executante.uf) : '')}
        ${campoOficial('16 - Código CBO', dados.executante ? dados.executante.cbo : '')}
      </div>

      <div class="go-secao-titulo">Dados do atendimento / procedimento realizado</div>
      <div class="go-grid go-grid-2">
        ${campoOficial('17 - Indicação de acidente', TISS_INDICADOR_ACIDENTE[dados.indicacaoAcidente] || dados.indicacaoAcidente)}
      </div>
      <div class="go-grid go-grid-5">
        ${campoOficial('18 - Data do atendimento', dados.dataAtendimento ? formatarDataBR(dados.dataAtendimento) : '')}
        ${campoOficial('19 - Tipo de consulta', TISS_TIPO_CONSULTA[dados.tipoConsulta] || dados.tipoConsulta)}
        ${campoOficial('20 - Tabela', dados.codigoTabela)}
        ${campoOficial('21 - Código do procedimento', dados.codigoProcedimento)}
        ${campoOficial('22 - Valor do procedimento (R$)', dados.valorProcedimento !== null ? fmtMoeda(dados.valorProcedimento) : '')}
      </div>

      ${dados.observacao ? `<div class="go-secao-titulo">23 - Observação / Justificativa</div><p class="go-observacao">${escaparHtml(dados.observacao)}</p>` : ''}

      <div class="go-assinaturas">
        <div class="go-assinatura">24 - Assinatura do profissional executante</div>
        <div class="go-assinatura">25 - Assinatura do beneficiário ou responsável</div>
      </div>
    </div>`;
}

function abrirModalGuiaValidador(guia) {
  const modalEl = document.getElementById('modal-validador-guia');
  const tituloEl = document.getElementById('validador-guia-titulo');
  const tabsEl = document.getElementById('validador-guia-tabs');
  const conteudoEl = document.getElementById('validador-guia-conteudo');
  const btnImprimirEl = document.getElementById('btn-imprimir-guia-oficial');
  if (!modalEl) return;

  tituloEl.textContent = `${guia.tipo}${guia.numeroGuiaPrestador ? ` — ${guia.numeroGuiaPrestador}` : ''}`;

  // Impressão no layout oficial ANS: cada tipo de guia tem seu próprio
  // formulário/layout — Honorário Individual não será implementada.
  const IMPRESSAO_GUIA_OFICIAL = {
    'guiaSP-SADT': { extrair: extrairDadosImpressaoSPSADT, montar: montarHtmlImpressaoSPSADT },
    guiaResumoInternacao: { extrair: extrairDadosImpressaoResumoInternacao, montar: montarHtmlImpressaoResumoInternacao },
    guiaConsulta: { extrair: extrairDadosImpressaoConsulta, montar: montarHtmlImpressaoConsulta },
  };
  if (btnImprimirEl) {
    const impressao = IMPRESSAO_GUIA_OFICIAL[guia.tipo];
    if (impressao && guia.elementoXml) {
      btnImprimirEl.classList.remove('hidden');
      btnImprimirEl.textContent = '🖨 Imprimir no layout ANS';
      btnImprimirEl.onclick = async () => {
        const contexto = { ...(guia.contextoArquivo || {}) };
        // Busca a razão social do CNPJ do prestador (BrasilAPI) pra exibir
        // como "Nome do Contratado" em vez do CNPJ cru — mesma fonte já
        // usada no botão "Buscar CNPJ" da tela principal, com cache
        // compartilhado. Só roda ao clicar em imprimir (ação explícita do
        // usuário), nunca automático.
        if (contexto.prestadorOrigemCnpj) {
          btnImprimirEl.disabled = true;
          btnImprimirEl.textContent = 'Consultando CNPJ…';
          try {
            const dadosCnpj = await buscarCnpjBrasilApi(contexto.prestadorOrigemCnpj);
            contexto.razaoSocialExecutante = dadosCnpj.razao_social || null;
          } catch (err) {
            console.error('Erro ao buscar razão social do CNPJ para impressão:', err);
          } finally {
            btnImprimirEl.disabled = false;
            btnImprimirEl.textContent = '🖨 Imprimir no layout ANS';
          }
        }
        const dados = impressao.extrair(guia.elementoXml);
        const guiaPrintAreaEl = document.getElementById('guia-print-area');
        guiaPrintAreaEl.innerHTML = impressao.montar(dados, contexto);
        document.body.classList.add('modo-guia');
        window.print();
      };
    } else {
      btnImprimirEl.classList.add('hidden');
      btnImprimirEl.onclick = null;
    }
  }

  const { porGrupo, ordenados } = agruparItens(itensDaGuia(guia));
  const abas = [
    { chave: '__resumo', rotulo: 'Resumo' },
    ...ordenados.map((g) => ({ chave: g, rotulo: `${g} (${porGrupo.get(g).length})` })),
    { chave: '__profissionais', rotulo: `Profissionais (${(guia.profissionais || []).length})` },
  ];

  const montarConteudo = (chave) => {
    if (chave === '__resumo') return renderizarResumoGuiaModal(guia);
    if (chave === '__profissionais') return renderizarProfissionaisGuiaModal(guia);
    return renderizarTabelaGrupoModal(porGrupo.get(chave) || []);
  };

  tabsEl.innerHTML = abas
    .map((a, i) => `<button type="button" class="tab-btn guia-modal-tab ${i === 0 ? 'active' : ''}" data-chave="${escaparHtml(a.chave)}">${escaparHtml(a.rotulo)}</button>`)
    .join('');
  conteudoEl.innerHTML = montarConteudo(abas[0].chave);

  tabsEl.querySelectorAll('.guia-modal-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      tabsEl.querySelectorAll('.guia-modal-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      conteudoEl.innerHTML = montarConteudo(btn.dataset.chave);
    });
  });

  modalEl.classList.remove('hidden');
}

function fecharModalGuiaValidador() {
  const modalEl = document.getElementById('modal-validador-guia');
  if (modalEl) modalEl.classList.add('hidden');
}

const modalValidadorGuiaEl = document.getElementById('modal-validador-guia');
if (modalValidadorGuiaEl) {
  document.getElementById('btn-fechar-validador-guia').addEventListener('click', fecharModalGuiaValidador);
  modalValidadorGuiaEl.addEventListener('click', (e) => {
    if (e.target === modalValidadorGuiaEl) fecharModalGuiaValidador();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModalGuiaValidador();
  });
}

function exportarGruposDespesaCsv(resultado) {
  const { porGrupo, ordenados } = agruparPorTipoDespesa(resultado);
  const linhas = [['Grupo', 'Data', 'Código', 'Descrição', 'Quantidade', 'Valor (R$)']];
  ordenados.forEach((grupo) => {
    porGrupo.get(grupo).forEach((it) => {
      linhas.push([grupo, it.dataExecucao || '', it.codigoProcedimento || '', it.descricaoProcedimento || '', it.quantidade ?? 1, numCsv(it.valorTotal ?? 0)]);
    });
  });
  baixarCsv(`validador-tiss-grupos-${resultado.nomeArquivo.replace(/\.xml$/i, '')}.csv`, linhas);
}

function renderizarValidadorTiss(resultado, containerEl) {
  containerEl = containerEl || validadorResultadoEl;
  if (resultado.erroParse) {
    containerEl.innerHTML = `<div class="msg erro">Arquivo não é um XML válido: ${escaparHtml(resultado.erroParse)}</div>`;
    return;
  }

  const linhaHash = resultado.hash.declarado
    ? resultado.hash.ok
      ? `<div class="validador-linha ok">✔ Hash confere (${escaparHtml(resultado.hash.declarado)})</div>`
      : `<div class="validador-linha erro">✘ Hash não confere — declarado ${escaparHtml(resultado.hash.declarado)}, calculado ${escaparHtml(resultado.hash.calculado)}. O conteúdo pode ter sido alterado após a geração do arquivo.</div>`
    : `<div class="validador-linha aviso">— Arquivo não tem &lt;ans:hash&gt; no epílogo</div>`;

  const versaoConhecida = TISS_VERSOES_CONHECIDAS.includes(resultado.versao);
  const versaoAtual = resultado.versao === TISS_VERSAO_VIGENTE;
  const versaoEsc = escaparHtml(resultado.versao);
  const linhaVersao = !resultado.versao
    ? `<div class="validador-linha aviso">— Versão do Padrão (&lt;ans:Padrao&gt;) não informada</div>`
    : !versaoConhecida
    ? `<div class="validador-linha aviso">⚠ Versão "${versaoEsc}" não reconhecida</div>`
    : versaoAtual
    ? `<div class="validador-linha ok">✔ Versão ${versaoEsc} (vigente)</div>`
    : `<div class="validador-linha aviso">⚠ Versão ${versaoEsc} desatualizada — a obrigatória desde 01/07/2026 é ${TISS_VERSAO_VIGENTE}</div>`;

  const linhaOperadora = resultado.operadoraDestino.registro
    ? `<div class="validador-linha">Operadora de destino (registro ANS ${escaparHtml(resultado.operadoraDestino.registro)}): <strong>${escaparHtml(resultado.operadoraDestino.nome) || 'não encontrada na base de operadoras ativas'}</strong></div>`
    : '';
  const linhaPrestador = resultado.prestadorOrigem
    ? `<div class="validador-linha">
        Prestador de origem: ${escaparHtml(resultado.prestadorOrigem)}
        ${resultado.prestadorOrigemCnpj ? '<button type="button" id="btn-buscar-cnpj" class="chip-btn" style="margin-left:8px;">🔍 Buscar CNPJ</button><div id="cnpj-resultado" class="referencia-tabela"></div>' : ''}
      </div>`
    : '';
  const linhaLote = resultado.numeroLote ? `<div class="validador-linha">Lote: ${escaparHtml(resultado.numeroLote)}</div>` : '';

  let linhaUnimed = '';
  if (resultado.unimed && resultado.unimed.digitoArquivo && resultado.unimed.rotuloArquivo) {
    const u = resultado.unimed;
    linhaUnimed =
      u.bateComLote === false
        ? `<div class="validador-linha erro">✘ Convenção Unimed: nome do arquivo indica tipo "${escaparHtml(u.digitoArquivo)}" (${escaparHtml(u.rotuloArquivo)}), mas o lote começa com "${escaparHtml(u.digitoLote)}" — não batem.</div>`
        : u.bateComLote === true
        ? `<div class="validador-linha ok">✔ Convenção Unimed: tipo "${escaparHtml(u.digitoArquivo)}" — ${escaparHtml(u.rotuloArquivo)} (bate com o lote)</div>`
        : `<div class="validador-linha">— Convenção Unimed: tipo "${escaparHtml(u.digitoArquivo)}" — ${escaparHtml(u.rotuloArquivo)} (lote original — carregue junto com os arquivos 2 e 5 do mesmo envio para conferir)</div>`;
  }

  const codigosTabelaEncontrados = new Set();
  resultado.guias.forEach((g) => {
    g.itens.forEach((it) => it.codigoTabela && codigosTabelaEncontrados.add(it.codigoTabela));
    if (g.consultaItem && g.consultaItem.codigoTabela) codigosTabelaEncontrados.add(g.consultaItem.codigoTabela);
  });
  const codigosDesconhecidos = Array.from(codigosTabelaEncontrados).filter((c) => !TISS_CODIGOS_TABELA[c]);
  const linhaCodigos =
    codigosTabelaEncontrados.size === 0
      ? ''
      : codigosDesconhecidos.length > 0
      ? `<div class="validador-linha aviso">⚠ Código(s) de tabela não reconhecido(s): ${codigosDesconhecidos.map(escaparHtml).join(', ')}</div>`
      : `<div class="validador-linha ok">✔ Códigos de tabela conhecidos: ${Array.from(codigosTabelaEncontrados)
          .map((c) => `${escaparHtml(c)} (${escaparHtml(TISS_CODIGOS_TABELA[c])})`)
          .join('; ')}</div>`;

  let linhaXsd = '';
  let detalheXsd = '';
  if (resultado.xsd) {
    if (resultado.xsd.disponivel === false) {
      linhaXsd = `<div class="validador-linha aviso">— Não foi possível carregar a validação estrutural (XSD): ${escaparHtml(resultado.xsd.erroCarregamento)}</div>`;
    } else if (resultado.xsd.valid) {
      linhaXsd = `<div class="validador-linha ok">✔ Estrutura conforme o XSD oficial do Padrão TISS 4.03.00</div>`;
    } else {
      linhaXsd = `<div class="validador-linha erro">✘ ${resultado.xsd.erros.length} erro(s) de estrutura contra o XSD oficial do Padrão TISS 4.03.00 (ver abaixo)</div>`;
      detalheXsd = `
        <details class="grupo grupo-secundario">
          <summary class="grupo-summary"><span class="grupo-nome">Erros de estrutura (XSD)</span></summary>
          <div class="grupo-corpo">
            <ul style="margin:8px 16px; padding-left:18px; font-family: var(--mono); font-size:0.78rem;">
              ${resultado.xsd.erros.map((e) => `<li>${escaparHtml(e)}</li>`).join('')}
            </ul>
          </div>
        </details>`;
    }
  }

  const tiposGuiaHtml = Object.entries(resultado.tiposGuia)
    .map(([tipo, qtd]) => `<span class="pct-badge pct-badge-neutro">${escaparHtml(tipo)} × ${qtd}</span>`)
    .join(' ');

  const guiasHtml = resultado.guias.map((g, i) => renderizarGuiaTiss(g, i)).join('');

  containerEl.innerHTML = `
    <div class="edicao-card">
      <div class="edicao-card-head">
        <span class="nome">${escaparHtml(resultado.nomeArquivo)}</span>
        <span class="ano">${(resultado.tamanhoBytes / 1024).toFixed(1)} KB</span>
      </div>
      <div class="breakdown">
        ${linhaHash}
        ${linhaVersao}
        ${linhaOperadora}
        ${linhaPrestador}
        ${linhaLote}
        ${linhaUnimed}
        ${linhaCodigos}
        ${linhaXsd}
      </div>
      ${detalheXsd}
      <div class="referencia-tabela">Guias encontradas: ${tiposGuiaHtml || '—'}</div>
      ${renderizarGruposDespesa(resultado)}
    </div>
    ${
      resultado.guias.length > 0
        ? `<div class="field" style="max-width:340px; margin:16px 0 0;">
            <label for="validador-busca-guia">Buscar guia por número</label>
            <input type="text" id="validador-busca-guia" placeholder="Ex: 461088482">
          </div>`
        : ''
    }
    <div id="validador-guias-grid" class="cards-grid" style="margin-top:12px;">${guiasHtml}</div>
  `;

  containerEl.querySelectorAll('.edicao-card-head.clicavel').forEach((el) => {
    const abrir = () => abrirModalGuiaValidador(resultado.guias[Number(el.dataset.guiaIndice)]);
    el.addEventListener('click', abrir);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrir();
      }
    });
  });

  const buscaGuiaEl = containerEl.querySelector('#validador-busca-guia');
  if (buscaGuiaEl) {
    buscaGuiaEl.addEventListener('input', () => {
      const termo = buscaGuiaEl.value.trim().toLowerCase();
      const cards = containerEl.querySelectorAll('#validador-guias-grid > .edicao-card');
      cards.forEach((card, i) => {
        const g = resultado.guias[i];
        const alvo = `${g.numeroGuiaPrestador || ''} ${g.tipo || ''}`.toLowerCase();
        card.style.display = !termo || alvo.includes(termo) ? '' : 'none';
      });
    });
  }

  const btnCnpj = containerEl.querySelector('#btn-buscar-cnpj');
  if (btnCnpj) {
    btnCnpj.addEventListener('click', async () => {
      const alvo = containerEl.querySelector('#cnpj-resultado');
      alvo.textContent = 'Consultando BrasilAPI…';
      try {
        const dados = await buscarCnpjBrasilApi(resultado.prestadorOrigemCnpj);
        const situacao = escaparHtml(dados.descricao_situacao_cadastral) || '—';
        alvo.innerHTML = `<strong>${escaparHtml(dados.razao_social) || '—'}</strong>${dados.nome_fantasia ? ` (${escaparHtml(dados.nome_fantasia)})` : ''} — situação cadastral: ${situacao}`;
      } catch (err) {
        alvo.textContent = `Não foi possível consultar o CNPJ: ${err.message}`;
      }
    });
  }

  const btnExportarGrupos = containerEl.querySelector('#btn-exportar-grupos-csv');
  if (btnExportarGrupos) {
    btnExportarGrupos.addEventListener('click', () => exportarGruposDespesaCsv(resultado));
  }
}

// Histórico local de validações — guarda só um resumo de cada arquivo já
// validado (nunca o XML em si) para consulta rápida depois, tudo em
// localStorage (nunca sai do navegador).
const TISS_HISTORICO_KEY = 'cbhpmValidadorTissHistorico';
const TISS_HISTORICO_MAX = 20;

function carregarHistoricoTiss() {
  try {
    const bruto = localStorage.getItem(TISS_HISTORICO_KEY);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function statusGeralValidacaoTiss(resultado) {
  const hashErro = resultado.hash.declarado && resultado.hash.ok === false;
  const itemErro = resultado.guias.some(
    (g) => g.itens.some((it) => it.ok === false) || (g.valorTotal && (g.valorTotal.okComponentes === false || g.valorTotal.okItens === false))
  );
  const unimedErro = resultado.unimed && resultado.unimed.bateComLote === false;
  if (hashErro || itemErro || unimedErro) return 'erro';
  const versaoAviso = resultado.versao && (!TISS_VERSOES_CONHECIDAS.includes(resultado.versao) || resultado.versao !== TISS_VERSAO_VIGENTE);
  if (versaoAviso) return 'aviso';
  return 'ok';
}

function registrarHistoricoTiss(resultado) {
  const valorTotal = valorTotalArquivo(resultado);
  const entrada = {
    data: new Date().toISOString(),
    nomeArquivo: resultado.nomeArquivo,
    tamanhoBytes: resultado.tamanhoBytes,
    versao: resultado.versao || '',
    operadora: resultado.operadoraDestino.nome || resultado.operadoraDestino.registro || '',
    numeroLote: resultado.numeroLote || '',
    qtdGuias: resultado.guias.length,
    valorTotal,
    status: statusGeralValidacaoTiss(resultado),
  };
  const lista = [entrada, ...carregarHistoricoTiss()].slice(0, TISS_HISTORICO_MAX);
  try {
    localStorage.setItem(TISS_HISTORICO_KEY, JSON.stringify(lista));
  } catch {
    /* localStorage indisponível ou cheio — histórico é conveniência, não crítico */
  }
  renderizarHistoricoTiss();
}

function renderizarHistoricoTiss() {
  const alvo = document.getElementById('validador-historico-lista');
  if (!alvo) return;
  const lista = carregarHistoricoTiss();
  if (lista.length === 0) {
    alvo.innerHTML = '<p class="ajustes-nota" style="margin:0 16px;">Nenhuma validação registrada ainda.</p>';
    return;
  }
  const iconeStatus = { ok: '✔', aviso: '⚠', erro: '✘' };
  const classeStatus = { ok: 'ok', aviso: 'aviso', erro: 'erro' };
  alvo.innerHTML = lista
    .map((e) => {
      const dataFmt = new Date(e.data).toLocaleString('pt-BR');
      return `
        <div class="validador-linha ${classeStatus[e.status] || ''}">
          ${iconeStatus[e.status] || '—'} <strong>${escaparHtml(e.nomeArquivo)}</strong> — ${dataFmt}
          <span class="detail" style="display:block; font-family: var(--mono); font-size:0.75rem;">
            ${escaparHtml(e.operadora) || 'operadora não identificada'} · lote ${escaparHtml(e.numeroLote) || '—'} · ${e.qtdGuias} guia(s) · ${fmtMoeda(e.valorTotal)}
            ${e.versao ? `· versão ${escaparHtml(e.versao)}` : ''}
          </span>
        </div>`;
    })
    .join('');
}

const btnLimparHistoricoTiss = document.getElementById('btn-limpar-historico-tiss');
if (btnLimparHistoricoTiss) {
  btnLimparHistoricoTiss.addEventListener('click', () => {
    localStorage.removeItem(TISS_HISTORICO_KEY);
    renderizarHistoricoTiss();
  });
}

renderizarHistoricoTiss();

// Total de uma guia, cobrindo tanto guiaConsulta (sem <ans:valorTotal>, só
// consultaItem.valorTotal) quanto as demais (com <ans:valorTotal>).
function valorTotalGuia(guia) {
  if (guia.valorTotal && guia.valorTotal.valorTotalGeral !== null) return guia.valorTotal.valorTotalGeral || 0;
  return itensDaGuia(guia).reduce((s, it) => s + (it.valorTotal || 0), 0);
}

function valorTotalArquivo(resultado) {
  return resultado.guias.reduce((s, g) => s + valorTotalGuia(g), 0);
}

// Conferência entre múltiplos arquivos carregados juntos — pensada para o
// caso da Unimed que divide o mesmo lote em 3 arquivos (0/2/5, ver
// UNIMED_ROTULOS_ARQUIVO): confere se todos são da mesma operadora e se o
// "final" do número do lote (tudo menos o primeiro dígito) bate entre eles.
function analisarCrossCheckUnimed(resultados) {
  const comDigito = resultados
    .map((r, indice) => ({ indice, resultado: r, unimed: r.unimed }))
    .filter((x) => x.unimed && x.unimed.digitoArquivo);
  if (comDigito.length < 2) return null;

  const registros = new Set(comDigito.map((x) => x.resultado.operadoraDestino.registro || ''));
  const mesmaOperadora = registros.size === 1;

  // Lote-base: no arquivo "0" é o lote inteiro; no "2"/"5" é o lote sem o
  // dígito do tipo prefixado (só quando esse dígito realmente bate — ver
  // resultado.unimed.loteBase). Precisa bater entre TODOS os arquivos do
  // grupo — se algum não deu pra determinar (ex: lote do "2" não começa
  // com "2"), o próprio card daquele arquivo já mostra o erro específico.
  const semBaseDefinida = comDigito.filter((x) => x.unimed.loteBase === null);
  const bases = comDigito.map((x) => x.unimed.loteBase);
  const mesmoLoteBase = semBaseDefinida.length === 0 && bases.every((b) => b === bases[0]) && bases[0] !== '';

  const digitos = comDigito.map((x) => x.unimed.digitoArquivo);
  const digitosRepetidos = digitos.length !== new Set(digitos).size;

  return { comDigito, mesmaOperadora, mesmoLoteBase, digitosRepetidos, semBaseDefinida, loteBase: bases[0] || null };
}

function renderizarCrossCheckArquivos(resultados) {
  const valorPorArquivo = resultados.map((r) => ({ nome: r.nomeArquivo, total: valorTotalArquivo(r) }));
  const totalGeral = valorPorArquivo.reduce((s, x) => s + x.total, 0);

  const linhasArquivos = valorPorArquivo
    .map((x) => `<div class="breakdown-row"><span class="label">${escaparHtml(x.nome)}</span><span class="value">${fmtMoeda(x.total)}</span></div>`)
    .join('');

  const cc = analisarCrossCheckUnimed(resultados);
  let ccHtml = '';
  if (cc) {
    const badgesDigitos = cc.comDigito
      .map((x) => `<span class="pct-badge pct-badge-neutro">${escaparHtml(x.unimed.digitoArquivo)} — ${escaparHtml(x.unimed.rotuloArquivo) || '?'} (${escaparHtml(x.resultado.nomeArquivo)})</span>`)
      .join(' ');
    ccHtml = `
      <div class="breakdown" style="margin-top:4px;">
        <div class="validador-linha ${cc.mesmaOperadora ? 'ok' : 'erro'}">
          ${cc.mesmaOperadora ? '✔ Todos os arquivos com a convenção Unimed 0/2/5 são para a mesma operadora' : '✘ Os arquivos com a convenção Unimed 0/2/5 apontam para operadoras diferentes — confira se pertencem ao mesmo envio'}
        </div>
        <div class="validador-linha ${cc.mesmoLoteBase ? 'ok' : 'erro'}">
          ${
            cc.mesmoLoteBase
              ? `✔ Mesmo lote-base entre os arquivos (base "${escaparHtml(cc.loteBase)}")`
              : cc.semBaseDefinida.length > 0
              ? `✘ Não foi possível determinar o lote-base de ${cc.semBaseDefinida.length === 1 ? 'um dos arquivos' : 'alguns dos arquivos'} (o lote não começa com o dígito do tipo esperado)`
              : '✘ Os arquivos têm lotes-base diferentes — pode não ser o mesmo envio dividido em 0/2/5'
          }
        </div>
        ${cc.digitosRepetidos ? `<div class="validador-linha aviso">⚠ Mais de um arquivo com o mesmo dígito inicial — confira se não carregou o mesmo tipo duas vezes</div>` : ''}
      </div>
      <div class="referencia-tabela">Tipos identificados (convenção Unimed): ${badgesDigitos}</div>`;
  }

  return `
    <div class="edicao-card" style="margin-bottom:20px;">
      <div class="edicao-card-head">
        <span class="nome">Conferência entre os ${resultados.length} arquivos carregados</span>
        <span class="ano">${fmtMoeda(totalGeral)}</span>
      </div>
      <div class="breakdown">${linhasArquivos}</div>
      ${ccHtml}
    </div>`;
}

function renderizarResultadosValidador(resultados) {
  validadorResultadoEl.innerHTML = '';
  if (resultados.length > 1) {
    const crossCheckEl = document.createElement('div');
    crossCheckEl.innerHTML = renderizarCrossCheckArquivos(resultados);
    validadorResultadoEl.appendChild(crossCheckEl);
  }
  resultados.forEach((resultado, i) => {
    const wrapperEl = document.createElement('div');
    if (i > 0) wrapperEl.style.marginTop = '28px';
    validadorResultadoEl.appendChild(wrapperEl);
    renderizarValidadorTiss(resultado, wrapperEl);
  });
}

if (validadorArquivoEl) {
  validadorArquivoEl.addEventListener('change', async () => {
    const files = Array.from(validadorArquivoEl.files);
    if (files.length === 0) return;
    validadorResultadoEl.innerHTML = '<div class="msg vazio">Analisando…</div>';
    try {
      const resultados = [];
      for (const file of files) {
        const resultado = await validarArquivoTiss(file);
        resultados.push(resultado);
        registrarHistoricoTiss(resultado);
      }
      renderizarResultadosValidador(resultados);
    } catch (err) {
      console.error(err);
      validadorResultadoEl.innerHTML = `<div class="msg erro">Erro ao analisar o(s) arquivo(s): ${err.message}</div>`;
    }
  });
}

// Comparação entre dois arquivos TISS (ex: original × reenviado após
// glosa) — casa as guias pelo número da guia (prestador) e, dentro de cada
// guia presente nos dois, agrupa os itens por código para comparar
// quantidade e valor.
function agruparItensPorCodigo(itens) {
  const mapa = new Map();
  itens.forEach((it) => {
    const chave = `${it.codigoTabela || ''}|${it.codigoProcedimento || ''}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        codigoTabela: it.codigoTabela,
        codigoProcedimento: it.codigoProcedimento,
        descricaoProcedimento: it.descricaoProcedimento,
        quantidade: 0,
        valorTotal: 0,
      });
    }
    const acc = mapa.get(chave);
    acc.quantidade += it.quantidade || 0;
    acc.valorTotal += it.valorTotal || 0;
  });
  return mapa;
}

function compararItensGuia(guiaA, guiaB) {
  const mapaA = agruparItensPorCodigo(itensDaGuia(guiaA));
  const mapaB = agruparItensPorCodigo(itensDaGuia(guiaB));
  const chaves = new Set([...mapaA.keys(), ...mapaB.keys()]);
  return Array.from(chaves)
    .map((chave) => {
      const a = mapaA.get(chave);
      const b = mapaB.get(chave);
      const base = a || b;
      const qtdA = a ? a.quantidade : 0;
      const qtdB = b ? b.quantidade : 0;
      const valorA = a ? a.valorTotal : 0;
      const valorB = b ? b.valorTotal : 0;
      let status = 'igual';
      if (!a) status = 'novo';
      else if (!b) status = 'removido';
      else if (Math.abs(valorA - valorB) > 0.02 || qtdA !== qtdB) status = 'mudou';
      return {
        codigoTabela: base.codigoTabela,
        codigoProcedimento: base.codigoProcedimento,
        descricaoProcedimento: base.descricaoProcedimento,
        qtdA,
        qtdB,
        valorA,
        valorB,
        status,
      };
    })
    .sort((x, y) => (x.status === 'igual' ? 1 : 0) - (y.status === 'igual' ? 1 : 0));
}

function compararGuiasTiss(resultadoA, resultadoB) {
  const chaveGuia = (g, i) => g.numeroGuiaPrestador || `${g.tipo} #${i + 1}`;
  const porGuiaA = new Map(resultadoA.guias.map((g, i) => [chaveGuia(g, i), g]));
  const porGuiaB = new Map(resultadoB.guias.map((g, i) => [chaveGuia(g, i), g]));
  const chaves = new Set([...porGuiaA.keys(), ...porGuiaB.keys()]);

  const linhas = Array.from(chaves).map((chave) => {
    const a = porGuiaA.get(chave) || null;
    const b = porGuiaB.get(chave) || null;
    if (a && !b) return { chave, status: 'removida', totalA: valorTotalGuia(a), totalB: 0, itens: [] };
    if (!a && b) return { chave, status: 'nova', totalA: 0, totalB: valorTotalGuia(b), itens: [] };
    const totalA = valorTotalGuia(a);
    const totalB = valorTotalGuia(b);
    const itens = compararItensGuia(a, b);
    const mudou = Math.abs(totalA - totalB) > 0.02 || itens.some((it) => it.status !== 'igual');
    return { chave, status: mudou ? 'mudou' : 'igual', totalA, totalB, itens };
  });

  const ordem = { mudou: 0, nova: 1, removida: 2, igual: 3 };
  linhas.sort((x, y) => ordem[x.status] - ordem[y.status]);
  return linhas;
}

// Confere se os dois arquivos parecem realmente ser do mesmo "par"
// (operadora e prestador) antes de comparar — evita comparar, por engano,
// o XML de uma operadora/convênio com o de outra, ou de um prestador com o
// de outro. Não bloqueia a comparação (o usuário pode ter um motivo
// legítimo pra comparar mesmo assim), só avisa com destaque. Lote não é
// exigido igual: um reenvio após glosa normalmente muda de lote.
function analisarCompatibilidadeComparacao(resultadoA, resultadoB) {
  const registroA = resultadoA.operadoraDestino.registro;
  const registroB = resultadoB.operadoraDestino.registro;
  const mesmaOperadora = registroA && registroB ? registroA === registroB : null;

  const prestadorA = resultadoA.prestadorOrigem;
  const prestadorB = resultadoB.prestadorOrigem;
  const mesmoPrestador = prestadorA && prestadorB ? prestadorA === prestadorB : null;

  const chaveGuia = (g, i) => g.numeroGuiaPrestador || `${g.tipo} #${i + 1}`;
  const chavesA = new Set(resultadoA.guias.map(chaveGuia));
  const chavesB = new Set(resultadoB.guias.map(chaveGuia));
  const emComum = Array.from(chavesA).filter((c) => chavesB.has(c)).length;

  return { mesmaOperadora, mesmoPrestador, emComum };
}

function renderizarAvisoCompatibilidadeComparacao(resultadoA, resultadoB) {
  const c = analisarCompatibilidadeComparacao(resultadoA, resultadoB);
  const avisos = [];
  if (c.mesmaOperadora === false) {
    avisos.push(
      `✘ Os arquivos são para operadoras diferentes (${escaparHtml(resultadoA.operadoraDestino.nome || resultadoA.operadoraDestino.registro) || '?'} × ${escaparHtml(resultadoB.operadoraDestino.nome || resultadoB.operadoraDestino.registro) || '?'}).`
    );
  }
  if (c.mesmoPrestador === false) {
    avisos.push(`✘ Os arquivos são de prestadores diferentes (${escaparHtml(resultadoA.prestadorOrigem)} × ${escaparHtml(resultadoB.prestadorOrigem)}).`);
  }
  if (c.emComum === 0) {
    avisos.push('⚠ Nenhuma guia em comum entre os dois arquivos — confira se são do mesmo envio antes de interpretar o resultado abaixo.');
  }
  if (avisos.length === 0) return '';
  return `
    <div class="edicao-card" style="margin-bottom:16px;">
      <div class="edicao-card-head">
        <span class="nome">⚠ Os arquivos podem não ser comparáveis</span>
      </div>
      <div class="breakdown">
        ${avisos.map((a) => `<div class="validador-linha erro">${a}</div>`).join('')}
        <div class="validador-linha aviso">Lote A: ${escaparHtml(resultadoA.numeroLote) || '—'} · Lote B: ${escaparHtml(resultadoB.numeroLote) || '—'}</div>
      </div>
    </div>`;
}

function renderizarComparacaoTiss(resultadoA, resultadoB) {
  const totalA = valorTotalArquivo(resultadoA);
  const totalB = valorTotalArquivo(resultadoB);
  const diferenca = totalB - totalA;
  const linhasGuias = compararGuiasTiss(resultadoA, resultadoB);
  const linhasComDiferenca = linhasGuias.filter((l) => l.status !== 'igual');
  const linhasIguais = linhasGuias.filter((l) => l.status === 'igual');

  const rotuloStatus = { mudou: '⚠ Mudou', nova: '＋ Nova em B', removida: '－ Só em A' };

  const renderizarLinhaGuia = (l) => {
    const itensComDiferenca = (l.itens || []).filter((it) => it.status !== 'igual');
    const itensHtml = itensComDiferenca
      .map(
        (it) => `
        <tr>
          <td>${escaparHtml(it.codigoProcedimento) || '—'}</td>
          <td>${escaparHtml(it.descricaoProcedimento) || '—'}</td>
          <td style="text-align:right">${it.qtdA} → ${it.qtdB}</td>
          <td style="text-align:right">${fmtMoeda(it.valorA)} → ${fmtMoeda(it.valorB)}</td>
          <td style="text-align:right; font-weight:600;">${it.valorB - it.valorA >= 0 ? '+' : ''}${fmtMoeda(it.valorB - it.valorA)}</td>
        </tr>`
      )
      .join('');

    return `
      <div class="edicao-card" style="margin-bottom:12px;">
        <div class="edicao-card-head">
          <span class="nome">${escaparHtml(l.chave)}</span>
          <span class="ano">${rotuloStatus[l.status] || ''}</span>
        </div>
        <div class="breakdown">
          <div class="breakdown-row">
            <span class="label">Total</span>
            <span class="value">${fmtMoeda(l.totalA)} → ${fmtMoeda(l.totalB)}
              <span class="detail" style="display:inline; font-family: var(--mono);">(${l.totalB - l.totalA >= 0 ? '+' : ''}${fmtMoeda(l.totalB - l.totalA)})</span>
            </span>
          </div>
        </div>
        ${
          itensHtml
            ? `<div style="overflow-x:auto;">
                <table class="guia-doc-tabela">
                  <thead><tr><th>Código</th><th>Descrição</th><th style="text-align:right">Qtd (A→B)</th><th style="text-align:right">Valor (A→B)</th><th style="text-align:right">Diferença</th></tr></thead>
                  <tbody>${itensHtml}</tbody>
                </table>
              </div>`
            : ''
        }
      </div>`;
  };

  const linhaDiferenca =
    Math.abs(diferenca) <= 0.02
      ? `<div class="validador-linha ok">✔ Nenhuma diferença de valor total entre os dois arquivos</div>`
      : diferenca < 0
      ? `<div class="validador-linha erro">✘ Total reduziu ${fmtMoeda(Math.abs(diferenca))} de A para B (possível glosa)</div>`
      : `<div class="validador-linha aviso">⚠ Total aumentou ${fmtMoeda(diferenca)} de A para B</div>`;

  compararResultadoEl.innerHTML = `
    ${renderizarAvisoCompatibilidadeComparacao(resultadoA, resultadoB)}
    <div class="edicao-card" style="margin-bottom:16px;">
      <div class="edicao-card-head">
        <span class="nome">${escaparHtml(resultadoA.nomeArquivo)} → ${escaparHtml(resultadoB.nomeArquivo)}</span>
        <span class="ano">${diferenca >= 0 ? '+' : ''}${fmtMoeda(diferenca)}</span>
      </div>
      <div class="breakdown">
        <div class="breakdown-row"><span class="label">Total A (${escaparHtml(resultadoA.nomeArquivo)})</span><span class="value">${fmtMoeda(totalA)}</span></div>
        <div class="breakdown-row"><span class="label">Total B (${escaparHtml(resultadoB.nomeArquivo)})</span><span class="value">${fmtMoeda(totalB)}</span></div>
        ${linhaDiferenca}
      </div>
    </div>
    ${
      linhasComDiferenca.length > 0
        ? linhasComDiferenca.map(renderizarLinhaGuia).join('')
        : '<p class="ajustes-nota">Nenhuma diferença encontrada entre as guias com o mesmo número em A e B.</p>'
    }
    ${
      linhasIguais.length > 0
        ? `<details class="grupo grupo-secundario">
            <summary class="grupo-summary"><span class="grupo-nome">Guias iguais nos dois arquivos (${linhasIguais.length})</span></summary>
            <div class="grupo-corpo"><div class="breakdown">
              ${linhasIguais.map((l) => `<div class="breakdown-row"><span class="label">${escaparHtml(l.chave)}</span><span class="value zero">${fmtMoeda(l.totalA)}</span></div>`).join('')}
            </div></div>
          </details>`
        : ''
    }
  `;
}

const compararArquivoAEl = document.getElementById('comparar-arquivo-a');
const compararArquivoBEl = document.getElementById('comparar-arquivo-b');
const btnCompararArquivos = document.getElementById('btn-comparar-arquivos');
const compararResultadoEl = document.getElementById('comparar-resultado');

if (btnCompararArquivos) {
  btnCompararArquivos.addEventListener('click', async () => {
    const fileA = compararArquivoAEl.files[0];
    const fileB = compararArquivoBEl.files[0];
    if (!fileA || !fileB) {
      compararResultadoEl.innerHTML = '<div class="msg erro">Selecione os dois arquivos (A e B) para comparar.</div>';
      return;
    }
    compararResultadoEl.innerHTML = '<div class="msg vazio">Comparando…</div>';
    try {
      const [resultadoA, resultadoB] = await Promise.all([validarArquivoTiss(fileA), validarArquivoTiss(fileB)]);
      if (resultadoA.erroParse || resultadoB.erroParse) {
        compararResultadoEl.innerHTML = `<div class="msg erro">Arquivo inválido: ${resultadoA.erroParse || resultadoB.erroParse}</div>`;
        return;
      }
      renderizarComparacaoTiss(resultadoA, resultadoB);
    } catch (err) {
      console.error(err);
      compararResultadoEl.innerHTML = `<div class="msg erro">Erro ao comparar: ${err.message}</div>`;
    }
  });
}

// ---------- SUS / SIGTAP ----------
const sigtapBuscaEl = document.getElementById('sigtap-busca');
const sigtapResultadoAreaEl = document.getElementById('sigtap-resultado-area');
const sigtapCompetenciaAreaEl = document.getElementById('sigtap-competencia-area');
let debounceTimerSigtap = null;

async function carregarStatusSigtap() {
  if (!sigtapCompetenciaAreaEl) return;
  try {
    const resp = await fetch('/api/sigtap/status');
    const status = await resp.json();
    renderizarStatusSigtap(status);
  } catch (err) {
    console.error(err);
  }
}

function renderizarStatusSigtap(status) {
  const badge = status.competenciaLegivel
    ? `<span class="sigtap-competencia-badge">Competência: ${escaparHtml(status.competenciaLegivel)}</span>`
    : '';
  const botaoAtualizar = status.atualizacaoDisponivel
    ? `<button type="button" id="btn-sigtap-atualizar" class="chip-btn disponivel">Atualizar para ${escaparHtml(status.ultimaDisponivelLegivel)}</button>`
    : '';
  sigtapCompetenciaAreaEl.innerHTML = badge + botaoAtualizar;

  const btn = document.getElementById('btn-sigtap-atualizar');
  if (btn) {
    btn.addEventListener('click', async () => {
      const senha = window.prompt('Senha para atualizar a base SIGTAP:');
      if (!senha) return;
      btn.disabled = true;
      btn.textContent = 'Atualizando…';
      try {
        const resp = await fetch('/api/sigtap/atualizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ senha }),
        });
        const dados = await resp.json();
        if (!resp.ok) throw new Error(dados.erro || 'Falha ao atualizar.');
        window.alert(`Base SIGTAP atualizada para ${dados.competenciaLegivel}.`);
        await carregarStatusSigtap();
        if (sigtapBuscaEl.value.trim().length >= 2) buscarSigtap(sigtapBuscaEl.value.trim());
      } catch (err) {
        console.error(err);
        window.alert(`Erro ao atualizar: ${err.message}`);
        btn.disabled = false;
        btn.textContent = `Atualizar para ${status.ultimaDisponivelLegivel}`;
      }
    });
  }
}

carregarStatusSigtap();

const ROTULOS_COMPLEXIDADE_SIGTAP = { '1': 'Atenção Básica', '2': 'Média Complexidade', '3': 'Alta Complexidade' };
const ROTULOS_SEXO_SIGTAP = { M: 'Masculino', F: 'Feminino', I: 'Indiferente', N: 'Não se aplica' };

function rotuloComplexidadeSigtap(c) {
  return ROTULOS_COMPLEXIDADE_SIGTAP[c] || 'Não classificada';
}

function rotuloSexoSigtap(s) {
  return ROTULOS_SEXO_SIGTAP[s] || 'Não se aplica';
}

function faixaEtariaSigtap(item) {
  const min = item.idade_minima_legivel;
  const max = item.idade_maxima_legivel;
  if (min && max) return `${min} a ${max}`;
  if (min || max) return min || max;
  return 'Não definida';
}

// 9999 é o valor-sentinela oficial do DATASUS para "não se aplica / sem limite"
// (mesma convenção já usada nos campos de idade). Sem esse tratamento a tela
// mostrava literalmente "9999 dia(s)" ou "9999 execução(ões)".
function formatarQuantidadeSigtap(v, unidadeSingular, unidadePlural) {
  if (v === null || v === undefined) return '—';
  if (v === 9999) return 'Sem limite definido';
  return `${v} ${v === 1 ? unidadeSingular : unidadePlural}`;
}

function fmtMoedaSigtap(v) {
  return v === null || v === undefined ? '—' : fmtMoeda(v);
}

function classificacaoSigtap(item) {
  const partes = [item.grupo_nome, item.sub_grupo_nome, item.forma_organizacao_nome].filter(Boolean);
  return partes.length ? partes.join(' › ') : null;
}

function listaSigtap(arr) {
  return Array.isArray(arr) && arr.length ? arr.join(', ') : null;
}

function renderizarCardSigtap(item) {
  const classificacao = classificacaoSigtap(item);
  const instrumentos = listaSigtap(item.instrumentos_registro);
  const modalidades = listaSigtap(item.modalidades_atendimento);
  const atributos = listaSigtap(item.atributos_complementares);

  const linhasExtras = [
    item.financiamento_nome ? `<div class="breakdown-row"><span class="label">Financiamento</span><span class="value wrap">${escaparHtml(item.financiamento_nome)}</span></div>` : '',
    item.sub_tipo_financiamento_nome ? `<div class="breakdown-row"><span class="label">Sub tipo de financiamento</span><span class="value wrap">${escaparHtml(item.sub_tipo_financiamento_nome)}</span></div>` : '',
    instrumentos ? `<div class="breakdown-row"><span class="label">Instrumento de registro</span><span class="value wrap">${escaparHtml(instrumentos)}</span></div>` : '',
    modalidades ? `<div class="breakdown-row"><span class="label">Modalidade de atendimento</span><span class="value wrap">${escaparHtml(modalidades)}</span></div>` : '',
    atributos ? `<div class="breakdown-row"><span class="label">Atributos complementares</span><span class="value wrap">${escaparHtml(atributos)}</span></div>` : '',
  ].join('');

  return `
    <div class="sigtap-card">
      <div class="sigtap-card-head">
        <span class="codigo">${escaparHtml(item.codigo)}</span>
        <span class="sigtap-badge sigtap-badge-${escaparHtml(item.complexidade || '0')}">${rotuloComplexidadeSigtap(item.complexidade)}</span>
      </div>
      <div class="sigtap-card-nome">${escaparHtml(item.nome)}</div>
      ${classificacao ? `<div class="sigtap-card-classificacao">${escaparHtml(classificacao)}</div>` : ''}
      <div class="breakdown">
        <div class="breakdown-row"><span class="label">Sexo</span><span class="value">${rotuloSexoSigtap(item.sexo)}</span></div>
        <div class="breakdown-row"><span class="label">Faixa etária</span><span class="value">${escaparHtml(faixaEtariaSigtap(item))}</span></div>
        <div class="breakdown-row"><span class="label">Permanência máxima</span><span class="value">${formatarQuantidadeSigtap(item.qt_dias_permanencia, 'dia', 'dias')}</span></div>
        <div class="breakdown-row"><span class="label">Quantidade máxima de execução</span><span class="value">${formatarQuantidadeSigtap(item.qt_maxima_execucao, 'execução', 'execuções')}</span></div>
        ${linhasExtras}
      </div>
      <div class="sigtap-card-valores">
        <div class="valor-item"><span class="valor-label">SH</span><span class="valor-num">${fmtMoedaSigtap(item.vl_sh)}</span></div>
        <div class="valor-item"><span class="valor-label">SA</span><span class="valor-num">${fmtMoedaSigtap(item.vl_sa)}</span></div>
        <div class="valor-item"><span class="valor-label">SP</span><span class="valor-num">${fmtMoedaSigtap(item.vl_sp)}</span></div>
      </div>
    </div>`;
}

let ultimaConsultaSigtap = [];

function exportarSigtapCsv(itens) {
  const linhas = [
    ['Código', 'Nome', 'Complexidade', 'Sexo', 'Faixa etária', 'Permanência máxima', 'Quantidade máxima de execução', 'Financiamento', 'Sub tipo de financiamento', 'SH (R$)', 'SA (R$)', 'SP (R$)'],
  ];
  itens.forEach((item) => {
    linhas.push([
      item.codigo,
      item.nome,
      rotuloComplexidadeSigtap(item.complexidade),
      rotuloSexoSigtap(item.sexo),
      faixaEtariaSigtap(item),
      formatarQuantidadeSigtap(item.qt_dias_permanencia, 'dia', 'dias'),
      formatarQuantidadeSigtap(item.qt_maxima_execucao, 'execução', 'execuções'),
      item.financiamento_nome || '',
      item.sub_tipo_financiamento_nome || '',
      item.vl_sh === null || item.vl_sh === undefined ? '' : numCsv(item.vl_sh),
      item.vl_sa === null || item.vl_sa === undefined ? '' : numCsv(item.vl_sa),
      item.vl_sp === null || item.vl_sp === undefined ? '' : numCsv(item.vl_sp),
    ]);
  });
  baixarCsv('sigtap-procedimentos.csv', linhas);
}

function renderizarResultadoSigtap(itens) {
  ultimaConsultaSigtap = itens;
  if (itens.length === 0) {
    sigtapResultadoAreaEl.innerHTML = '<div class="msg vazio">Nenhum procedimento SIGTAP encontrado.</div>';
    return;
  }
  sigtapResultadoAreaEl.innerHTML = `
    <div class="resultado-acoes">
      <button type="button" id="btn-exportar-sigtap-csv" class="acao-btn">⬇ Excel</button>
    </div>
    <div class="cards-grid">${itens.map(renderizarCardSigtap).join('')}</div>`;
}

sigtapResultadoAreaEl.addEventListener('click', (e) => {
  if (e.target.closest('#btn-exportar-sigtap-csv')) {
    exportarSigtapCsv(ultimaConsultaSigtap);
  }
});

async function buscarSigtap(termo) {
  try {
    const resp = await fetch(`/api/sigtap/buscar?q=${encodeURIComponent(termo)}`);
    if (!resp.ok) throw new Error('Falha na requisição.');
    const itens = await resp.json();
    renderizarResultadoSigtap(itens);
  } catch (err) {
    console.error(err);
    sigtapResultadoAreaEl.innerHTML = '<div class="msg erro">Erro ao buscar procedimentos SIGTAP.</div>';
  }
}

if (sigtapBuscaEl) {
  sigtapBuscaEl.addEventListener('input', () => {
    const termo = sigtapBuscaEl.value.trim();
    clearTimeout(debounceTimerSigtap);

    if (termo.length < 2) {
      sigtapResultadoAreaEl.innerHTML = '';
      return;
    }

    debounceTimerSigtap = setTimeout(() => buscarSigtap(termo), 300);
  });
}

// ---------- Tabelas de Domínio TISS ----------
const tissTabelasSelectEl = document.getElementById('tiss-tabelas-select');
const tissTabelasFiltroCampoEl = document.getElementById('tiss-tabelas-filtro-campo');
const tissTabelasFiltroEl = document.getElementById('tiss-tabelas-filtro');
const tissTabelasResultadoAreaEl = document.getElementById('tiss-tabelas-resultado-area');
let debounceTimerTissTabelas = null;
let tissTabelasDominioCache = null;
let tissTabelaAtual = null;
let tissTabelaLinhasFiltradas = [];
let tissTabelaPagina = 1;
let tissTabelaPorPagina = 10;

async function carregarTissTabelasDominio() {
  if (tissTabelasDominioCache) return tissTabelasDominioCache;
  const resp = await fetch('/tiss-tabelas-dominio.json');
  const dados = await resp.json();
  tissTabelasDominioCache = dados.tabelas;
  const fonteEl = document.getElementById('tiss-tabelas-fonte');
  if (fonteEl && dados.fonte) fonteEl.textContent = `Fonte: ${dados.fonte}`;
  return tissTabelasDominioCache;
}

let glosasDicionarioCache = null;
let glosasDicionarioAberto = false;
async function carregarGlosasDicionario() {
  if (glosasDicionarioCache) return glosasDicionarioCache;
  const resp = await fetch('/glosas-dicionario.json');
  glosasDicionarioCache = await resp.json();
  return glosasDicionarioCache;
}

function renderizarCardGlosaDicionario(item) {
  return `
    <div class="glosa-card">
      <div class="glosa-card-codigo">${escaparHtml(item.codigo)}</div>
      <div class="glosa-card-corpo">
        <div class="glosa-card-linha"><span class="label">Causa provável</span> ${escaparHtml(item.causaProvavel)}</div>
        <div class="glosa-card-linha"><span class="label">Como evitar</span> ${escaparHtml(item.comoEvitar)}</div>
      </div>
    </div>`;
}

function renderizarDicionarioGlosasHtml() {
  if (!glosasDicionarioCache) return '';
  const categoriasHtml = glosasDicionarioCache.categorias
    .map(
      (cat) => `
      <div class="glosa-categoria">
        <h4 class="glosa-categoria-titulo">${escaparHtml(cat.nome)}</h4>
        ${cat.itens.map(renderizarCardGlosaDicionario).join('')}
      </div>`
    )
    .join('');
  return `
    <details id="glosa-dicionario-details" class="grupo grupo-principal" ${glosasDicionarioAberto ? 'open' : ''} style="margin-bottom:16px;">
      <summary class="grupo-summary"><span class="grupo-nome">Dicionário de causas e como evitar (${glosasDicionarioCache.categorias.reduce((s, c) => s + c.itens.length, 0)} códigos mais comuns)</span></summary>
      <div class="grupo-corpo">
        <p class="ajustes-nota" style="margin:10px 16px 0;">${escaparHtml(glosasDicionarioCache.fonte)}</p>
        ${categoriasHtml}
      </div>
    </details>`;
}

function renderizarPaginaTissTabela() {
  if (!tissTabelaAtual) {
    tissTabelasResultadoAreaEl.innerHTML = '';
    return;
  }

  const dicionarioHtml = tissTabelaAtual.numero === 38 ? renderizarDicionarioGlosasHtml() : '';

  if (tissTabelaLinhasFiltradas.length === 0) {
    tissTabelasResultadoAreaEl.innerHTML = dicionarioHtml + '<div class="msg vazio">Nenhum item encontrado com esse filtro.</div>';
    return;
  }

  const totalPaginas = Math.ceil(tissTabelaLinhasFiltradas.length / tissTabelaPorPagina);
  tissTabelaPagina = Math.min(Math.max(tissTabelaPagina, 1), totalPaginas);
  const inicio = (tissTabelaPagina - 1) * tissTabelaPorPagina;
  const pagina = tissTabelaLinhasFiltradas.slice(inicio, inicio + tissTabelaPorPagina);

  const linhasHtml = pagina
    .map(([codigo, descricao]) => `<tr><td class="codigo">${escaparHtml(codigo)}</td><td>${escaparHtml(descricao)}</td></tr>`)
    .join('');

  tissTabelasResultadoAreaEl.innerHTML = `
    ${dicionarioHtml}
    <div class="tiss-tabela-bloco">
      <h3 class="tiss-tabela-titulo">Tabela ${tissTabelaAtual.numero} — ${escaparHtml(tissTabelaAtual.nome)}</h3>
      <div class="tiss-tabela-scroll">
        <table class="tiss-tabela-tabela">
          <thead><tr><th>Código</th><th>Descrição</th></tr></thead>
          <tbody>${linhasHtml}</tbody>
        </table>
      </div>
      <div class="tiss-tabela-paginacao">
        <button type="button" class="chip-btn" id="tiss-tabela-pag-anterior" ${tissTabelaPagina <= 1 ? 'disabled' : ''}>‹ Anterior</button>
        <span class="pagina-info">Página ${tissTabelaPagina} de ${totalPaginas} (${tissTabelaLinhasFiltradas.length} ${tissTabelaLinhasFiltradas.length === 1 ? 'item' : 'itens'})</span>
        <button type="button" class="chip-btn" id="tiss-tabela-pag-proxima" ${tissTabelaPagina >= totalPaginas ? 'disabled' : ''}>Próxima ›</button>
        <label class="pagina-por-pagina">
          Por página:
          <select id="tiss-tabela-select-por-pagina">
            ${[10, 20, 50].map((n) => `<option value="${n}" ${n === tissTabelaPorPagina ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>`;

  document.getElementById('tiss-tabela-pag-anterior').addEventListener('click', () => {
    tissTabelaPagina -= 1;
    renderizarPaginaTissTabela();
  });
  document.getElementById('tiss-tabela-pag-proxima').addEventListener('click', () => {
    tissTabelaPagina += 1;
    renderizarPaginaTissTabela();
  });
  document.getElementById('tiss-tabela-select-por-pagina').addEventListener('change', (e) => {
    tissTabelaPorPagina = Number(e.target.value);
    tissTabelaPagina = 1;
    renderizarPaginaTissTabela();
  });

  const glosaDicionarioEl = document.getElementById('glosa-dicionario-details');
  if (glosaDicionarioEl) {
    glosaDicionarioEl.addEventListener('toggle', () => {
      glosasDicionarioAberto = glosaDicionarioEl.open;
    });
  }
}

function aplicarFiltroTissTabela() {
  if (!tissTabelaAtual) return;
  const termo = tissTabelasFiltroEl.value.trim().toLowerCase();
  tissTabelaLinhasFiltradas = termo
    ? tissTabelaAtual.linhas.filter(
        ([codigo, descricao]) => codigo.toLowerCase().includes(termo) || descricao.toLowerCase().includes(termo)
      )
    : tissTabelaAtual.linhas;
  tissTabelaPagina = 1;
  renderizarPaginaTissTabela();
}

async function inicializarSelectTissTabelas() {
  if (!tissTabelasSelectEl) return;
  const tabelas = await carregarTissTabelasDominio();
  const opcoes = tabelas
    .slice()
    .sort((a, b) => a.numero - b.numero)
    .map((t) => `<option value="${t.numero}">${t.numero} — ${escaparHtml(t.nome)} (${t.linhas.length})</option>`)
    .join('');
  tissTabelasSelectEl.insertAdjacentHTML('beforeend', opcoes);
}

if (tissTabelasSelectEl) {
  inicializarSelectTissTabelas();

  tissTabelasSelectEl.addEventListener('change', async () => {
    const numero = Number(tissTabelasSelectEl.value);
    if (!numero) {
      tissTabelaAtual = null;
      tissTabelaLinhasFiltradas = [];
      tissTabelasFiltroCampoEl.classList.add('hidden');
      tissTabelasResultadoAreaEl.innerHTML = '';
      return;
    }
    const tabelas = await carregarTissTabelasDominio();
    tissTabelaAtual = tabelas.find((t) => t.numero === numero) || null;
    tissTabelasFiltroCampoEl.classList.remove('hidden');
    tissTabelasFiltroEl.value = '';
    if (numero === 38) await carregarGlosasDicionario();
    aplicarFiltroTissTabela();
  });

  tissTabelasFiltroEl.addEventListener('input', () => {
    clearTimeout(debounceTimerTissTabelas);
    debounceTimerTissTabelas = setTimeout(aplicarFiltroTissTabela, 250);
  });
}

// ---------- CID-10 ----------
const cid10BuscaEl = document.getElementById('cid10-busca');
const cid10ResultadoAreaEl = document.getElementById('cid10-resultado-area');
let debounceTimerCid10 = null;

function renderizarCardCid10(item) {
  const codigoFormatado = item.codigo.length === 4 ? `${item.codigo.slice(0, 3)}.${item.codigo.slice(3)}` : item.codigo;
  return `
    <div class="cid10-card">
      <div class="cid10-card-head"><span class="codigo">${escaparHtml(codigoFormatado)}</span></div>
      <div class="cid10-card-nome">${escaparHtml(item.nome)}</div>
      ${item.categoria_nome ? `<div class="cid10-card-categoria">${escaparHtml(item.categoria_nome)}</div>` : ''}
    </div>`;
}

function renderizarResultadoCid10(itens) {
  if (itens.length === 0) {
    cid10ResultadoAreaEl.innerHTML = '<div class="msg vazio">Nenhum código CID-10 encontrado.</div>';
    return;
  }
  cid10ResultadoAreaEl.innerHTML = `<div class="cards-grid">${itens.map(renderizarCardCid10).join('')}</div>`;
}

async function buscarCid10(termo) {
  try {
    const resp = await fetch(`/api/cid10/buscar?q=${encodeURIComponent(termo)}`);
    if (!resp.ok) throw new Error('Falha na requisição.');
    const itens = await resp.json();
    renderizarResultadoCid10(itens);
  } catch (err) {
    console.error(err);
    cid10ResultadoAreaEl.innerHTML = '<div class="msg erro">Erro ao buscar códigos CID-10.</div>';
  }
}

if (cid10BuscaEl) {
  cid10BuscaEl.addEventListener('input', () => {
    const termo = cid10BuscaEl.value.trim();
    clearTimeout(debounceTimerCid10);

    if (termo.length < 2) {
      cid10ResultadoAreaEl.innerHTML = '';
      return;
    }

    debounceTimerCid10 = setTimeout(() => buscarCid10(termo), 300);
  });
}

// ---------- Verificadores: compatibilidade entre procedimentos ----------
const compatCodigosEl = document.getElementById('compat-codigos');
const btnCompatVerificarEl = document.getElementById('btn-compat-verificar');
const compatResultadoAreaEl = document.getElementById('compat-resultado-area');

function renderizarParCompat(par) {
  const statusClasse = par.compativel ? 'compativel' : 'sem-registro';
  const statusTexto = par.compativel ? '✓ Compatibilidade registrada' : '— Sem registro de compatibilidade';
  const aviso = par.excecoesAplicaveis.length
    ? `<div class="compat-aviso">⚠ Existe uma exceção: a compatibilidade entre esses dois códigos é anulada se também constar o código ${par.excecoesAplicaveis.map(escaparHtml).join(', ')} na mesma conta.</div>`
    : '';
  return `
    <div class="compat-par">
      <div class="compat-codigos">
        <span class="codigo">${escaparHtml(par.codigoA)}</span> ${par.nomeA ? escaparHtml(par.nomeA) : '<em>código não encontrado no SIGTAP</em>'}
        <span class="nome">↔ <span class="codigo">${escaparHtml(par.codigoB)}</span> ${par.nomeB ? escaparHtml(par.nomeB) : '<em>código não encontrado no SIGTAP</em>'}</span>
      </div>
      <span class="compat-status ${statusClasse}">${statusTexto}</span>
      ${aviso}
    </div>`;
}

async function verificarCompatibilidade() {
  const codigos = compatCodigosEl.value.split(',').map((c) => c.trim()).filter(Boolean);
  if (codigos.length < 2) {
    compatResultadoAreaEl.innerHTML = '<div class="msg erro">Informe pelo menos 2 códigos, separados por vírgula.</div>';
    return;
  }
  compatResultadoAreaEl.innerHTML = '<div class="msg vazio">Verificando…</div>';
  try {
    const resp = await fetch(`/api/sigtap/compatibilidade?codigos=${encodeURIComponent(codigos.join(','))}`);
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Falha ao verificar.');

    const naoEncontradosHtml = dados.codigosNaoEncontrados.length
      ? `<div class="msg erro" style="margin-bottom:12px;">Código(s) não encontrado(s) no SIGTAP: ${dados.codigosNaoEncontrados.map(escaparHtml).join(', ')}</div>`
      : '';
    compatResultadoAreaEl.innerHTML = naoEncontradosHtml + dados.pares.map(renderizarParCompat).join('');
  } catch (err) {
    console.error(err);
    compatResultadoAreaEl.innerHTML = `<div class="msg erro">Erro ao verificar compatibilidade: ${escaparHtml(err.message)}</div>`;
  }
}

if (btnCompatVerificarEl) {
  btnCompatVerificarEl.addEventListener('click', verificarCompatibilidade);
  compatCodigosEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verificarCompatibilidade();
  });
}

// ---------- Verificadores: habilitação exigida ----------
const habilitacaoCodigoEl = document.getElementById('habilitacao-codigo');
const habilitacaoResultadoAreaEl = document.getElementById('habilitacao-resultado-area');
let debounceTimerHabilitacao = null;

function renderizarHabilitacao(item) {
  const grupo = item.grupo_codigo
    ? `<div class="detail">Faz parte do grupo de habilitação ${escaparHtml(item.grupo_nome || item.grupo_codigo)}${item.grupo_descricao ? ' — ' + escaparHtml(item.grupo_descricao) : ''}</div>`
    : '';
  return `
    <div class="habilitacao-card">
      <div class="nome"><span class="codigo" style="font-family:var(--mono); color:var(--teal-dark); margin-right:6px;">${escaparHtml(item.codigo)}</span>${escaparHtml(item.nome)}</div>
      ${grupo}
    </div>`;
}

function renderizarNomeProcedimentoHabilitacao(dados) {
  if (!dados.procedimentoNome) {
    return `<div class="msg vazio" style="margin-bottom:12px;">Código ${escaparHtml(dados.codigo)} não encontrado na tabela SIGTAP.</div>`;
  }
  return `<div class="detail" style="margin-bottom:12px;"><span class="codigo" style="font-family:var(--mono); color:var(--teal-dark); margin-right:6px;">${escaparHtml(dados.codigo)}</span>${escaparHtml(dados.procedimentoNome)}</div>`;
}

async function verificarHabilitacao(codigo) {
  habilitacaoResultadoAreaEl.innerHTML = '<div class="msg vazio">Consultando…</div>';
  try {
    const resp = await fetch(`/api/sigtap/habilitacao?codigo=${encodeURIComponent(codigo)}`);
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Falha ao consultar.');

    const nomeHtml = renderizarNomeProcedimentoHabilitacao(dados);
    if (dados.habilitacoes.length === 0) {
      habilitacaoResultadoAreaEl.innerHTML = dados.procedimentoNome
        ? nomeHtml + '<div class="msg vazio">Este procedimento não exige nenhuma habilitação específica do prestador.</div>'
        : nomeHtml;
      return;
    }
    habilitacaoResultadoAreaEl.innerHTML = nomeHtml + dados.habilitacoes.map(renderizarHabilitacao).join('');
  } catch (err) {
    console.error(err);
    habilitacaoResultadoAreaEl.innerHTML = `<div class="msg erro">Erro ao consultar habilitação: ${escaparHtml(err.message)}</div>`;
  }
}

if (habilitacaoCodigoEl) {
  habilitacaoCodigoEl.addEventListener('input', () => {
    const codigo = habilitacaoCodigoEl.value.trim();
    clearTimeout(debounceTimerHabilitacao);
    if (codigo.length < 4) {
      habilitacaoResultadoAreaEl.innerHTML = '';
      return;
    }
    debounceTimerHabilitacao = setTimeout(() => verificarHabilitacao(codigo), 300);
  });
}

// ---------- Verificadores: conversor CBHPM ↔ TUSS ↔ SIGTAP ----------
const conversorCodigoEl = document.getElementById('conversor-codigo');
const conversorResultadoAreaEl = document.getElementById('conversor-resultado-area');
let debounceTimerConversor = null;

function renderizarCardConversor(codigo, nome, extra) {
  const grau = extra && extra.grau_equivalencia
    ? `<span class="grau-badge">Grau ${escaparHtml(String(extra.grau_equivalencia))}</span>`
    : '';
  return `
    <div class="conversor-card">
      <div class="info"><span class="codigo">${escaparHtml(codigo)}</span><span class="nome">${escaparHtml(nome || '—')}</span></div>
      ${grau}
    </div>`;
}

async function converterCodigo(codigo) {
  conversorResultadoAreaEl.innerHTML = '<div class="msg vazio">Convertendo…</div>';
  try {
    const resp = await fetch(`/api/conversor?codigo=${encodeURIComponent(codigo)}`);
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || 'Falha ao converter.');

    if (!dados.encontrado) {
      conversorResultadoAreaEl.innerHTML = '<div class="msg vazio">Código não encontrado em nenhuma das 3 tabelas.</div>';
      return;
    }

    const cbhpmHtml = dados.cbhpmTuss.length
      ? `<div class="conversor-secao-titulo">CBHPM / TUSS</div>${dados.cbhpmTuss
          .map((r) => renderizarCardConversor(`CBHPM ${r.codigo_cbhpm} = TUSS ${r.codigo_tuss}`, r.procedimento))
          .join('')}`
      : '';

    const sigtapHtml = dados.tussSigtap.length
      ? `<div class="conversor-secao-titulo">SIGTAP equivalente</div>${dados.tussSigtap
          .map((r) => renderizarCardConversor(r.codigo_sigtap, r.procedimento_sigtap, r))
          .join('')}`
      : '';

    const diretoHtml = dados.sigtapDireto
      ? `<div class="conversor-secao-titulo">Encontrado direto no SIGTAP</div>${renderizarCardConversor(dados.sigtapDireto.codigo, dados.sigtapDireto.nome)}`
      : '';

    conversorResultadoAreaEl.innerHTML = cbhpmHtml + sigtapHtml + diretoHtml;
  } catch (err) {
    console.error(err);
    conversorResultadoAreaEl.innerHTML = `<div class="msg erro">Erro ao converter: ${escaparHtml(err.message)}</div>`;
  }
}

if (conversorCodigoEl) {
  conversorCodigoEl.addEventListener('input', () => {
    const codigo = conversorCodigoEl.value.trim();
    clearTimeout(debounceTimerConversor);
    if (codigo.length < 4) {
      conversorResultadoAreaEl.innerHTML = '';
      return;
    }
    debounceTimerConversor = setTimeout(() => converterCodigo(codigo), 300);
  });
}

// ---------- Validador BPA (SIA/SUS) ----------
// Layout oficial: "Layout da interface texto do BPA e do SIA - layout
// INTERNO" (DATASUS/SIA) — cabeçalho (132 bytes incluindo CR/LF), BPA-C tipo
// "02" (50 bytes) e BPA-I tipo "03" (353 bytes, incluindo os campos
// prd_cpf_pcnte/prd_situacao_rua/prd_sem_cpf adicionados nas competências
// 2024/2026). Posições abaixo são 1-indexadas conforme o layout oficial.
// Roda inteiramente no navegador — o arquivo nunca é enviado a nenhum
// servidor; só os códigos de procedimento e CID-10, em lote (sem nenhum
// dado de paciente), para conferir contra a SIGTAP e o CID-10 já carregados
// no nosso banco.

const BPA_CAMPOS_CABECALHO = [
  ['indicador', 1, 2],
  ['marcador', 3, 7],
  ['competencia', 8, 13],
  ['numLinhas', 14, 19],
  ['numFolhas', 20, 25],
  ['controle', 26, 29],
  ['orgaoResp', 30, 59],
  ['sigla', 60, 65],
  ['cgcCpf', 66, 79],
  ['orgaoDestino', 80, 119],
  ['destinoTipo', 120, 120],
  ['versaoSistema', 121, 130],
];
const BPA_TAMANHO_CABECALHO = 130; // sem CR/LF (132 com)

const BPA_CAMPOS_C = [
  ['indicador', 1, 2],
  ['cnes', 3, 9],
  ['competencia', 10, 15],
  ['cbo', 16, 21],
  ['folha', 22, 24],
  ['seq', 25, 26],
  ['procedimento', 27, 36],
  ['idade', 37, 39],
  ['quantidade', 40, 45],
  ['origem', 46, 48],
];

const BPA_CAMPOS_I = [
  ['indicador', 1, 2],
  ['cnes', 3, 9],
  ['competencia', 10, 15],
  ['cnsProfissional', 16, 30],
  ['cbo', 31, 36],
  ['dataAtendimento', 37, 44],
  ['folha', 45, 47],
  ['seq', 48, 49],
  ['procedimento', 50, 59],
  ['cnsPaciente', 60, 74],
  ['sexo', 75, 75],
  ['ibge', 76, 81],
  ['cid', 82, 85],
  ['idade', 86, 88],
  ['quantidade', 89, 94],
  ['caraterAtendimento', 95, 96],
  ['numAutorizacao', 97, 109],
  ['origem', 110, 112],
  ['nomePaciente', 113, 142],
  ['dataNascimento', 143, 150],
  ['raca', 151, 152],
  ['etnia', 153, 156],
  ['nacionalidade', 157, 159],
  ['servico', 160, 162],
  ['classificacao', 163, 165],
  ['equipeSeq', 166, 173],
  ['equipeArea', 174, 177],
  ['cnpj', 178, 191],
  ['cepPaciente', 192, 199],
  ['logradouroPaciente', 200, 202],
  ['enderecoPaciente', 203, 232],
  ['complementoPaciente', 233, 242],
  ['numeroPaciente', 243, 247],
  ['bairroPaciente', 248, 277],
  ['telefonePaciente', 278, 288],
  ['emailPaciente', 289, 328],
  ['ine', 329, 338],
  ['cpfPaciente', 339, 349],
  ['situacaoRua', 350, 350],
  ['semCpf', 351, 351],
];

const BPA_ORIGENS_VALIDAS = new Set(['BPA', 'PNI', 'SIE', 'SIB', 'MIN', 'PAC', 'SCL', 'EXT']);
const BPA_RACAS_VALIDAS = new Set(['01', '02', '03', '04', '05', '99']);

function bpaExtrairCampos(linha, definicao) {
  const campos = {};
  for (const [nome, ini, fim] of definicao) campos[nome] = (linha.slice(ini - 1, fim) || '').trim();
  return campos;
}

function bpaSoNumeros(s) {
  return /^\d+$/.test(s);
}

function bpaValidarCompetencia(s) {
  if (!bpaSoNumeros(s) || s.length !== 6) return false;
  const ano = Number(s.slice(0, 4));
  const mes = Number(s.slice(4, 6));
  return mes >= 1 && mes <= 12 && ano >= 1994 && ano <= 2100;
}

function bpaValidarDataAAAAMMDD(s) {
  if (!bpaSoNumeros(s) || s.length !== 8) return null;
  const ano = Number(s.slice(0, 4));
  const mes = Number(s.slice(4, 6));
  const dia = Number(s.slice(6, 8));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d;
}

// Algoritmo oficial de validação do CNS (Cartão Nacional de Saúde, 15
// dígitos): "definitivo" (inicia com 1 ou 2, derivado do PIS/PASEP) usa peso
// 15..5 sobre os 11 primeiros dígitos com regra de exceção para DV=10;
// "provisório" (inicia com 7, 8 ou 9) usa peso 15..1 sobre os 15 dígitos e
// exige soma múltipla de 11. CNS iniciados em 3/4/5/6 não têm algoritmo de
// checagem documentado publicamente — só confere o formato (15 dígitos).
function validarCns(cns) {
  if (!bpaSoNumeros(cns) || cns.length !== 15) return { valido: false, motivo: 'formato' };
  const d = cns.split('').map(Number);
  const primeiro = cns[0];
  if (primeiro === '1' || primeiro === '2') {
    const pesos = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5];
    let soma = pesos.reduce((s, p, i) => s + d[i] * p, 0);
    let resto = soma % 11;
    let dv = 11 - resto;
    let sufixo = '000';
    if (dv === 11) dv = 0;
    if (dv === 10) {
      soma += 2;
      resto = soma % 11;
      dv = 11 - resto;
      if (dv === 11) dv = 0;
      sufixo = '001';
    }
    const calculado = cns.slice(0, 11) + sufixo + dv;
    return calculado === cns ? { valido: true } : { valido: false, motivo: 'digito' };
  }
  if (primeiro === '7' || primeiro === '8' || primeiro === '9') {
    const pesos = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const soma = pesos.reduce((s, p, i) => s + d[i] * p, 0);
    return soma % 11 === 0 ? { valido: true } : { valido: false, motivo: 'digito' };
  }
  return { valido: true, naoVerificado: true };
}

// Algoritmos padrão (mod 11) de dígito verificador de CPF (11 dígitos) e
// CNPJ (14 dígitos numéricos — o layout define o campo como NUM, então não
// cobre o CNPJ alfanumérico previsto para 2026).
function validarCpf(cpf) {
  if (!bpaSoNumeros(cpf) || cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const d = cpf.split('').map(Number);
  const dvDe = (digitos, pesoInicial) => {
    const soma = digitos.reduce((s, v, i) => s + v * (pesoInicial - i), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const dv1 = dvDe(d.slice(0, 9), 10);
  const dv2 = dvDe([...d.slice(0, 9), dv1], 11);
  return d[9] === dv1 && d[10] === dv2;
}

function validarCnpj(cnpj) {
  if (!bpaSoNumeros(cnpj) || cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const d = cnpj.split('').map(Number);
  const dvDe = (digitos, pesos) => {
    const soma = digitos.reduce((s, v, i) => s + v * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const dv1 = dvDe(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = dvDe([...d.slice(0, 12), dv1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d[12] === dv1 && d[13] === dv2;
}

function validarCgcCpf(valor) {
  if (!bpaSoNumeros(valor) || valor.length !== 14) return { valido: false, tipo: null };
  if (validarCnpj(valor)) return { valido: true, tipo: 'CNPJ' };
  if (valor.slice(0, 3) === '000' && validarCpf(valor.slice(3))) return { valido: true, tipo: 'CPF' };
  return { valido: false, tipo: null };
}

function bpaDividirLinhas(texto) {
  return texto.split(/\r\n|\n|\r/).filter((l) => l.length > 0);
}

function analisarArquivoBpa(texto, nomeArquivo) {
  const linhasTexto = bpaDividirLinhas(texto);
  if (linhasTexto.length === 0) return { nomeArquivo, semConteudo: true };

  const primeira = linhasTexto[0];
  const temCabecalho = primeira.slice(0, 2) === '01' && primeira.slice(2, 7) === '#BPA#';
  const linhasProducaoTexto = temCabecalho ? linhasTexto.slice(1) : linhasTexto;

  const linhas = [];
  const tiposDesconhecidos = [];
  linhasProducaoTexto.forEach((linha, i) => {
    const ordinal = i + 1;
    const tipo = linha.slice(0, 2);
    if (tipo === '02') linhas.push({ ordinal, tipo: 'C', campos: bpaExtrairCampos(linha, BPA_CAMPOS_C) });
    else if (tipo === '03') linhas.push({ ordinal, tipo: 'I', campos: bpaExtrairCampos(linha, BPA_CAMPOS_I) });
    else tiposDesconhecidos.push({ ordinal, tipo });
  });

  return {
    nomeArquivo,
    temCabecalho,
    cabecalho: temCabecalho ? bpaExtrairCampos(primeira, BPA_CAMPOS_CABECALHO) : null,
    cabecalhoRaw: temCabecalho ? primeira : null,
    linhas,
    tiposDesconhecidos,
  };
}

function validarCabecalhoBpa(analise) {
  const checks = [];
  if (!analise.temCabecalho) {
    checks.push({ severidade: 'erro', texto: 'Arquivo não começa com uma linha de cabeçalho válida (esperado indicador "01" + marcador "#BPA#" nas posições 1-7).' });
    return checks;
  }
  const c = analise.cabecalho;
  const raw = analise.cabecalhoRaw;

  if (raw.length < BPA_TAMANHO_CABECALHO) {
    checks.push({ severidade: 'aviso', texto: `Linha de cabeçalho mais curta que o esperado (${BPA_TAMANHO_CABECALHO} caracteres, encontrado ${raw.length}).` });
  }
  checks.push(c.marcador === '#BPA#'
    ? { severidade: 'ok', texto: 'Marcador de início "#BPA#" presente' }
    : { severidade: 'erro', texto: `Marcador de início deveria ser "#BPA#", encontrado "${c.marcador}"` });
  checks.push(bpaValidarCompetencia(c.competencia)
    ? { severidade: 'ok', texto: `Competência do cabeçalho: ${c.competencia.slice(4, 6)}/${c.competencia.slice(0, 4)}` }
    : { severidade: 'erro', texto: `Competência (AAAAMM) inválida: "${c.competencia}"` });

  const numLinhasDeclarado = Number(c.numLinhas);
  const numLinhasReal = analise.linhas.length;
  checks.push(numLinhasDeclarado === numLinhasReal
    ? { severidade: 'ok', texto: `Número de linhas gravadas confere: ${numLinhasReal}` }
    : { severidade: 'erro', texto: `Cabeçalho declara ${c.numLinhas} linha(s), mas o arquivo tem ${numLinhasReal} linha(s) de produção (02/03).` });

  const folhasReais = new Set(analise.linhas.map((l) => l.campos.folha));
  const numFolhasDeclarado = Number(c.numFolhas);
  checks.push(numFolhasDeclarado === folhasReais.size
    ? { severidade: 'ok', texto: `Número de folhas gravadas confere: ${folhasReais.size}` }
    : { severidade: 'aviso', texto: `Cabeçalho declara ${c.numFolhas} folha(s), mas foram encontradas ${folhasReais.size} folha(s) distinta(s) nas linhas de produção.` });

  // Campo de controle (documentado no rodapé do layout oficial): soma do
  // código de procedimento + quantidade de TODAS as linhas de produção,
  // resto da divisão por 1111, mais 1111 — domínio [1111..2221].
  let somaControle = 0;
  for (const l of analise.linhas) somaControle += (Number(l.campos.procedimento) || 0) + (Number(l.campos.quantidade) || 0);
  const controleCalculado = 1111 + (somaControle % 1111);
  checks.push(controleCalculado === Number(c.controle)
    ? { severidade: 'ok', texto: `Campo de controle confere: ${c.controle}` }
    : { severidade: 'aviso', texto: `Campo de controle declarado ("${c.controle}") não bate com o recalculado (${controleCalculado}) — pode indicar arquivo alterado ou truncado.` });

  const cgcCpf = validarCgcCpf(c.cgcCpf);
  checks.push(cgcCpf.valido
    ? { severidade: 'ok', texto: `${cgcCpf.tipo} do órgão responsável com dígito verificador válido` }
    : { severidade: 'aviso', texto: `CGC/CPF do órgão responsável ("${c.cgcCpf}") não bate com um CPF ou CNPJ válido.` });

  if (c.destinoTipo && !['E', 'M'].includes(c.destinoTipo)) {
    checks.push({ severidade: 'aviso', texto: `Indicador de órgão destino deveria ser "E" ou "M", encontrado "${c.destinoTipo}"` });
  }

  return checks;
}

// Cada "folha" do BPA comporta no máximo 20 linhas, sequenciadas 01..20 —
// checa duplicidade, excesso e continuidade dentro de cada folha.
function bpaChecarContinuidade(linhas) {
  const problemas = [];
  const porFolha = new Map();
  for (const l of linhas) {
    if (!porFolha.has(l.campos.folha)) porFolha.set(l.campos.folha, []);
    porFolha.get(l.campos.folha).push(l);
  }
  for (const [folha, ls] of porFolha) {
    if (ls.length > 20) problemas.push({ severidade: 'erro', texto: `Folha ${folha}: ${ls.length} linha(s) — o máximo permitido é 20 por folha.` });
    const vistos = new Set();
    for (const l of ls) {
      const s = Number(l.campos.seq);
      if (vistos.has(s)) problemas.push({ severidade: 'erro', texto: `Folha ${folha}: sequência ${l.campos.seq} repetida.` });
      vistos.add(s);
    }
    const ordenados = [...vistos].sort((a, b) => a - b);
    if (ordenados.some((s, i) => s !== i + 1)) {
      problemas.push({ severidade: 'aviso', texto: `Folha ${folha}: sequência não é contínua a partir de 01 (encontrado: ${ordenados.join(', ')}).` });
    }
  }
  return problemas;
}

function validarLinhaBpaC(l, ctx) {
  const erros = [];
  const avisos = [];
  const c = l.campos;

  if (!bpaSoNumeros(c.cnes) || c.cnes.length !== 7) erros.push(`CNES fora do formato (7 dígitos numéricos): "${c.cnes}"`);
  if (!bpaValidarCompetencia(c.competencia)) erros.push(`Competência inválida: "${c.competencia}"`);
  if (!/^\d{3}$/.test(c.folha) || Number(c.folha) < 1) erros.push(`Folha fora do domínio [001..999]: "${c.folha}"`);
  if (!/^\d{2}$/.test(c.seq) || Number(c.seq) < 1 || Number(c.seq) > 20) erros.push(`Sequência fora do domínio [01..20]: "${c.seq}"`);
  if (!/^\d{10}$/.test(c.procedimento)) erros.push(`Código de procedimento fora do formato (10 dígitos): "${c.procedimento}"`);
  if (!/^\d{3}$/.test(c.idade) || Number(c.idade) > 130) avisos.push(`Idade fora da faixa 0-130: "${c.idade}"`);
  if (!/^\d{6}$/.test(c.quantidade) || Number(c.quantidade) <= 0) erros.push(`Quantidade deveria ser um número maior que zero: "${c.quantidade}"`);
  if (c.origem && !BPA_ORIGENS_VALIDAS.has(c.origem)) avisos.push(`Origem "${c.origem}" fora do domínio conhecido (BPA/PNI/SIE/SIB/MIN/PAC/SCL/EXT).`);

  if (/^\d{10}$/.test(c.procedimento) && ctx.sigtapPorCodigo && !ctx.sigtapPorCodigo.has(c.procedimento)) {
    avisos.push(`Código de procedimento "${c.procedimento}" não encontrado na SIGTAP carregada.`);
  }

  return { erros, avisos };
}

function validarLinhaBpaI(l, ctx) {
  const erros = [];
  const avisos = [];
  const c = l.campos;

  if (!bpaSoNumeros(c.cnes) || c.cnes.length !== 7) erros.push(`CNES fora do formato (7 dígitos numéricos): "${c.cnes}"`);
  if (!bpaValidarCompetencia(c.competencia)) erros.push(`Competência inválida: "${c.competencia}"`);

  const cnsProf = validarCns(c.cnsProfissional);
  if (!cnsProf.valido) erros.push(`CNS do profissional ${cnsProf.motivo === 'formato' ? 'fora do formato (15 dígitos)' : 'com dígito verificador inválido'}: "${c.cnsProfissional}"`);
  else if (cnsProf.naoVerificado) avisos.push(`CNS do profissional "${c.cnsProfissional}" começa com "${c.cnsProfissional[0]}" — dígito verificador não checado para esse prefixo (documentação pública só cobre 1/2 e 7/8/9).`);

  const dataAtend = bpaValidarDataAAAAMMDD(c.dataAtendimento);
  if (!dataAtend) erros.push(`Data de atendimento inválida: "${c.dataAtendimento}"`);

  if (!/^\d{3}$/.test(c.folha) || Number(c.folha) < 1) erros.push(`Folha fora do domínio [001..999]: "${c.folha}"`);
  if (!/^\d{2}$/.test(c.seq) || Number(c.seq) < 1 || Number(c.seq) > 20) erros.push(`Sequência fora do domínio [01..20]: "${c.seq}"`);
  if (!/^\d{10}$/.test(c.procedimento)) erros.push(`Código de procedimento fora do formato (10 dígitos): "${c.procedimento}"`);

  if (c.cnsPaciente) {
    const cnsPac = validarCns(c.cnsPaciente);
    if (!cnsPac.valido) erros.push(`CNS do paciente ${cnsPac.motivo === 'formato' ? 'fora do formato (15 dígitos)' : 'com dígito verificador inválido'}: "${c.cnsPaciente}"`);
    else if (cnsPac.naoVerificado) avisos.push(`CNS do paciente "${c.cnsPaciente}" começa com "${c.cnsPaciente[0]}" — dígito verificador não checado para esse prefixo.`);
  }

  if (!['M', 'F'].includes(c.sexo)) erros.push(`Sexo do paciente deveria ser "M" ou "F", encontrado "${c.sexo}"`);

  const cid = c.cid.toUpperCase();
  if (cid && !/^[A-Z]\d{2,3}$/.test(cid)) avisos.push(`CID-10 fora do formato esperado (ex: J45, E119): "${c.cid}"`);
  else if (cid && ctx.cidValidos && !ctx.cidValidos.has(cid)) avisos.push(`CID-10 "${cid}" não encontrado na base de CID-10 carregada.`);

  if (!/^\d{3}$/.test(c.idade) || Number(c.idade) > 130) avisos.push(`Idade fora da faixa 0-130: "${c.idade}"`);
  if (!/^\d{6}$/.test(c.quantidade) || Number(c.quantidade) <= 0) erros.push(`Quantidade deveria ser um número maior que zero: "${c.quantidade}"`);
  if (c.origem && !BPA_ORIGENS_VALIDAS.has(c.origem)) avisos.push(`Origem "${c.origem}" fora do domínio conhecido (BPA/PNI/SIE/SIB/MIN/PAC/SCL/EXT).`);

  const dataNasc = bpaValidarDataAAAAMMDD(c.dataNascimento);
  if (c.dataNascimento && !dataNasc) erros.push(`Data de nascimento inválida: "${c.dataNascimento}"`);
  if (dataNasc && dataAtend) {
    if (dataNasc > dataAtend) {
      erros.push('Data de nascimento é posterior à data de atendimento.');
    } else {
      let idadeCalculada = dataAtend.getUTCFullYear() - dataNasc.getUTCFullYear();
      const antesAniversario = dataAtend.getUTCMonth() < dataNasc.getUTCMonth()
        || (dataAtend.getUTCMonth() === dataNasc.getUTCMonth() && dataAtend.getUTCDate() < dataNasc.getUTCDate());
      if (antesAniversario) idadeCalculada -= 1;
      const idadeInformada = Number(c.idade);
      if (!Number.isNaN(idadeInformada) && Math.abs(idadeCalculada - idadeInformada) > 1) {
        avisos.push(`Idade informada (${idadeInformada}) não bate com a calculada por nascimento × atendimento (${idadeCalculada}).`);
      }
    }
  }

  if (c.raca && !BPA_RACAS_VALIDAS.has(c.raca)) avisos.push(`Raça/cor "${c.raca}" fora do domínio [01,02,03,04,05,99].`);

  if (c.cpfPaciente && !validarCpf(c.cpfPaciente)) avisos.push(`CPF do paciente com dígito verificador inválido: "${c.cpfPaciente}"`);
  if (c.cpfPaciente && c.cnsPaciente) avisos.push('CNS e CPF do paciente preenchidos ao mesmo tempo — o layout pede apenas um dos dois documentos.');
  if (c.situacaoRua && !['N', 'S'].includes(c.situacaoRua)) avisos.push(`Situação de rua deveria ser "N" ou "S", encontrado "${c.situacaoRua}"`);
  if (c.semCpf && !['N', 'S'].includes(c.semCpf)) avisos.push(`Pessoa sem CPF/registro civil deveria ser "N" ou "S", encontrado "${c.semCpf}"`);

  if (/^\d{10}$/.test(c.procedimento) && ctx.sigtapPorCodigo) {
    const proc = ctx.sigtapPorCodigo.get(c.procedimento);
    if (!proc) avisos.push(`Código de procedimento "${c.procedimento}" não encontrado na SIGTAP carregada.`);
    else if ((proc.sexo === 'M' || proc.sexo === 'F') && ['M', 'F'].includes(c.sexo) && proc.sexo !== c.sexo) {
      erros.push(`Procedimento "${c.procedimento}" é restrito a sexo ${proc.sexo === 'M' ? 'Masculino' : 'Feminino'} na SIGTAP, mas a linha informa sexo "${c.sexo}".`);
    }
  }

  return { erros, avisos };
}

async function bpaCrossCheckSigtapCid(linhas) {
  const codigosProc = [...new Set(linhas.map((l) => l.campos.procedimento).filter((c) => /^\d{10}$/.test(c)))];
  const codigosCid = [...new Set(linhas.filter((l) => l.tipo === 'I').map((l) => l.campos.cid.toUpperCase()).filter((c) => /^[A-Z]\d{2,3}$/.test(c)))];

  const postLote = (url, codigos) => codigos.length
    ? fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigos }) }).then((r) => r.json()).catch(() => [])
    : Promise.resolve([]);

  const [sigtapResp, cidResp] = await Promise.all([
    postLote('/api/sigtap/lote', codigosProc),
    postLote('/api/cid10/lote', codigosCid),
  ]);

  return {
    sigtapPorCodigo: new Map((Array.isArray(sigtapResp) ? sigtapResp : []).map((r) => [r.codigo, r])),
    cidValidos: new Set((Array.isArray(cidResp) ? cidResp : []).map((r) => r.codigo)),
  };
}

function bpaValidarArquivo(analise, ctx) {
  if (analise.semConteudo) return { nomeArquivo: analise.nomeArquivo, vazio: true };

  const checksCabecalho = validarCabecalhoBpa(analise);
  const continuidade = bpaChecarContinuidade(analise.linhas);

  const linhasComProblema = [];
  for (const l of analise.linhas) {
    const { erros, avisos } = l.tipo === 'C' ? validarLinhaBpaC(l, ctx) : validarLinhaBpaI(l, ctx);
    if (erros.length || avisos.length) linhasComProblema.push({ ...l, erros, avisos });
  }

  const contarSeveridade = (lista, sev) => lista.filter((x) => x.severidade === sev).length;
  const totalErros = linhasComProblema.reduce((s, l) => s + l.erros.length, 0)
    + contarSeveridade(continuidade, 'erro') + contarSeveridade(checksCabecalho, 'erro') + analise.tiposDesconhecidos.length;
  const totalAvisos = linhasComProblema.reduce((s, l) => s + l.avisos.length, 0)
    + contarSeveridade(continuidade, 'aviso') + contarSeveridade(checksCabecalho, 'aviso');

  return {
    nomeArquivo: analise.nomeArquivo,
    checksCabecalho,
    continuidade,
    linhasComProblema,
    tiposDesconhecidos: analise.tiposDesconhecidos,
    totalLinhas: analise.linhas.length,
    totalC: analise.linhas.filter((l) => l.tipo === 'C').length,
    totalI: analise.linhas.filter((l) => l.tipo === 'I').length,
    totalErros,
    totalAvisos,
  };
}

const BPA_LIMITE_EXIBICAO = 200;
let bpaUltimoResultado = [];
let bpaUltimoContexto = { analises: [], ctx: {} };

function bpaLinhaValidador(item) {
  const icone = item.severidade === 'erro' ? '✘' : item.severidade === 'aviso' ? '⚠' : '✔';
  const classe = item.severidade === 'erro' ? 'erro' : item.severidade === 'aviso' ? 'aviso' : 'ok';
  return `<div class="validador-linha ${classe}">${icone} ${escaparHtml(item.texto)}</div>`;
}

function renderizarResultadoBpa(resultados) {
  bpaUltimoResultado = resultados;
  const bpaResultadoAreaEl = document.getElementById('bpa-resultado-area');

  const html = resultados.map((r) => {
    if (r.vazio) return `<div class="msg vazio">${escaparHtml(r.nomeArquivo)}: arquivo vazio.</div>`;

    const statusHtml = r.totalErros > 0
      ? '<span class="sigtap-badge sigtap-badge-erro">Com erros</span>'
      : r.totalAvisos > 0
        ? '<span class="sigtap-badge sigtap-badge-3">Com avisos</span>'
        : '<span class="sigtap-badge">OK</span>';

    const continuidadeHtml = r.continuidade.length
      ? r.continuidade.map(bpaLinhaValidador).join('')
      : bpaLinhaValidador({ severidade: 'ok', texto: 'Numeração de folha/sequência consistente' });

    const tiposDesconhecidosHtml = r.tiposDesconhecidos.length
      ? bpaLinhaValidador({
          severidade: 'erro',
          texto: `${r.tiposDesconhecidos.length} linha(s) com tipo de registro desconhecido (esperado "02" ou "03"): linha(s) ${r.tiposDesconhecidos
            .slice(0, 10)
            .map((t) => t.ordinal)
            .join(', ')}${r.tiposDesconhecidos.length > 10 ? '…' : ''}`,
        })
      : '';

    const linhasExibidas = r.linhasComProblema.slice(0, BPA_LIMITE_EXIBICAO);
    const linhasHtml = linhasExibidas
      .map(
        (l) => `
      <div class="bpa-linha-card">
        <div class="bpa-linha-cab">
          <span>BPA-${l.tipo}</span><span>Folha ${escaparHtml(l.campos.folha)} · Seq ${escaparHtml(l.campos.seq)}</span>
          <span>Proc. ${escaparHtml(l.campos.procedimento)}</span><span>linha ${l.ordinal}</span>
        </div>
        ${l.erros.map((e) => bpaLinhaValidador({ severidade: 'erro', texto: e })).join('')}
        ${l.avisos.map((a) => bpaLinhaValidador({ severidade: 'aviso', texto: a })).join('')}
      </div>`
      )
      .join('');

    const notaLimite = r.linhasComProblema.length > BPA_LIMITE_EXIBICAO
      ? `<p class="ajustes-nota">Mostrando as primeiras ${BPA_LIMITE_EXIBICAO} linhas com problema, de ${r.linhasComProblema.length} no total. Use "Exportar CSV" para ver todas.</p>`
      : '';

    return `
      <div class="grupo grupo-principal" style="margin-bottom:16px;">
        <div class="grupo-corpo" style="padding-top:14px;">
          <div class="mp-header" style="margin:0 16px 10px;">
            <h3 style="margin:0;">${escaparHtml(r.nomeArquivo)}</h3>
            ${statusHtml}
          </div>
          <div style="margin:0 16px 10px; display:flex; gap:16px; flex-wrap:wrap; font-size:0.85rem; color:var(--ink-soft);">
            <span>${r.totalLinhas} linha(s) de produção</span><span>${r.totalC} BPA-C</span><span>${r.totalI} BPA-I</span>
            <span>${r.totalErros} erro(s)</span><span>${r.totalAvisos} aviso(s)</span>
          </div>
          <div style="margin:0 16px;">
            <div class="ajustes-nota" style="margin-bottom:4px;"><strong>Cabeçalho</strong></div>
            ${r.checksCabecalho.map(bpaLinhaValidador).join('')}
            <div class="ajustes-nota" style="margin:10px 0 4px;"><strong>Numeração de folha/sequência</strong></div>
            ${continuidadeHtml}
            ${tiposDesconhecidosHtml}
          </div>
          ${
            linhasHtml
              ? `<div style="margin:14px 16px 0;"><div class="ajustes-nota" style="margin-bottom:8px;"><strong>Linhas com problema (${r.linhasComProblema.length})</strong></div>${linhasHtml}${notaLimite}</div>`
              : '<div class="msg vazio" style="margin:14px 16px 0;">Nenhuma linha de produção com problema.</div>'
          }
          <div style="margin:14px 16px 0;">
            <button type="button" class="acao-btn btn-bpa-exportar" data-arquivo="${escaparHtml(r.nomeArquivo)}">⬇ Exportar CSV das linhas com problema</button>
            <button type="button" class="acao-btn btn-bpa-pdf" data-arquivo="${escaparHtml(r.nomeArquivo)}">🖨 Gerar PDF de conferência</button>
          </div>
        </div>
      </div>`;
  }).join('');

  bpaResultadoAreaEl.innerHTML = html;
}

function exportarBpaCsv(nomeArquivo) {
  const r = bpaUltimoResultado.find((x) => x.nomeArquivo === nomeArquivo);
  if (!r) return;
  const linhas = [['Arquivo', 'Tipo', 'Linha', 'Folha', 'Sequência', 'Procedimento', 'Severidade', 'Problema']];
  for (const l of r.linhasComProblema) {
    for (const e of l.erros) linhas.push([r.nomeArquivo, `BPA-${l.tipo}`, l.ordinal, l.campos.folha, l.campos.seq, l.campos.procedimento, 'erro', e]);
    for (const a of l.avisos) linhas.push([r.nomeArquivo, `BPA-${l.tipo}`, l.ordinal, l.campos.folha, l.campos.seq, l.campos.procedimento, 'aviso', a]);
  }
  baixarCsv(`bpa-problemas-${nomeArquivo.replace(/\.[^.]+$/, '')}.csv`, linhas);
}

async function processarArquivosBpa(files) {
  const bpaResultadoAreaEl = document.getElementById('bpa-resultado-area');
  bpaResultadoAreaEl.innerHTML = '<div class="msg vazio">Analisando…</div>';
  try {
    const analises = [];
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const texto = new TextDecoder('iso-8859-1').decode(new Uint8Array(buffer));
      analises.push(analisarArquivoBpa(texto, file.name));
    }
    const todasLinhas = analises.flatMap((a) => a.linhas || []);
    const ctx = await bpaCrossCheckSigtapCid(todasLinhas);
    bpaUltimoContexto = { analises, ctx };
    renderizarResultadoBpa(analises.map((analise) => bpaValidarArquivo(analise, ctx)));
  } catch (err) {
    console.error(err);
    bpaResultadoAreaEl.innerHTML = `<div class="msg erro">Erro ao analisar arquivo(s): ${escaparHtml(err.message)}</div>`;
  }
}

const bpaArquivoEl = document.getElementById('bpa-arquivo');
if (bpaArquivoEl) {
  bpaArquivoEl.addEventListener('change', () => {
    if (bpaArquivoEl.files.length > 0) processarArquivosBpa(Array.from(bpaArquivoEl.files));
  });
}
document.getElementById('bpa-resultado-area')?.addEventListener('click', (e) => {
  const btnCsv = e.target.closest('.btn-bpa-exportar');
  if (btnCsv) exportarBpaCsv(btnCsv.dataset.arquivo);
  const btnPdf = e.target.closest('.btn-bpa-pdf');
  if (btnPdf) gerarPdfValidacao(bpaLinhasRelatorio(btnPdf.dataset.arquivo));
});

// ---------- Validador AIH (SIHD/SUS) ----------
// Layout oficial: "Layout da interface texto do SISAIH01" (DATASUS/SIHD),
// registros de largura fixa de 1800 posições. Tipos de registro (IDENT_AIH):
// 01/03/05 = AIH principal/continuação/longa permanência (campos comuns +
// dados do paciente + até 9 ocorrências de Procedimentos Secundários/
// Especiais de 79 bytes cada, a partir da posição 664, + diagnósticos
// secundários 1-9 a partir de 1591); 04 = registro civil de nascimento (até
// 8 ocorrências de 164 bytes a partir de 106); 07 = dados de OPM (até 10
// ocorrências de 121 bytes a partir de 106). Posições confirmadas campo a
// campo contra arquivos reais de produção (nomes, datas, CNES, CEP etc.
// decodificados corretamente). Roda inteiramente no navegador — o arquivo
// nunca é enviado a nenhum servidor; só os códigos de procedimento e CID-10,
// em lote (sem nenhum dado de paciente), para conferir contra a SIGTAP e o
// CID-10 já carregados no nosso banco.

const AIH_CAMPOS_COMUM = [
  ['nuLote', 1, 8], ['qtLote', 9, 11], ['apresLote', 12, 17], ['seqLote', 18, 20],
  ['orgEmisAih', 21, 30], ['cnesHosp', 31, 37], ['munHosp', 38, 43], ['nuAih', 44, 56],
  ['identAih', 57, 58], ['especAih', 59, 60],
];

const AIH_CAMPOS_PRINCIPAL = [
  ...AIH_CAMPOS_COMUM,
  ['modIntern', 106, 107], ['seqAih5', 108, 110], ['aihProx', 111, 123], ['aihAnt', 124, 136],
  ['dtEmissao', 137, 144], ['dtIntern', 145, 152], ['dtSaida', 153, 160],
  ['procSolicitado', 161, 170], ['stMudaproc', 171, 171], ['procRealizado', 172, 181],
  ['carIntern', 182, 183], ['motSaida', 184, 185],
  ['identMedSol', 186, 186], ['docMedSol', 187, 201],
  ['identMedResp', 202, 202], ['docMedResp', 203, 217],
  ['identDirclinico', 218, 218], ['docDirclinico', 219, 233],
  ['identAutoriz', 234, 234], ['docAutoriz', 235, 249],
  ['diagPrin', 250, 253],
  ['nmPaciente', 269, 338], ['dtNascPac', 339, 346], ['sexoPac', 347, 347], ['racaCor', 348, 349],
  ['nmMaePac', 350, 419], ['nmRespPac', 420, 489], ['tpDocPac', 490, 490],
  ['etniaIndigena', 491, 494], ['codSolLib', 495, 499],
  ['nuCns', 502, 516], ['nacPac', 517, 519], ['tpLogradouro', 520, 522],
  ['logrPac', 523, 572], ['nuEndPac', 573, 579], ['complEndPac', 580, 594], ['bairroPac', 595, 624],
  ['codMunEndPac', 625, 630], ['ufPac', 631, 632], ['cepPac', 633, 640],
  ['nuProntuario', 641, 655], ['nuEnfermaria', 656, 659], ['nuLeito', 660, 663],
  ['grauInstru', 1441, 1441],
];

// Posições relativas (1-indexadas) dentro de cada ocorrência repetida.
const AIH_PROC_SEC_SUBCAMPOS = [
  ['inProf', 1, 1], ['identProf', 2, 16], ['cboProf', 17, 22], ['inEquipe', 23, 23],
  ['inServico', 24, 24], ['identServico', 25, 38], ['inExecutor', 39, 39],
  ['identExecutor', 40, 54], ['codProced', 55, 64], ['qtdProced', 65, 67],
  ['cmpt', 68, 73], ['servico', 74, 76], ['classificacao', 77, 79],
];
const AIH_PROC_SEC_BASE = 664;
const AIH_PROC_SEC_TAM = 79;
const AIH_PROC_SEC_QTD = 9;

const AIH_DIAGSEC_POSICOES = [
  [1591, 1594, 1595], [1596, 1599, 1600], [1601, 1604, 1605], [1606, 1609, 1610],
  [1611, 1614, 1615], [1616, 1619, 1620], [1621, 1624, 1625], [1626, 1629, 1630],
  [1631, 1634, 1635],
];

const AIH_OPM_SUBCAMPOS = [
  ['codOpm', 1, 10], ['linha', 11, 13], ['regAnvisa', 14, 33], ['serie', 34, 53],
  ['lote', 54, 73], ['notaFiscal', 74, 93], ['cnpjForn', 94, 107], ['cnpjFabric', 108, 121],
];
const AIH_OPM_BASE = 106;
const AIH_OPM_TAM = 121;
const AIH_OPM_QTD = 10;

const AIH_RC_SUBCAMPOS = [
  ['numeroDn', 1, 11], ['nomeRn', 12, 81], ['rsCart', 82, 101], ['livroRn', 102, 109],
  ['folhaRn', 110, 113], ['termoRn', 114, 121], ['dtEmisRn', 122, 129], ['linha', 130, 132],
  ['matricula', 133, 164],
];
const AIH_RC_BASE = 106;
const AIH_RC_TAM = 164;
const AIH_RC_QTD = 8;

const AIH_UFS_VALIDAS = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']);
const AIH_RACAS_VALIDAS = new Set(['01', '02', '03', '04', '05', '99']);
const AIH_CAR_INTERN_CONHECIDOS = new Set(['01', '02', '03', '04', '05', '06']);

// Regra 3 da Circular FEHOSP 626/2014 ("Quanto aos nomes das pessoas..."):
// proíbe nome com 1 caractere, 3 caracteres iguais consecutivos, ou
// expressões-sentinela usadas para "preencher" o campo sem informação real.
const AIH_NOMES_PROIBIDOS = ['NAO INFORMADO', 'NAO CADASTRADO', 'INEXISTENTE', 'OMITIDO', 'OMITIDA', 'A DECLARAR', 'NAO DECLARADO', 'NAO CONSTA', 'NAO PREENCHIDO'];
function aihValidarNomePessoa(nome, rotulo) {
  const problemas = [];
  const limpo = nome.trim();
  if (!limpo) return problemas;
  if (limpo.length === 1) problemas.push(`${rotulo} tem só 1 caractere: "${limpo}"`);
  if (/(.)\1\1/.test(limpo)) problemas.push(`${rotulo} tem 3 caracteres iguais consecutivos: "${limpo}"`);
  const semAcento = limpo.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (AIH_NOMES_PROIBIDOS.includes(semAcento)) problemas.push(`${rotulo} usa uma expressão-sentinela não aceita pelo layout: "${limpo}"`);
  return problemas;
}

// DOC_MED_* / IDENT_* (15 bytes): CPF fica nos 11 dígitos à direita
// (zero-preenchido à esquerda); CNS ocupa os 15 dígitos inteiros.
function aihValidarDocumento(campo15, ident) {
  if (ident === '1') {
    const cpf = campo15.slice(-11);
    return { tipo: 'CPF', valor: cpf, valido: validarCpf(cpf) };
  }
  if (ident === '2') {
    const r = validarCns(campo15);
    return { tipo: 'CNS', valor: campo15, valido: r.valido, naoVerificado: r.naoVerificado };
  }
  return null;
}

function aihExtrairCampos(linha, definicao) {
  const campos = {};
  for (const [nome, ini, fim] of definicao) campos[nome] = (linha.slice(ini - 1, fim) || '').trim();
  return campos;
}

function aihExtrairOcorrencias(linha, base, tamanho, qtd, subCampos) {
  const ocorrencias = [];
  for (let i = 0; i < qtd; i++) {
    const off = base + i * tamanho;
    const campos = {};
    for (const [nome, ini, fim] of subCampos) campos[nome] = (linha.slice(off + ini - 2, off + fim - 1) || '').trim();
    ocorrencias.push(campos);
  }
  return ocorrencias;
}

function aihExtrairDiagSec(linha) {
  return AIH_DIAGSEC_POSICOES.map(([ini, fim, classPos]) => ({
    cid: (linha.slice(ini - 1, fim) || '').trim().toUpperCase(),
    classe: (linha.slice(classPos - 1, classPos) || '').trim(),
  })).filter((d) => d.cid && d.cid !== '0000');
}

function aihDividirLinhas(texto) {
  return texto.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 1);
}

function analisarArquivoAih(texto, nomeArquivo) {
  const linhasTexto = aihDividirLinhas(texto);
  if (linhasTexto.length === 0) return { nomeArquivo, semConteudo: true };

  const registros = [];
  const tiposDesconhecidos = [];
  const tamanhoIrregular = [];
  linhasTexto.forEach((linha, i) => {
    const ordinal = i + 1;
    const tipo = linha.slice(56, 58);
    if (linha.length !== 1800) tamanhoIrregular.push({ ordinal, tamanho: linha.length });
    if (tipo === '01' || tipo === '03' || tipo === '05') {
      registros.push({
        ordinal,
        tipo,
        campos: aihExtrairCampos(linha, AIH_CAMPOS_PRINCIPAL),
        ocorrencias: aihExtrairOcorrencias(linha, AIH_PROC_SEC_BASE, AIH_PROC_SEC_TAM, AIH_PROC_SEC_QTD, AIH_PROC_SEC_SUBCAMPOS),
        diagSec: aihExtrairDiagSec(linha),
      });
    } else if (tipo === '04') {
      registros.push({ ordinal, tipo, campos: aihExtrairCampos(linha, AIH_CAMPOS_COMUM), ocorrencias: aihExtrairOcorrencias(linha, AIH_RC_BASE, AIH_RC_TAM, AIH_RC_QTD, AIH_RC_SUBCAMPOS) });
    } else if (tipo === '07') {
      registros.push({ ordinal, tipo, campos: aihExtrairCampos(linha, AIH_CAMPOS_COMUM), ocorrencias: aihExtrairOcorrencias(linha, AIH_OPM_BASE, AIH_OPM_TAM, AIH_OPM_QTD, AIH_OPM_SUBCAMPOS) });
    } else {
      tiposDesconhecidos.push({ ordinal, tipo });
    }
  });

  return { nomeArquivo, registros, tiposDesconhecidos, tamanhoIrregular };
}

// Cada linha grava de novo o cabeçalho do lote (NU_LOTE/QT_LOTE/APRES_LOTE) —
// não existe um registro de cabeçalho separado como no BPA. Por isso a
// consistência do lote é checada agregando as próprias linhas de AIH.
function aihChecarLotes(registros) {
  const problemas = [];
  const porLote = new Map();
  for (const r of registros) {
    if (!porLote.has(r.campos.nuLote)) porLote.set(r.campos.nuLote, []);
    porLote.get(r.campos.nuLote).push(r);
  }
  for (const [lote, rs] of porLote) {
    const apres = rs[0].campos.apresLote;
    if (!bpaValidarCompetencia(apres)) problemas.push({ severidade: 'erro', texto: `Lote ${lote}: apresentação (AAAAMM) inválida: "${apres}"` });

    const qtDeclarados = new Set(rs.map((r) => r.campos.qtLote));
    if (qtDeclarados.size > 1) problemas.push({ severidade: 'aviso', texto: `Lote ${lote}: quantidade de AIHs declarada varia entre linhas (${[...qtDeclarados].join(', ')}).` });

    const aihsDistintas = new Set(rs.map((r) => r.campos.nuAih));
    const qtDeclarado = Number(rs[0].campos.qtLote);
    if (qtDeclarado !== aihsDistintas.size) {
      problemas.push({ severidade: 'erro', texto: `Lote ${lote}: declara ${rs[0].campos.qtLote} AIH(s), mas foram encontradas ${aihsDistintas.size} AIH(s) distinta(s) nos registros.` });
    } else {
      problemas.push({ severidade: 'ok', texto: `Lote ${lote}: quantidade de AIHs confere (${aihsDistintas.size}).` });
    }

    const seqs = [...new Set(rs.map((r) => Number(r.campos.seqLote)))].sort((a, b) => a - b);
    if (seqs.some((s, i) => s !== i + 1)) problemas.push({ severidade: 'aviso', texto: `Lote ${lote}: sequência da AIH no lote não é contínua a partir de 1 (encontrado: ${seqs.join(', ')}).` });
  }
  return problemas;
}

function aihValidarComum(c, erros) {
  if (!/^\d{7}$/.test(c.cnesHosp)) erros.push(`CNES do hospital fora do formato (7 dígitos): "${c.cnesHosp}"`);
  if (!/^\d{6}$/.test(c.munHosp)) erros.push(`Município do hospital fora do formato (código IBGE de 6 dígitos): "${c.munHosp}"`);
  if (!/^\d{13}$/.test(c.nuAih)) erros.push(`Número da AIH fora do formato (13 dígitos): "${c.nuAih}"`);
}

function aihValidarRegistroPrincipal(reg, ctx) {
  const erros = [];
  const avisos = [];
  const c = reg.campos;
  aihValidarComum(c, erros);

  if (!['02', '03', '04'].includes(c.modIntern)) avisos.push(`Modalidade de internação fora do domínio [02-Hospitalar,03-Hospital Dia,04-Internação Domiciliar]: "${c.modIntern}"`);

  const dtEmissao = bpaValidarDataAAAAMMDD(c.dtEmissao);
  const dtIntern = bpaValidarDataAAAAMMDD(c.dtIntern);
  const dtSaida = bpaValidarDataAAAAMMDD(c.dtSaida);
  if (!dtEmissao) erros.push(`Data de emissão inválida: "${c.dtEmissao}"`);
  if (!dtIntern) erros.push(`Data de internação inválida: "${c.dtIntern}"`);
  if (!dtSaida) erros.push(`Data de saída inválida: "${c.dtSaida}"`);
  if (dtIntern && dtSaida && dtIntern > dtSaida) erros.push('Data de internação é posterior à data de saída.');
  if (dtEmissao && dtIntern && dtEmissao > dtIntern) avisos.push('Data de emissão é posterior à data de internação.');

  if (!/^\d{10}$/.test(c.procSolicitado)) erros.push(`Procedimento solicitado fora do formato (10 dígitos): "${c.procSolicitado}"`);
  if (!/^\d{10}$/.test(c.procRealizado)) erros.push(`Procedimento realizado fora do formato (10 dígitos): "${c.procRealizado}"`);
  if (!['1', '2'].includes(c.stMudaproc)) avisos.push(`Mudança de procedimento deveria ser "1" (Sim) ou "2" (Não), encontrado "${c.stMudaproc}"`);
  if (c.carIntern && !AIH_CAR_INTERN_CONHECIDOS.has(c.carIntern)) avisos.push(`Caráter de internação "${c.carIntern}" fora do domínio conhecido [01..06] (Portaria 719/2007).`);

  [['médico solicitante', c.identMedSol, c.docMedSol], ['médico responsável', c.identMedResp, c.docMedResp],
    ['diretor clínico', c.identDirclinico, c.docDirclinico], ['médico autorizador', c.identAutoriz, c.docAutoriz]].forEach(([rotulo, ident, doc]) => {
    if (!['1', '2'].includes(ident)) { avisos.push(`Identificador do documento do ${rotulo} deveria ser "1" (CPF) ou "2" (CNS), encontrado "${ident}"`); return; }
    const d = aihValidarDocumento(doc, ident);
    if (!d.valido) erros.push(`${d.tipo} do ${rotulo} com dígito verificador inválido: "${d.valor}"`);
    else if (d.naoVerificado) avisos.push(`CNS do ${rotulo} "${d.valor}" começa com "${d.valor[0]}" — dígito verificador não checado para esse prefixo.`);
  });

  const diagPrin = c.diagPrin.toUpperCase();
  if (!/^[A-Z]\d{2,3}$/.test(diagPrin)) erros.push(`Diagnóstico principal fora do formato CID-10: "${c.diagPrin}"`);
  else if (ctx.cidValidos && !ctx.cidValidos.has(diagPrin)) avisos.push(`Diagnóstico principal "${diagPrin}" não encontrado na base de CID-10 carregada.`);

  for (const d of reg.diagSec) {
    if (!/^[A-Z]\d{2,3}$/.test(d.cid)) avisos.push(`Diagnóstico secundário fora do formato CID-10: "${d.cid}"`);
    else if (ctx.cidValidos && !ctx.cidValidos.has(d.cid)) avisos.push(`Diagnóstico secundário "${d.cid}" não encontrado na base de CID-10 carregada.`);
    if (!['0', '1', '2'].includes(d.classe)) avisos.push(`Classificação do diagnóstico secundário "${d.cid}" fora do domínio [0,1,2]: "${d.classe}"`);
  }

  erros.push(...aihValidarNomePessoa(c.nmPaciente, 'Nome do paciente'));
  avisos.push(...aihValidarNomePessoa(c.nmMaePac, 'Nome da mãe do paciente'));
  avisos.push(...aihValidarNomePessoa(c.nmRespPac, 'Nome do responsável pelo paciente'));

  const dtNasc = bpaValidarDataAAAAMMDD(c.dtNascPac);
  if (!dtNasc) erros.push(`Data de nascimento do paciente inválida: "${c.dtNascPac}"`);
  else if (dtIntern && dtNasc > dtIntern) erros.push('Data de nascimento do paciente é posterior à data de internação.');

  if (!['M', 'F'].includes(c.sexoPac)) erros.push(`Sexo do paciente deveria ser "M" ou "F", encontrado "${c.sexoPac}"`);
  if (c.racaCor && !AIH_RACAS_VALIDAS.has(c.racaCor)) avisos.push(`Raça/cor do paciente fora do domínio [01,02,03,04,05,99]: "${c.racaCor}"`);
  if (c.racaCor === '05' && c.etniaIndigena === '0000') avisos.push('Raça/cor "05-Indígena" mas etnia indígena não informada.');
  if (c.racaCor && c.racaCor !== '05' && c.etniaIndigena !== '0000') avisos.push('Etnia indígena preenchida mas raça/cor não é "05-Indígena".');

  if (c.nuCns) {
    const cns = validarCns(c.nuCns);
    if (!cns.valido) erros.push(`CNS do paciente ${cns.motivo === 'formato' ? 'fora do formato (15 dígitos)' : 'com dígito verificador inválido'}: "${c.nuCns}"`);
    else if (cns.naoVerificado) avisos.push(`CNS do paciente "${c.nuCns}" começa com "${c.nuCns[0]}" — dígito verificador não checado para esse prefixo.`);
  }

  if (c.ufPac && !AIH_UFS_VALIDAS.has(c.ufPac)) erros.push(`UF do endereço do paciente inválida: "${c.ufPac}"`);
  if (c.cepPac && !/^\d{8}$/.test(c.cepPac)) avisos.push(`CEP do paciente fora do formato (8 dígitos): "${c.cepPac}"`);
  if (c.codMunEndPac && !/^\d{6}$/.test(c.codMunEndPac)) avisos.push(`Município do endereço do paciente fora do formato (código IBGE de 6 dígitos): "${c.codMunEndPac}"`);

  reg.ocorrencias.forEach((o, idx) => {
    if (!/^\d{10}$/.test(o.codProced) || o.codProced === '0000000000') return; // ocorrência não usada
    const n = idx + 1;
    if (!['0', '1', '2'].includes(o.inProf)) avisos.push(`Proc. secundário ${n}: indicador do documento do profissional fora do domínio [0,1,2]: "${o.inProf}"`);
    else if (o.inProf !== '0') {
      const d = aihValidarDocumento(o.identProf, o.inProf);
      if (d && !d.valido) avisos.push(`Proc. secundário ${n}: ${d.tipo} do profissional com dígito verificador inválido: "${d.valor}"`);
    }
    if (!['0', '1', '2', '3', '4', '5', '6'].includes(o.inEquipe)) avisos.push(`Proc. secundário ${n}: indicador de equipe fora do domínio [0..6]: "${o.inEquipe}"`);
    if (!['0', '3', '5'].includes(o.inServico)) avisos.push(`Proc. secundário ${n}: indicador do prestador de serviço fora do domínio [0-N/A,3-CNPJ,5-CNES]: "${o.inServico}"`);
    else if (o.inServico === '3' && !validarCnpj(o.identServico.slice(-14))) avisos.push(`Proc. secundário ${n}: CNPJ do prestador de serviço com dígito verificador inválido: "${o.identServico}"`);
    if (!['1', '2', '3', '5'].includes(o.inExecutor)) avisos.push(`Proc. secundário ${n}: indicador do documento do executor fora do domínio [1-CPF,2-CNS,3-CNPJ,5-CNES]: "${o.inExecutor}"`);
    else if (o.inExecutor === '1' && !validarCpf(o.identExecutor.slice(-11))) avisos.push(`Proc. secundário ${n}: CPF do executor com dígito verificador inválido: "${o.identExecutor}"`);
    else if (o.inExecutor === '2') {
      const r = validarCns(o.identExecutor);
      if (!r.valido) avisos.push(`Proc. secundário ${n}: CNS do executor com dígito verificador inválido: "${o.identExecutor}"`);
    } else if (o.inExecutor === '3' && !validarCnpj(o.identExecutor.slice(-14))) avisos.push(`Proc. secundário ${n}: CNPJ do executor com dígito verificador inválido: "${o.identExecutor}"`);

    if (Number(o.qtdProced) <= 0) avisos.push(`Proc. secundário ${n}: quantidade deveria ser maior que zero, encontrado "${o.qtdProced}"`);
    if (!bpaValidarCompetencia(o.cmpt)) avisos.push(`Proc. secundário ${n}: competência (AAAAMM) inválida: "${o.cmpt}"`);
    if (ctx.sigtapPorCodigo && !ctx.sigtapPorCodigo.get(o.codProced)) avisos.push(`Proc. secundário ${n}: código "${o.codProced}" não encontrado na SIGTAP carregada.`);
  });

  if (/^\d{10}$/.test(c.procSolicitado) && ctx.sigtapPorCodigo && !ctx.sigtapPorCodigo.get(c.procSolicitado)) avisos.push(`Procedimento solicitado "${c.procSolicitado}" não encontrado na SIGTAP carregada.`);
  if (/^\d{10}$/.test(c.procRealizado) && ctx.sigtapPorCodigo) {
    const proc = ctx.sigtapPorCodigo.get(c.procRealizado);
    if (!proc) avisos.push(`Procedimento realizado "${c.procRealizado}" não encontrado na SIGTAP carregada.`);
    else if ((proc.sexo === 'M' || proc.sexo === 'F') && ['M', 'F'].includes(c.sexoPac) && proc.sexo !== c.sexoPac) {
      erros.push(`Procedimento realizado "${c.procRealizado}" é restrito a sexo ${proc.sexo === 'M' ? 'Masculino' : 'Feminino'} na SIGTAP, mas o paciente é "${c.sexoPac}".`);
    }
  }

  return { erros, avisos };
}

function aihValidarRegistroOpm(reg) {
  const erros = [];
  const avisos = [];
  aihValidarComum(reg.campos, erros);
  reg.ocorrencias.forEach((o, idx) => {
    if (!o.codOpm || o.codOpm === '0000000000') return;
    const n = idx + 1;
    if (o.linha && Number(o.linha) > 0 && (Number(o.linha) < 1 || Number(o.linha) > 9)) avisos.push(`OPM ${n}: linha de referência ao proc. secundário fora do domínio [1..9]: "${o.linha}"`);
    if (o.cnpjForn && !/^0*$/.test(o.cnpjForn) && !validarCnpj(o.cnpjForn)) avisos.push(`OPM ${n}: CNPJ do fornecedor com dígito verificador inválido: "${o.cnpjForn}"`);
    if (o.cnpjFabric && !/^0*$/.test(o.cnpjFabric) && !validarCnpj(o.cnpjFabric)) avisos.push(`OPM ${n}: CNPJ do fabricante com dígito verificador inválido: "${o.cnpjFabric}"`);
  });
  return { erros, avisos };
}

function aihValidarRegistroCivil(reg) {
  const erros = [];
  const avisos = [];
  aihValidarComum(reg.campos, erros);
  reg.ocorrencias.forEach((o, idx) => {
    if (!o.nomeRn.trim()) return;
    const n = idx + 1;
    avisos.push(...aihValidarNomePessoa(o.nomeRn, `Nome do recém-nato (registro ${n})`));
    if (o.dtEmisRn && !bpaValidarDataAAAAMMDD(o.dtEmisRn)) avisos.push(`Registro civil ${n}: data de emissão inválida: "${o.dtEmisRn}"`);
  });
  return { erros, avisos };
}

async function aihCrossCheckSigtapCid(registros) {
  const codigosProc = new Set();
  const codigosCid = new Set();
  for (const r of registros) {
    if (r.tipo !== '01' && r.tipo !== '03' && r.tipo !== '05') continue;
    if (/^\d{10}$/.test(r.campos.procSolicitado)) codigosProc.add(r.campos.procSolicitado);
    if (/^\d{10}$/.test(r.campos.procRealizado)) codigosProc.add(r.campos.procRealizado);
    const diagPrin = r.campos.diagPrin.toUpperCase();
    if (/^[A-Z]\d{2,3}$/.test(diagPrin)) codigosCid.add(diagPrin);
    for (const d of r.diagSec) if (/^[A-Z]\d{2,3}$/.test(d.cid)) codigosCid.add(d.cid);
    for (const o of r.ocorrencias) if (/^\d{10}$/.test(o.codProced) && o.codProced !== '0000000000') codigosProc.add(o.codProced);
  }

  const postLote = (url, codigos) => codigos.length
    ? fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigos }) }).then((r) => r.json()).catch(() => [])
    : Promise.resolve([]);

  const [sigtapResp, cidResp] = await Promise.all([
    postLote('/api/sigtap/lote', [...codigosProc]),
    postLote('/api/cid10/lote', [...codigosCid]),
  ]);

  return {
    sigtapPorCodigo: new Map((Array.isArray(sigtapResp) ? sigtapResp : []).map((r) => [r.codigo, r])),
    cidValidos: new Set((Array.isArray(cidResp) ? cidResp : []).map((r) => r.codigo)),
  };
}

function aihValidarArquivo(analise, ctx) {
  if (analise.semConteudo) return { nomeArquivo: analise.nomeArquivo, vazio: true };

  const principais = analise.registros.filter((r) => r.tipo === '01' || r.tipo === '03' || r.tipo === '05');
  const checksLote = aihChecarLotes(principais.length ? principais : analise.registros);

  const registrosComProblema = [];
  for (const r of analise.registros) {
    const resultado = r.tipo === '07' ? aihValidarRegistroOpm(r) : r.tipo === '04' ? aihValidarRegistroCivil(r) : aihValidarRegistroPrincipal(r, ctx);
    if (resultado.erros.length || resultado.avisos.length) registrosComProblema.push({ ...r, ...resultado });
  }

  const tamanhoHtml = analise.tamanhoIrregular.length
    ? [{ severidade: 'aviso', texto: `${analise.tamanhoIrregular.length} registro(s) com tamanho diferente de 1800 posições: linha(s) ${analise.tamanhoIrregular.slice(0, 10).map((t) => t.ordinal).join(', ')}${analise.tamanhoIrregular.length > 10 ? '…' : ''}` }]
    : [];

  const contarSeveridade = (lista, sev) => lista.filter((x) => x.severidade === sev).length;
  const totalErros = registrosComProblema.reduce((s, r) => s + r.erros.length, 0) + contarSeveridade(checksLote, 'erro') + analise.tiposDesconhecidos.length;
  const totalAvisos = registrosComProblema.reduce((s, r) => s + r.avisos.length, 0) + contarSeveridade(checksLote, 'aviso') + tamanhoHtml.length;

  const rotuloTipo = { '01': 'AIH principal', '03': 'AIH continuação', '05': 'AIH longa perm.', '04': 'Registro civil', '07': 'OPM' };
  return {
    nomeArquivo: analise.nomeArquivo,
    checksLote,
    tamanhoHtml,
    registrosComProblema: registrosComProblema.map((r) => ({ ...r, rotuloTipo: rotuloTipo[r.tipo] || r.tipo })),
    tiposDesconhecidos: analise.tiposDesconhecidos,
    totalRegistros: analise.registros.length,
    totalAihs: new Set(principais.map((r) => r.campos.nuAih)).size,
    totalErros,
    totalAvisos,
  };
}

let aihUltimoResultado = [];
let aihUltimoContexto = { analises: [], ctx: {} };

function renderizarResultadoAih(resultados) {
  aihUltimoResultado = resultados;
  const aihResultadoAreaEl = document.getElementById('aih-resultado-area');

  const html = resultados.map((r) => {
    if (r.vazio) return `<div class="msg vazio">${escaparHtml(r.nomeArquivo)}: arquivo vazio.</div>`;

    const statusHtml = r.totalErros > 0
      ? '<span class="sigtap-badge sigtap-badge-erro">Com erros</span>'
      : r.totalAvisos > 0
        ? '<span class="sigtap-badge sigtap-badge-3">Com avisos</span>'
        : '<span class="sigtap-badge">OK</span>';

    const tiposDesconhecidosHtml = r.tiposDesconhecidos.length
      ? bpaLinhaValidador({ severidade: 'erro', texto: `${r.tiposDesconhecidos.length} registro(s) com tipo (IDENT_AIH) desconhecido (esperado 01/03/04/05/07): linha(s) ${r.tiposDesconhecidos.slice(0, 10).map((t) => t.ordinal).join(', ')}${r.tiposDesconhecidos.length > 10 ? '…' : ''}` })
      : '';

    const registrosExibidos = r.registrosComProblema.slice(0, BPA_LIMITE_EXIBICAO);
    const registrosHtml = registrosExibidos.map((reg) => `
      <div class="bpa-linha-card">
        <div class="bpa-linha-cab">
          <span>${escaparHtml(reg.rotuloTipo)}</span><span>AIH ${escaparHtml(reg.campos.nuAih || '—')}</span><span>linha ${reg.ordinal}</span>
        </div>
        ${reg.erros.map((e) => bpaLinhaValidador({ severidade: 'erro', texto: e })).join('')}
        ${reg.avisos.map((a) => bpaLinhaValidador({ severidade: 'aviso', texto: a })).join('')}
      </div>`).join('');

    const notaLimite = r.registrosComProblema.length > BPA_LIMITE_EXIBICAO
      ? `<p class="ajustes-nota">Mostrando os primeiros ${BPA_LIMITE_EXIBICAO} registros com problema, de ${r.registrosComProblema.length} no total. Use "Exportar CSV" para ver todos.</p>`
      : '';

    return `
      <div class="grupo grupo-principal" style="margin-bottom:16px;">
        <div class="grupo-corpo" style="padding-top:14px;">
          <div class="mp-header" style="margin:0 16px 10px;">
            <h3 style="margin:0;">${escaparHtml(r.nomeArquivo)}</h3>
            ${statusHtml}
          </div>
          <div style="margin:0 16px 10px; display:flex; gap:16px; flex-wrap:wrap; font-size:0.85rem; color:var(--ink-soft);">
            <span>${r.totalRegistros} registro(s)</span><span>${r.totalAihs} AIH(s) distinta(s)</span>
            <span>${r.totalErros} erro(s)</span><span>${r.totalAvisos} aviso(s)</span>
          </div>
          <div style="margin:0 16px;">
            <div class="ajustes-nota" style="margin-bottom:4px;"><strong>Lote(s)</strong></div>
            ${r.checksLote.map(bpaLinhaValidador).join('')}
            ${r.tamanhoHtml.map(bpaLinhaValidador).join('')}
            ${tiposDesconhecidosHtml}
          </div>
          ${
            registrosHtml
              ? `<div style="margin:14px 16px 0;"><div class="ajustes-nota" style="margin-bottom:8px;"><strong>Registros com problema (${r.registrosComProblema.length})</strong></div>${registrosHtml}${notaLimite}</div>`
              : '<div class="msg vazio" style="margin:14px 16px 0;">Nenhum registro com problema.</div>'
          }
          <div style="margin:14px 16px 0;">
            <button type="button" class="acao-btn btn-aih-exportar" data-arquivo="${escaparHtml(r.nomeArquivo)}">⬇ Exportar CSV dos registros com problema</button>
            <button type="button" class="acao-btn btn-aih-pdf" data-arquivo="${escaparHtml(r.nomeArquivo)}">🖨 Gerar PDF de conferência</button>
          </div>
        </div>
      </div>`;
  }).join('');

  aihResultadoAreaEl.innerHTML = html;
}

function exportarAihCsv(nomeArquivo) {
  const r = aihUltimoResultado.find((x) => x.nomeArquivo === nomeArquivo);
  if (!r) return;
  const linhas = [['Arquivo', 'Tipo', 'Linha', 'Número AIH', 'Severidade', 'Problema']];
  for (const reg of r.registrosComProblema) {
    for (const e of reg.erros) linhas.push([r.nomeArquivo, reg.rotuloTipo, reg.ordinal, reg.campos.nuAih, 'erro', e]);
    for (const a of reg.avisos) linhas.push([r.nomeArquivo, reg.rotuloTipo, reg.ordinal, reg.campos.nuAih, 'aviso', a]);
  }
  baixarCsv(`aih-problemas-${nomeArquivo.replace(/\.[^.]+$/, '')}.csv`, linhas);
}

async function processarArquivosAih(files) {
  const aihResultadoAreaEl = document.getElementById('aih-resultado-area');
  aihResultadoAreaEl.innerHTML = '<div class="msg vazio">Analisando…</div>';
  try {
    const analises = [];
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const texto = new TextDecoder('iso-8859-1').decode(new Uint8Array(buffer));
      analises.push(analisarArquivoAih(texto, file.name));
    }
    const todosRegistros = analises.flatMap((a) => a.registros || []);
    const ctx = await aihCrossCheckSigtapCid(todosRegistros);
    aihUltimoContexto = { analises, ctx };
    renderizarResultadoAih(analises.map((analise) => aihValidarArquivo(analise, ctx)));
  } catch (err) {
    console.error(err);
    aihResultadoAreaEl.innerHTML = `<div class="msg erro">Erro ao analisar arquivo(s): ${escaparHtml(err.message)}</div>`;
  }
}

const aihArquivoEl = document.getElementById('aih-arquivo');
if (aihArquivoEl) {
  aihArquivoEl.addEventListener('change', () => {
    if (aihArquivoEl.files.length > 0) processarArquivosAih(Array.from(aihArquivoEl.files));
  });
}
document.getElementById('aih-resultado-area')?.addEventListener('click', (e) => {
  const btnCsv = e.target.closest('.btn-aih-exportar');
  if (btnCsv) exportarAihCsv(btnCsv.dataset.arquivo);
  const btnPdf = e.target.closest('.btn-aih-pdf');
  if (btnPdf) {
    const textoOriginal = btnPdf.textContent;
    btnPdf.disabled = true;
    btnPdf.textContent = 'Consultando CNES do estabelecimento…';
    aihLinhasRelatorio(btnPdf.dataset.arquivo)
      .then(gerarPdfValidacao)
      .finally(() => { btnPdf.disabled = false; btnPdf.textContent = textoOriginal; });
  }
});

// ---------- Validador APAC (SIA/SUS) ----------
// Layout oficial: "Layout da interface texto do APAC e do SIA - layout
// INTERNO" (DATASUS/SIA, versão 08/07/2026). Cabeçalho (tipo 01, 137 bytes),
// corpo da APAC (tipo 14, até 537 bytes) e registro de procedimentos (tipo
// 13, até 97 bytes) são validados campo a campo; os laudos de parte variável
// (06 Geral, 07 Quimioterapia, 08 Radioterapia, 09 Nefrologia, 10
// Medicamentos, 11 Pós-bariátrica, 12 Prótese de mama, 17 Pré-bariátrica, 18
// Tratamento dialítico, 19 Acomp. multiprofissional DRC, 20 Confecção de
// fístula, além de 04/05 Atenção Domiciliar e 15/16 Atenção Psicossocial)
// são reconhecidos pelo tipo de registro mas não têm todos os campos
// validados — só o tipo 06 (Geral) tem validação de campo completa, por ser
// simples e sempre presente. Roda inteiramente no navegador — o arquivo
// nunca é enviado a nenhum servidor; só os códigos de procedimento e CID-10,
// em lote, para conferir contra a SIGTAP e o CID-10 já carregados.

const APAC_CAMPOS_CABECALHO = [
  ['cbcHdr1', 1, 2], ['cbcHdr2', 3, 7], ['cbcCmp', 8, 13], ['cbcLin', 14, 19], ['cbcSmtVrf', 20, 23],
  ['cbcRsp', 24, 53], ['cbcSgl', 54, 59], ['cbcCgccpf', 60, 73], ['cbcDst', 74, 113], ['cbcDstIn', 114, 114],
  ['cbcDtger', 115, 122], ['cbcVersao', 123, 137],
];

const APAC_CAMPOS_CORPO = [
  ['apaCorpo', 1, 2], ['apaCmp', 3, 8], ['apaNum', 9, 21], ['apaCoduf', 22, 23], ['apaCodcnes', 24, 30],
  ['apaPr', 31, 38], ['apaDtiinval', 39, 46], ['apaDtfimval', 47, 54], ['apaTipate', 55, 56], ['apaTipapac', 57, 57],
  ['apaNomepcnte', 58, 87], ['apaNomemae', 88, 117], ['apaLogpcnte', 118, 147], ['apaNumpcnte', 148, 152],
  ['apaCplpcnte', 153, 162], ['apaCeppcnte', 163, 170], ['apaMunpcnte', 171, 177], ['apaDatanascim', 178, 185],
  ['apaSexopcnte', 186, 186], ['apaNomeresp1', 187, 216], ['apaCodprinc', 217, 226], ['apaMotsaida', 227, 228],
  ['apaDtobitoalta', 229, 236], ['apaNomediretor', 237, 266], ['apaCnspct', 267, 281], ['apaCnsres', 282, 296],
  ['apaCnsdir', 297, 311], ['apaCidca', 312, 315], ['apaNpront', 316, 325], ['apaCodsol', 326, 332],
  ['apaDatsol', 333, 340], ['apaDataut', 341, 348], ['apaCodemis', 349, 358], ['apaCarate', 359, 360],
  ['apaApacant', 361, 373], ['apaRaca', 374, 375], ['apaNomeresp2', 376, 405], ['apaNascpcnte', 406, 408],
  ['apaEtnia', 409, 412], ['apaCdlogr', 413, 415], ['apaBairro', 416, 445], ['apaDddtelcontato', 446, 447],
  ['apaTelcontato', 448, 456], ['apaEmail', 457, 496], ['apaCnsexec', 497, 511], ['apaCpfpcnte', 512, 522],
  ['apaIne', 523, 532], ['apaStrua', 533, 533], ['apaFntorca', 534, 535], ['apaEmenpar', 536, 536], ['apaSemcpf', 537, 537],
];

const APAC_CAMPOS_ACOES = [
  ['papCorpo', 1, 2], ['papCmp', 3, 8], ['papNum', 9, 21], ['papCodproc', 22, 31], ['papCbo', 32, 37],
  ['papQtdprod', 38, 44], ['papCGC', 45, 58], ['papNF', 59, 64], ['papCIDP', 65, 68], ['papCIDS', 69, 72],
  ['papSRV', 73, 75], ['papCLF', 76, 78], ['papEquipeSeq', 79, 86], ['papEquipeArea', 87, 90], ['papCnesTerc', 91, 97],
];

const APAC_CAMPOS_GERAL = [
  ['apaVaria', 1, 2], ['apaCmp', 3, 8], ['apaNum', 9, 21], ['apaCidpri', 22, 25], ['apaCidsec', 26, 29], ['apaDtiden', 30, 37],
];

// Tipos de laudo de parte variável reconhecidos pelo layout oficial, sem
// validação de campo detalhada (ver comentário acima do módulo).
const APAC_TIPOS_LAUDO_RECONHECIDOS = new Set(['04', '05', '07', '08', '09', '10', '11', '12', '15', '16', '17', '18', '19', '20']);

const APAC_TIPAPAC_VALIDOS = new Set(['1', '2', '3']);
const APAC_CARATE_CONHECIDOS = new Set(['01', '02', '03', '04', '05', '06']);

function apacExtrairCampos(linha, definicao) {
  const campos = {};
  for (const [nome, ini, fim] of definicao) campos[nome] = (linha.slice(ini - 1, fim) || '').trim();
  return campos;
}

function apacDividirLinhas(texto) {
  return texto.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 1);
}

function analisarArquivoApac(texto, nomeArquivo) {
  const linhasTexto = apacDividirLinhas(texto);
  if (linhasTexto.length === 0) return { nomeArquivo, semConteudo: true };

  const primeira = linhasTexto[0];
  const temCabecalho = primeira.slice(0, 2) === '01' && primeira.slice(2, 7) === '#APAC';
  const linhasCorpoTexto = temCabecalho ? linhasTexto.slice(1) : linhasTexto;

  const registros = [];
  const tiposDesconhecidos = [];
  linhasCorpoTexto.forEach((linha, i) => {
    const ordinal = i + (temCabecalho ? 2 : 1);
    const tipo = linha.slice(0, 2);
    if (tipo === '14') registros.push({ ordinal, tipo, campos: apacExtrairCampos(linha, APAC_CAMPOS_CORPO) });
    else if (tipo === '13') registros.push({ ordinal, tipo, campos: apacExtrairCampos(linha, APAC_CAMPOS_ACOES) });
    else if (tipo === '06') registros.push({ ordinal, tipo, campos: apacExtrairCampos(linha, APAC_CAMPOS_GERAL) });
    else if (APAC_TIPOS_LAUDO_RECONHECIDOS.has(tipo)) registros.push({ ordinal, tipo, campos: {} });
    else tiposDesconhecidos.push({ ordinal, tipo });
  });

  return {
    nomeArquivo,
    temCabecalho,
    cabecalho: temCabecalho ? apacExtrairCampos(primeira, APAC_CAMPOS_CABECALHO) : null,
    cabecalhoRaw: temCabecalho ? primeira : null,
    registros,
    tiposDesconhecidos,
  };
}

function validarCabecalhoApac(analise) {
  const checks = [];
  if (!analise.temCabecalho) {
    checks.push({ severidade: 'erro', texto: 'Arquivo não começa com uma linha de cabeçalho válida (esperado indicador "01" + marcador "#APAC" nas posições 1-7).' });
    return checks;
  }
  const c = analise.cabecalho;
  checks.push(c.cbcHdr2 === '#APAC'
    ? { severidade: 'ok', texto: 'Marcador de início "#APAC" presente' }
    : { severidade: 'erro', texto: `Marcador de início deveria ser "#APAC", encontrado "${c.cbcHdr2}"` });
  checks.push(bpaValidarCompetencia(c.cbcCmp)
    ? { severidade: 'ok', texto: `Competência do cabeçalho: ${c.cbcCmp.slice(4, 6)}/${c.cbcCmp.slice(0, 4)}` }
    : { severidade: 'erro', texto: `Competência (AAAAMM) inválida: "${c.cbcCmp}"` });

  const corposReais = analise.registros.filter((r) => r.tipo === '14').length;
  checks.push(Number(c.cbcLin) === corposReais
    ? { severidade: 'ok', texto: `Número de APACs gravadas confere: ${corposReais}` }
    : { severidade: 'erro', texto: `Cabeçalho declara ${c.cbcLin} APAC(s), mas o arquivo tem ${corposReais} registro(s) de corpo (tipo 14).` });

  // Fórmula do campo de controle (nota do layout oficial): soma de
  // (código do procedimento + quantidade + número da APAC) de cada linha de
  // procedimento, resto da divisão por 1111, mais 1111.
  let somaControle = 0;
  for (const r of analise.registros) {
    if (r.tipo !== '13') continue;
    somaControle += (Number(r.campos.papCodproc) || 0) + (Number(r.campos.papQtdprod) || 0) + (Number(r.campos.papNum) || 0);
  }
  const controleCalculado = 1111 + (somaControle % 1111);
  checks.push(controleCalculado === Number(c.cbcSmtVrf)
    ? { severidade: 'ok', texto: `Campo de controle confere: ${c.cbcSmtVrf}` }
    : { severidade: 'aviso', texto: `Campo de controle declarado ("${c.cbcSmtVrf}") não bate com o recalculado (${controleCalculado}) — pode indicar arquivo alterado ou truncado.` });

  const cgcCpf = validarCgcCpf(c.cbcCgccpf);
  checks.push(cgcCpf.valido
    ? { severidade: 'ok', texto: `${cgcCpf.tipo} do órgão responsável com dígito verificador válido` }
    : { severidade: 'aviso', texto: `CGC/CPF do órgão responsável ("${c.cbcCgccpf}") não bate com um CPF ou CNPJ válido.` });

  if (c.cbcDstIn && !['E', 'M'].includes(c.cbcDstIn)) checks.push({ severidade: 'aviso', texto: `Indicador de órgão destino deveria ser "E" ou "M", encontrado "${c.cbcDstIn}"` });
  if (c.cbcDtger && !bpaValidarDataAAAAMMDD(c.cbcDtger)) checks.push({ severidade: 'aviso', texto: `Data de geração de remessa inválida: "${c.cbcDtger}"` });

  return checks;
}

function apacValidarCorpo(reg, ctx) {
  const erros = [];
  const avisos = [];
  const c = reg.campos;

  if (!/^\d{7}$/.test(c.apaCodcnes)) erros.push(`CNES fora do formato (7 dígitos): "${c.apaCodcnes}"`);
  if (!/^\d{13}$/.test(c.apaNum)) erros.push(`Número da APAC fora do formato (13 dígitos): "${c.apaNum}"`);

  const dtiinval = bpaValidarDataAAAAMMDD(c.apaDtiinval);
  const dtfimval = bpaValidarDataAAAAMMDD(c.apaDtfimval);
  if (c.apaDtiinval && !dtiinval) erros.push(`Data inicial de validade inválida: "${c.apaDtiinval}"`);
  if (c.apaDtfimval && !dtfimval) erros.push(`Data final de validade inválida: "${c.apaDtfimval}"`);
  if (dtiinval && dtfimval && dtiinval > dtfimval) erros.push('Data inicial de validade é posterior à data final de validade.');
  if (c.apaPr && !bpaValidarDataAAAAMMDD(c.apaPr)) avisos.push(`Data de processamento inválida: "${c.apaPr}"`);

  if (c.apaTipapac && !APAC_TIPAPAC_VALIDOS.has(c.apaTipapac)) erros.push(`Tipo de APAC deveria ser 1 (Inicial), 2 (Continuidade) ou 3 (Única), encontrado "${c.apaTipapac}"`);

  erros.push(...aihValidarNomePessoa(c.apaNomepcnte, 'Nome do paciente'));
  avisos.push(...aihValidarNomePessoa(c.apaNomemae, 'Nome da mãe do paciente'));
  avisos.push(...aihValidarNomePessoa(c.apaNomeresp1, 'Nome do médico responsável'));
  avisos.push(...aihValidarNomePessoa(c.apaNomeresp2, 'Nome do responsável pelo paciente'));
  avisos.push(...aihValidarNomePessoa(c.apaNomediretor, 'Nome do profissional autorizador'));

  const dtNasc = bpaValidarDataAAAAMMDD(c.apaDatanascim);
  if (c.apaDatanascim && !dtNasc) erros.push(`Data de nascimento do paciente inválida: "${c.apaDatanascim}"`);
  if (!['M', 'F'].includes(c.apaSexopcnte)) erros.push(`Sexo do paciente deveria ser "M" ou "F", encontrado "${c.apaSexopcnte}"`);

  if (c.apaCodprinc && /^\d{10}$/.test(c.apaCodprinc) && ctx.sigtapPorCodigo) {
    const proc = ctx.sigtapPorCodigo.get(c.apaCodprinc);
    if (!proc) avisos.push(`Procedimento principal "${c.apaCodprinc}" não encontrado na SIGTAP carregada.`);
    else if ((proc.sexo === 'M' || proc.sexo === 'F') && ['M', 'F'].includes(c.apaSexopcnte) && proc.sexo !== c.apaSexopcnte) {
      erros.push(`Procedimento principal "${c.apaCodprinc}" é restrito a sexo ${proc.sexo === 'M' ? 'Masculino' : 'Feminino'} na SIGTAP, mas o paciente é "${c.apaSexopcnte}".`);
    }
  }

  [['do paciente', c.apaCnspct], ['do médico responsável', c.apaCnsres], ['do autorizador', c.apaCnsdir]].forEach(([rotulo, cns]) => {
    if (!cns) return;
    const r = validarCns(cns);
    if (!r.valido) avisos.push(`CNS ${rotulo} ${r.motivo === 'formato' ? 'fora do formato (15 dígitos)' : 'com dígito verificador inválido'}: "${cns}"`);
    else if (r.naoVerificado) avisos.push(`CNS ${rotulo} "${cns}" começa com "${cns[0]}" — dígito verificador não checado para esse prefixo.`);
  });
  if (c.apaCnsexec) {
    const r = validarCns(c.apaCnsexec);
    if (!r.valido) avisos.push(`CNS do médico executante ${r.motivo === 'formato' ? 'fora do formato (15 dígitos)' : 'com dígito verificador inválido'}: "${c.apaCnsexec}"`);
  }
  if (c.apaCpfpcnte && !validarCpf(c.apaCpfpcnte)) avisos.push(`CPF do paciente com dígito verificador inválido: "${c.apaCpfpcnte}"`);

  const cidca = c.apaCidca.toUpperCase();
  if (cidca && !/^[A-Z]\d{2,3}$/.test(cidca)) avisos.push(`CID de causas associadas fora do formato CID-10: "${c.apaCidca}"`);
  else if (cidca && ctx.cidValidos && !ctx.cidValidos.has(cidca)) avisos.push(`CID de causas associadas "${cidca}" não encontrado na base de CID-10 carregada.`);

  if (c.apaDatsol && !bpaValidarDataAAAAMMDD(c.apaDatsol)) avisos.push(`Data da solicitação inválida: "${c.apaDatsol}"`);
  if (c.apaDataut && !bpaValidarDataAAAAMMDD(c.apaDataut)) avisos.push(`Data da autorização inválida: "${c.apaDataut}"`);
  if (c.apaCarate && !APAC_CARATE_CONHECIDOS.has(c.apaCarate)) avisos.push(`Caráter de atendimento "${c.apaCarate}" fora do domínio conhecido [01..06] (Portaria 719/2007).`);
  if (c.apaRaca && !AIH_RACAS_VALIDAS.has(c.apaRaca)) avisos.push(`Raça/cor do paciente fora do domínio [01,02,03,04,05,99]: "${c.apaRaca}"`);
  if (c.apaRaca === '05' && c.apaEtnia === '0000') avisos.push('Raça/cor "05-Indígena" mas etnia indígena não informada.');

  ['apaStrua', 'apaSemcpf', 'apaEmenpar'].forEach((campo) => {
    if (c[campo] && !['N', 'S'].includes(c[campo])) avisos.push(`Campo "${campo}" deveria ser "N" ou "S", encontrado "${c[campo]}"`);
  });

  return { erros, avisos };
}

function apacValidarAcoes(reg, ctx) {
  const erros = [];
  const avisos = [];
  const c = reg.campos;

  if (!/^\d{10}$/.test(c.papCodproc)) erros.push(`Código do procedimento fora do formato (10 dígitos): "${c.papCodproc}"`);
  else if (ctx.sigtapPorCodigo && !ctx.sigtapPorCodigo.get(c.papCodproc)) avisos.push(`Código de procedimento "${c.papCodproc}" não encontrado na SIGTAP carregada.`);

  if (Number(c.papQtdprod) <= 0) erros.push(`Quantidade de procedimentos deveria ser maior que zero, encontrado "${c.papQtdprod}"`);
  if (!bpaValidarCompetencia(c.papCmp)) erros.push(`Competência (AAAAMM) inválida: "${c.papCmp}"`);

  const cidp = c.papCIDP.toUpperCase();
  if (cidp && !/^[A-Z]\d{2,3}$/.test(cidp)) avisos.push(`CID principal fora do formato CID-10: "${c.papCIDP}"`);
  else if (cidp && ctx.cidValidos && !ctx.cidValidos.has(cidp)) avisos.push(`CID principal "${cidp}" não encontrado na base de CID-10 carregada.`);
  const cids = c.papCIDS.toUpperCase();
  if (cids && !/^[A-Z]\d{2,3}$/.test(cids)) avisos.push(`CID secundário fora do formato CID-10: "${c.papCIDS}"`);
  else if (cids && ctx.cidValidos && !ctx.cidValidos.has(cids)) avisos.push(`CID secundário "${cids}" não encontrado na base de CID-10 carregada.`);

  if (c.papCGC && !/^0*$/.test(c.papCGC) && !validarCnpj(c.papCGC.slice(-14))) avisos.push(`CNPJ de cessão de crédito com dígito verificador inválido: "${c.papCGC}"`);

  return { erros, avisos };
}

function apacValidarGeral(reg, ctx) {
  const erros = [];
  const avisos = [];
  const c = reg.campos;
  const cidpri = c.apaCidpri.toUpperCase();
  if (cidpri && !/^[A-Z]\d{2,3}$/.test(cidpri)) avisos.push(`CID principal fora do formato CID-10: "${c.apaCidpri}"`);
  else if (cidpri && ctx.cidValidos && !ctx.cidValidos.has(cidpri)) avisos.push(`CID principal "${cidpri}" não encontrado na base de CID-10 carregada.`);
  const cidsec = c.apaCidsec.toUpperCase();
  if (cidsec && !/^[A-Z]\d{2,3}$/.test(cidsec)) avisos.push(`CID secundário fora do formato CID-10: "${c.apaCidsec}"`);
  else if (cidsec && ctx.cidValidos && !ctx.cidValidos.has(cidsec)) avisos.push(`CID secundário "${cidsec}" não encontrado na base de CID-10 carregada.`);
  if (c.apaDtiden && !bpaValidarDataAAAAMMDD(c.apaDtiden)) avisos.push(`Data da identificação patológica inválida: "${c.apaDtiden}"`);
  return { erros, avisos };
}

async function apacCrossCheckSigtapCid(registros) {
  const codigosProc = new Set();
  const codigosCid = new Set();
  for (const r of registros) {
    if (r.tipo === '14' && /^\d{10}$/.test(r.campos.apaCodprinc)) codigosProc.add(r.campos.apaCodprinc);
    if (r.tipo === '14' && /^[A-Z]\d{2,3}$/.test(r.campos.apaCidca.toUpperCase())) codigosCid.add(r.campos.apaCidca.toUpperCase());
    if (r.tipo === '13') {
      if (/^\d{10}$/.test(r.campos.papCodproc)) codigosProc.add(r.campos.papCodproc);
      if (/^[A-Z]\d{2,3}$/.test(r.campos.papCIDP.toUpperCase())) codigosCid.add(r.campos.papCIDP.toUpperCase());
      if (/^[A-Z]\d{2,3}$/.test(r.campos.papCIDS.toUpperCase())) codigosCid.add(r.campos.papCIDS.toUpperCase());
    }
    if (r.tipo === '06') {
      if (/^[A-Z]\d{2,3}$/.test(r.campos.apaCidpri.toUpperCase())) codigosCid.add(r.campos.apaCidpri.toUpperCase());
      if (/^[A-Z]\d{2,3}$/.test(r.campos.apaCidsec.toUpperCase())) codigosCid.add(r.campos.apaCidsec.toUpperCase());
    }
  }
  const postLote = (url, codigos) => codigos.length
    ? fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigos }) }).then((r) => r.json()).catch(() => [])
    : Promise.resolve([]);
  const [sigtapResp, cidResp] = await Promise.all([
    postLote('/api/sigtap/lote', [...codigosProc]),
    postLote('/api/cid10/lote', [...codigosCid]),
  ]);
  return {
    sigtapPorCodigo: new Map((Array.isArray(sigtapResp) ? sigtapResp : []).map((r) => [r.codigo, r])),
    cidValidos: new Set((Array.isArray(cidResp) ? cidResp : []).map((r) => r.codigo)),
  };
}

const APAC_ROTULO_TIPO = {
  '14': 'Corpo da APAC', '13': 'Registro de procedimentos', '06': 'Laudo Geral', '07': 'Laudo Quimioterapia',
  '08': 'Laudo Radioterapia', '09': 'Laudo Nefrologia', '10': 'Laudo Medicamentos', '11': 'Laudo Pós-bariátrica',
  '12': 'Laudo Prótese de mama', '17': 'Laudo Pré-bariátrica', '18': 'Laudo Tratamento dialítico',
  '19': 'Acomp. multiprofissional DRC', '20': 'Confecção de fístula', '04': 'Atenção domiciliar (corpo)',
  '05': 'Ações da atenção domiciliar', '15': 'Atenção psicossocial (corpo)', '16': 'Ações da atenção psicossocial',
};

function apacValidarArquivo(analise, ctx) {
  if (analise.semConteudo) return { nomeArquivo: analise.nomeArquivo, vazio: true };

  const checksCabecalho = validarCabecalhoApac(analise);

  const registrosComProblema = [];
  for (const r of analise.registros) {
    const resultado = r.tipo === '14' ? apacValidarCorpo(r, ctx)
      : r.tipo === '13' ? apacValidarAcoes(r, ctx)
        : r.tipo === '06' ? apacValidarGeral(r, ctx)
          : { erros: [], avisos: [] };
    if (resultado.erros.length || resultado.avisos.length) registrosComProblema.push({ ...r, ...resultado });
  }

  const contarSeveridade = (lista, sev) => lista.filter((x) => x.severidade === sev).length;
  const totalErros = registrosComProblema.reduce((s, r) => s + r.erros.length, 0) + contarSeveridade(checksCabecalho, 'erro') + analise.tiposDesconhecidos.length;
  const totalAvisos = registrosComProblema.reduce((s, r) => s + r.avisos.length, 0) + contarSeveridade(checksCabecalho, 'aviso');

  return {
    nomeArquivo: analise.nomeArquivo,
    checksCabecalho,
    registrosComProblema: registrosComProblema.map((r) => ({ ...r, rotuloTipo: APAC_ROTULO_TIPO[r.tipo] || r.tipo })),
    tiposDesconhecidos: analise.tiposDesconhecidos,
    totalRegistros: analise.registros.length,
    totalApacs: analise.registros.filter((r) => r.tipo === '14').length,
    totalErros,
    totalAvisos,
  };
}

let apacUltimoResultado = [];
let apacUltimoContexto = { analises: [], ctx: {} };

function renderizarResultadoApac(resultados) {
  apacUltimoResultado = resultados;
  const apacResultadoAreaEl = document.getElementById('apac-resultado-area');

  const html = resultados.map((r) => {
    if (r.vazio) return `<div class="msg vazio">${escaparHtml(r.nomeArquivo)}: arquivo vazio.</div>`;

    const statusHtml = r.totalErros > 0
      ? '<span class="sigtap-badge sigtap-badge-erro">Com erros</span>'
      : r.totalAvisos > 0
        ? '<span class="sigtap-badge sigtap-badge-3">Com avisos</span>'
        : '<span class="sigtap-badge">OK</span>';

    const tiposDesconhecidosHtml = r.tiposDesconhecidos.length
      ? bpaLinhaValidador({ severidade: 'erro', texto: `${r.tiposDesconhecidos.length} registro(s) com tipo desconhecido: linha(s) ${r.tiposDesconhecidos.slice(0, 10).map((t) => t.ordinal).join(', ')}${r.tiposDesconhecidos.length > 10 ? '…' : ''}` })
      : '';

    const registrosExibidos = r.registrosComProblema.slice(0, BPA_LIMITE_EXIBICAO);
    const registrosHtml = registrosExibidos.map((reg) => `
      <div class="bpa-linha-card">
        <div class="bpa-linha-cab">
          <span>${escaparHtml(reg.rotuloTipo)}</span><span>${escaparHtml(reg.campos.apaNum || reg.campos.papNum || '—')}</span><span>linha ${reg.ordinal}</span>
        </div>
        ${reg.erros.map((e) => bpaLinhaValidador({ severidade: 'erro', texto: e })).join('')}
        ${reg.avisos.map((a) => bpaLinhaValidador({ severidade: 'aviso', texto: a })).join('')}
      </div>`).join('');

    const notaLimite = r.registrosComProblema.length > BPA_LIMITE_EXIBICAO
      ? `<p class="ajustes-nota">Mostrando os primeiros ${BPA_LIMITE_EXIBICAO} registros com problema, de ${r.registrosComProblema.length} no total. Use "Exportar CSV" para ver todos.</p>`
      : '';

    return `
      <div class="grupo grupo-principal" style="margin-bottom:16px;">
        <div class="grupo-corpo" style="padding-top:14px;">
          <div class="mp-header" style="margin:0 16px 10px;">
            <h3 style="margin:0;">${escaparHtml(r.nomeArquivo)}</h3>
            ${statusHtml}
          </div>
          <div style="margin:0 16px 10px; display:flex; gap:16px; flex-wrap:wrap; font-size:0.85rem; color:var(--ink-soft);">
            <span>${r.totalRegistros} registro(s)</span><span>${r.totalApacs} APAC(s)</span>
            <span>${r.totalErros} erro(s)</span><span>${r.totalAvisos} aviso(s)</span>
          </div>
          <div style="margin:0 16px;">
            <div class="ajustes-nota" style="margin-bottom:4px;"><strong>Cabeçalho</strong></div>
            ${r.checksCabecalho.map(bpaLinhaValidador).join('')}
            ${tiposDesconhecidosHtml}
          </div>
          ${
            registrosHtml
              ? `<div style="margin:14px 16px 0;"><div class="ajustes-nota" style="margin-bottom:8px;"><strong>Registros com problema (${r.registrosComProblema.length})</strong></div>${registrosHtml}${notaLimite}</div>`
              : '<div class="msg vazio" style="margin:14px 16px 0;">Nenhum registro com problema.</div>'
          }
          <div style="margin:14px 16px 0;">
            <button type="button" class="acao-btn btn-apac-exportar" data-arquivo="${escaparHtml(r.nomeArquivo)}">⬇ Exportar CSV dos registros com problema</button>
            <button type="button" class="acao-btn btn-apac-pdf" data-arquivo="${escaparHtml(r.nomeArquivo)}">🖨 Gerar PDF de conferência</button>
          </div>
        </div>
      </div>`;
  }).join('');

  apacResultadoAreaEl.innerHTML = html;
}

function exportarApacCsv(nomeArquivo) {
  const r = apacUltimoResultado.find((x) => x.nomeArquivo === nomeArquivo);
  if (!r) return;
  const linhas = [['Arquivo', 'Tipo', 'Linha', 'Número APAC', 'Severidade', 'Problema']];
  for (const reg of r.registrosComProblema) {
    const numApac = reg.campos.apaNum || reg.campos.papNum || '';
    for (const e of reg.erros) linhas.push([r.nomeArquivo, reg.rotuloTipo, reg.ordinal, numApac, 'erro', e]);
    for (const a of reg.avisos) linhas.push([r.nomeArquivo, reg.rotuloTipo, reg.ordinal, numApac, 'aviso', a]);
  }
  baixarCsv(`apac-problemas-${nomeArquivo.replace(/\.[^.]+$/, '')}.csv`, linhas);
}

async function processarArquivosApac(files) {
  const apacResultadoAreaEl = document.getElementById('apac-resultado-area');
  apacResultadoAreaEl.innerHTML = '<div class="msg vazio">Analisando…</div>';
  try {
    const analises = [];
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const texto = new TextDecoder('iso-8859-1').decode(new Uint8Array(buffer));
      analises.push(analisarArquivoApac(texto, file.name));
    }
    const todosRegistros = analises.flatMap((a) => a.registros || []);
    const ctx = await apacCrossCheckSigtapCid(todosRegistros);
    apacUltimoContexto = { analises, ctx };
    renderizarResultadoApac(analises.map((analise) => apacValidarArquivo(analise, ctx)));
  } catch (err) {
    console.error(err);
    apacResultadoAreaEl.innerHTML = `<div class="msg erro">Erro ao analisar arquivo(s): ${escaparHtml(err.message)}</div>`;
  }
}

const apacArquivoEl = document.getElementById('apac-arquivo');
if (apacArquivoEl) {
  apacArquivoEl.addEventListener('change', () => {
    if (apacArquivoEl.files.length > 0) processarArquivosApac(Array.from(apacArquivoEl.files));
  });
}
document.getElementById('apac-resultado-area')?.addEventListener('click', (e) => {
  const btnCsv = e.target.closest('.btn-apac-exportar');
  if (btnCsv) exportarApacCsv(btnCsv.dataset.arquivo);
  const btnPdf = e.target.closest('.btn-apac-pdf');
  if (btnPdf) gerarPdfValidacao(apacLinhasRelatorio(btnPdf.dataset.arquivo));
});

// ---------- Relatório de conferência (PDF) — Validadores SUS ----------
// Reaproveita o mecanismo já usado para a guia/fatura simulada (imprimir só
// #guia-print-area, via body.modo-guia + window.print — "salvar como PDF" é
// escolha do diálogo de impressão do navegador). Os valores SH/SA/SP vêm da
// SIGTAP já carregada durante a validação (mesmo lote de códigos, sem nova
// consulta). SH é o componente hospitalar (usado em AIH/SIH) e SA o
// ambulatorial (usado em BPA/APAC); SP é o componente profissional, somado
// em ambos os contextos — é uma estimativa para conferência, não o valor
// final de faturamento (não considera habilitação do prestador, incrementos,
// UTI/leito, teto financeiro ou glosas administrativas).

function fmtMoedaOuTraco(v) {
  return v === null || v === undefined ? '—' : fmtMoeda(v);
}

const RELATORIO_ROTULO_STATUS = { erro: 'Erro', aviso: 'Aviso', ok: 'OK' };

function montarTabelaLinhasRelatorio(linhas, colunaChave) {
  const subtotal = linhas.reduce((s, l) => s + (l.valorTotal || 0), 0);
  return `
    <table class="guia-doc-tabela guia-doc-tabela-itens">
      <thead>
        <tr>
          <th>${escaparHtml(colunaChave)}</th><th>Tipo</th><th>Código</th><th>Descrição</th>
          <th>Qtd.</th><th>Valor unit.</th><th>Valor total</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${linhas.map((l) => `
          <tr>
            <td class="detail">${escaparHtml(l.chave || '—')}</td>
            <td>${escaparHtml(l.tipo)}</td>
            <td class="detail">${escaparHtml(l.codigo)}</td>
            <td>${escaparHtml(l.descricao)}${l.problemas && l.problemas.length ? `<br><span class="detail">${l.problemas.map(escaparHtml).join(' · ')}</span>` : ''}</td>
            <td>${l.quantidade}</td>
            <td>${fmtMoedaOuTraco(l.valorUnit)}</td>
            <td>${fmtMoedaOuTraco(l.valorTotal)}</td>
            <td>${RELATORIO_ROTULO_STATUS[l.status] || l.status}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="6">Subtotal</td><td>${fmtMoeda(subtotal)}</td><td></td></tr></tfoot>
    </table>`;
}

// Quebra o relatório por paciente (CNS, senão CPF, senão nome) para facilitar
// a conferência linha a linha pelo faturista. Linhas sem identificação de
// paciente (ex.: BPA-C, que é consolidado/sem paciente) caem num grupo à
// parte no fim do relatório.
function montarCorpoRelatorioPorPaciente(linhas, colunaChave) {
  const grupos = new Map();
  for (const l of linhas) {
    const chaveGrupo = l.cns || l.cpf || l.paciente || '__sem_identificacao__';
    if (!grupos.has(chaveGrupo)) grupos.set(chaveGrupo, { paciente: l.paciente, cns: l.cns, cpf: l.cpf, linhas: [] });
    grupos.get(chaveGrupo).linhas.push(l);
  }
  const entradas = [...grupos.values()].sort((a, b) => {
    if (!a.paciente && b.paciente) return 1;
    if (!b.paciente && a.paciente) return -1;
    return (a.paciente || '').localeCompare(b.paciente || '');
  });
  return entradas.map((g) => {
    const idTexto = g.cns ? `CNS ${g.cns}` : g.cpf ? `CPF ${g.cpf}` : '';
    return `
      <h3 class="guia-doc-paciente">${escaparHtml(g.paciente || 'Sem identificação individual de paciente')}${idTexto ? ` — ${escaparHtml(idTexto)}` : ''}</h3>
      ${montarTabelaLinhasRelatorio(g.linhas, colunaChave)}`;
  }).join('');
}

function montarRelatorioValidacaoHtml(dados) {
  const total = dados.linhas.reduce((s, l) => s + (l.valorTotal || 0), 0);
  const qtdErros = dados.linhas.filter((l) => l.status === 'erro').length;
  const qtdAvisos = dados.linhas.filter((l) => l.status === 'aviso').length;

  const corpo = dados.agruparPorPaciente
    ? montarCorpoRelatorioPorPaciente(dados.linhas, dados.colunaChave)
    : montarTabelaLinhasRelatorio(dados.linhas, dados.colunaChave);

  return `
    <div class="guia-doc-head">
      <h2>Relatório de conferência — ${escaparHtml(dados.titulo)}</h2>
      <p class="guia-doc-aviso">
        Gerado localmente pelo portal a partir do arquivo informado — não é um documento oficial do
        DATASUS/SISAIH. Valores estimados (${escaparHtml(dados.formulaValor)}) com base na tabela SIGTAP
        carregada; não consideram habilitação do prestador, incrementos, UTI/leito, teto financeiro ou
        glosas administrativas — use como apoio à conferência, não como valor final de faturamento.
      </p>
      <div class="guia-doc-meta">
        <span>Arquivo: <b>${escaparHtml(dados.nomeArquivo)}</b></span>
        <span>Instituição: <b>${escaparHtml(dados.instituicao || '—')}</b></span>
        <span>CGC/CPF: <b>${escaparHtml(dados.cgcCpf || '—')}</b></span>
        <span>Competência: <b>${escaparHtml(dados.competencia || '—')}</b></span>
        <span>Gerado em: <b>${escaparHtml(new Date().toLocaleString('pt-BR'))}</b></span>
        <span>${dados.linhas.length} linha(s) · ${qtdErros} com erro · ${qtdAvisos} com aviso</span>
      </div>
    </div>
    ${corpo}
    <div class="guia-doc-total-geral">Total geral estimado: <b>${fmtMoeda(total)}</b></div>`;
}

function gerarPdfValidacao(dados) {
  if (!dados) return;
  const guiaPrintAreaEl = document.getElementById('guia-print-area');
  guiaPrintAreaEl.innerHTML = montarRelatorioValidacaoHtml(dados);
  document.body.classList.add('modo-guia');
  window.print();
}

function bpaLinhasRelatorio(nomeArquivo) {
  const analise = bpaUltimoContexto.analises.find((a) => a.nomeArquivo === nomeArquivo);
  const resultado = bpaUltimoResultado.find((r) => r.nomeArquivo === nomeArquivo);
  if (!analise || !resultado) return null;
  const ctx = bpaUltimoContexto.ctx;
  const problemasPorOrdinal = new Map((resultado.linhasComProblema || []).map((l) => [l.ordinal, l]));

  const linhas = (analise.linhas || []).map((l) => {
    const c = l.campos;
    const sig = ctx.sigtapPorCodigo && ctx.sigtapPorCodigo.get(c.procedimento);
    const qtd = Number(c.quantidade) || 0;
    const valorUnit = sig ? (Number(sig.vl_sa) || 0) + (Number(sig.vl_sp) || 0) : null;
    const problema = problemasPorOrdinal.get(l.ordinal);
    return {
      chave: `Folha ${c.folha}/Seq ${c.seq}`, tipo: `BPA-${l.tipo}`, codigo: c.procedimento,
      descricao: (sig && sig.nome) || '(não encontrado na SIGTAP)', quantidade: qtd,
      valorUnit, valorTotal: valorUnit !== null ? valorUnit * qtd : null,
      status: problema ? (problema.erros.length ? 'erro' : 'aviso') : 'ok',
      problemas: problema ? [...problema.erros, ...problema.avisos] : [],
      // BPA-C é consolidado (sem paciente); só BPA-I traz nome/CNS/CPF.
      paciente: l.tipo === 'I' ? c.nomePaciente.trim() : undefined,
      cns: l.tipo === 'I' ? c.cnsPaciente : undefined,
      cpf: l.tipo === 'I' ? c.cpfPaciente : undefined,
    };
  });

  const c = analise.temCabecalho ? analise.cabecalho : null;
  return {
    titulo: 'Validador BPA', nomeArquivo, colunaChave: 'Folha/Seq',
    instituicao: c ? c.orgaoResp : '—', cgcCpf: c ? c.cgcCpf : '', competencia: c ? c.competencia : '',
    linhas, formulaValor: 'SA + SP', agruparPorPaciente: true,
  };
}

// O layout do AIH não traz o nome do estabelecimento no arquivo — só CNES +
// código do município. Para o relatório de conferência, resolvemos o nome
// consultando o CNESNet público do DATASUS (server-side, com cache), usando
// justamente o par (município, CNES) que o arquivo já traz.
async function aihConsultarNomesCnes(municipiosCnes) {
  if (municipiosCnes.length === 0) return new Map();
  try {
    const resp = await fetch('/api/cnes/lote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itens: municipiosCnes.map(([municipio, cnes]) => ({ municipio, cnes })) }),
    });
    const dados = await resp.json();
    return new Map((Array.isArray(dados) ? dados : []).map((d) => [`${d.municipio}${d.cnes}`, d.nome]));
  } catch {
    return new Map();
  }
}

async function aihLinhasRelatorio(nomeArquivo) {
  const analise = aihUltimoContexto.analises.find((a) => a.nomeArquivo === nomeArquivo);
  const resultado = aihUltimoResultado.find((r) => r.nomeArquivo === nomeArquivo);
  if (!analise || !resultado) return null;
  const ctx = aihUltimoContexto.ctx;
  const problemasPorOrdinal = new Map((resultado.registrosComProblema || []).map((r) => [r.ordinal, r]));

  const linhas = [];
  const cnesMunSet = new Map(); // cnes -> município (para consultar o nome depois)
  let competencia = '';
  for (const r of analise.registros) {
    if (r.tipo !== '01' && r.tipo !== '03' && r.tipo !== '05') continue;
    cnesMunSet.set(r.campos.cnesHosp, r.campos.munHosp);
    competencia = competencia || r.campos.apresLote;
    const problema = problemasPorOrdinal.get(r.ordinal);
    const statusReg = problema ? (problema.erros.length ? 'erro' : 'aviso') : 'ok';
    const problemasTexto = problema ? [...problema.erros, ...problema.avisos] : [];
    const paciente = r.campos.nmPaciente.trim();
    const cns = r.campos.nuCns;

    const sigPrin = ctx.sigtapPorCodigo && ctx.sigtapPorCodigo.get(r.campos.procRealizado);
    const valorUnitPrin = sigPrin ? (Number(sigPrin.vl_sh) || 0) + (Number(sigPrin.vl_sp) || 0) : null;
    linhas.push({
      chave: r.campos.nuAih, tipo: 'Procedimento realizado', codigo: r.campos.procRealizado,
      descricao: (sigPrin && sigPrin.nome) || '(não encontrado na SIGTAP)', quantidade: 1,
      valorUnit: valorUnitPrin, valorTotal: valorUnitPrin, status: statusReg, problemas: problemasTexto,
      paciente, cns,
    });

    r.ocorrencias.forEach((o, idx) => {
      if (!/^\d{10}$/.test(o.codProced) || o.codProced === '0000000000') return;
      const sig = ctx.sigtapPorCodigo && ctx.sigtapPorCodigo.get(o.codProced);
      const qtd = Number(o.qtdProced) || 0;
      const valorUnit = sig ? (Number(sig.vl_sh) || 0) + (Number(sig.vl_sp) || 0) : null;
      linhas.push({
        chave: r.campos.nuAih, tipo: `Proc. secundário ${idx + 1}`, codigo: o.codProced,
        descricao: (sig && sig.nome) || '(não encontrado na SIGTAP)', quantidade: qtd,
        valorUnit, valorTotal: valorUnit !== null ? valorUnit * qtd : null, status: 'ok', problemas: [],
        paciente, cns,
      });
    });
  }

  const nomesCnes = await aihConsultarNomesCnes([...cnesMunSet].map(([cnes, mun]) => [mun, cnes]));
  const instituicaoTexto = [...cnesMunSet.keys()].map((cnes) => {
    const nome = nomesCnes.get(`${cnesMunSet.get(cnes)}${cnes}`);
    return nome ? `${nome} (CNES ${cnes})` : `CNES ${cnes}`;
  }).join(', ') || '—';

  return {
    titulo: 'Validador AIH', nomeArquivo, colunaChave: 'AIH',
    instituicao: instituicaoTexto, cgcCpf: '', competencia, linhas, formulaValor: 'SH + SP',
    agruparPorPaciente: true,
  };
}

function apacLinhasRelatorio(nomeArquivo) {
  const analise = apacUltimoContexto.analises.find((a) => a.nomeArquivo === nomeArquivo);
  const resultado = apacUltimoResultado.find((r) => r.nomeArquivo === nomeArquivo);
  if (!analise || !resultado) return null;
  const ctx = apacUltimoContexto.ctx;
  const problemasPorOrdinal = new Map((resultado.registrosComProblema || []).map((r) => [r.ordinal, r]));

  // Ações (tipo 13) não carregam paciente/CNS — só o corpo (tipo 14) tem.
  // O vínculo entre os dois é o número da APAC (apa_num), repetido em ambos.
  const pacientePorApac = new Map();
  for (const r of analise.registros) {
    if (r.tipo === '14') pacientePorApac.set(r.campos.apaNum, { paciente: r.campos.apaNomepcnte.trim(), cns: r.campos.apaCnspct, cpf: r.campos.apaCpfpcnte });
  }

  const linhas = [];
  for (const r of analise.registros) {
    if (r.tipo !== '14' && r.tipo !== '13') continue;
    const problema = problemasPorOrdinal.get(r.ordinal);
    const status = problema ? (problema.erros.length ? 'erro' : 'aviso') : 'ok';
    const problemasTexto = problema ? [...problema.erros, ...problema.avisos] : [];
    const idPaciente = pacientePorApac.get(r.tipo === '14' ? r.campos.apaNum : r.campos.papNum) || {};

    if (r.tipo === '14') {
      const sig = ctx.sigtapPorCodigo && ctx.sigtapPorCodigo.get(r.campos.apaCodprinc);
      const valorUnit = sig ? (Number(sig.vl_sa) || 0) + (Number(sig.vl_sp) || 0) : null;
      linhas.push({
        chave: r.campos.apaNum, tipo: 'Procedimento principal', codigo: r.campos.apaCodprinc,
        descricao: (sig && sig.nome) || '(não encontrado na SIGTAP)', quantidade: 1,
        valorUnit, valorTotal: valorUnit, status, problemas: problemasTexto, ...idPaciente,
      });
    } else {
      const sig = ctx.sigtapPorCodigo && ctx.sigtapPorCodigo.get(r.campos.papCodproc);
      const qtd = Number(r.campos.papQtdprod) || 0;
      const valorUnit = sig ? (Number(sig.vl_sa) || 0) + (Number(sig.vl_sp) || 0) : null;
      linhas.push({
        chave: r.campos.papNum, tipo: 'Ação/procedimento', codigo: r.campos.papCodproc,
        descricao: (sig && sig.nome) || '(não encontrado na SIGTAP)', quantidade: qtd,
        valorUnit, valorTotal: valorUnit !== null ? valorUnit * qtd : null, status, problemas: problemasTexto, ...idPaciente,
      });
    }
  }

  const c = analise.temCabecalho ? analise.cabecalho : null;
  return {
    titulo: 'Validador APAC', nomeArquivo, colunaChave: 'APAC',
    instituicao: c ? c.cbcRsp : '—', cgcCpf: c ? c.cbcCgccpf : '', competencia: c ? c.cbcCmp : '',
    linhas, formulaValor: 'SA + SP', agruparPorPaciente: true,
  };
}

carregarEdicoes();
