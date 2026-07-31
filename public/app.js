const listaEdicoesEl = document.getElementById('lista-edicoes');
const formEl = document.getElementById('form-consulta');
const resultadoAreaEl = document.getElementById('resultado-area');
const buscaInputEl = document.getElementById('busca-descricao');
const buscaResultadosEl = document.getElementById('busca-resultados');
const codigoInputEl = document.getElementById('codigo');

const fmtMoeda = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let edicoesDisponiveis = [];
let debounceTimer = null;

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
  } catch (err) {
    listaEdicoesEl.innerHTML = '<span class="loading-text">Erro ao carregar edições.</span>';
    console.error(err);
  }
}

document.getElementById('btn-todas').addEventListener('click', () => {
  document.querySelectorAll('input[name="edicao"]').forEach((cb) => (cb.checked = true));
});
document.getElementById('btn-nenhuma').addEventListener('click', () => {
  document.querySelectorAll('input[name="edicao"]').forEach((cb) => (cb.checked = false));
});

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

  resultadoAreaEl.innerHTML = `
    <div class="resultado-header">
      <h2>Código <span class="codigo-tag">${data.codigo}</span></h2>
    </div>
    <div class="cards-grid">${cards}</div>
  `;

  montarDashboard(data);
}

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

carregarEdicoes();
