const listaEdicoesEl = document.getElementById('lista-edicoes');
const formEl = document.getElementById('form-consulta');
const resultadoAreaEl = document.getElementById('resultado-area');

const fmtMoeda = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let edicoesDisponiveis = [];

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

function renderizarResultado(data) {
  if (data.erro) {
    resultadoAreaEl.innerHTML = `<div class="msg erro">${data.erro}</div>`;
    return;
  }

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

      return `
        <div class="edicao-card">
          <div class="edicao-card-head">
            <span class="nome">${r.edicao}</span>
            <span class="ano">${r.ano}</span>
          </div>
          <div class="edicao-card-desc">${r.descricao}</div>
          <div class="breakdown">
            ${linha('Porte', r.porte, `${r.porte.classificacao ?? '—'} · fração ${r.porte.fracao} × ${fmtMoeda(r.porte.valor_unitario)}`, true)}
            ${linha('UCO', r.uco, `qtd ${r.uco.quantidade} × ${fmtMoeda(r.uco.valor_unitario_referencia)}`, true)}
            ${linha('Porte Anestésico', r.porte_anestesico, `classe ${r.porte_anestesico.classificacao ?? '—'} · ${fmtMoeda(r.porte_anestesico.valor_unitario)}`, true)}
            ${linha('Filme', r.filme, `${r.filme.quantidade_m2} m² × ${fmtMoeda(r.filme.valor_informado)}`, true)}
            ${linha('Auxiliares', r.auxiliares, `qtd ${r.auxiliares.quantidade}`, false)}
          </div>
          <div class="total-row">
            <span class="label">Total calculado</span>
            <div style="text-align:right">
              <div class="value">${fmtMoeda(r.subtotal_calculado)}</div>
            </div>
          </div>
        </div>`;
    })
    .join('');

  resultadoAreaEl.innerHTML = `
    <div class="resultado-header">
      <h2>Código <span class="codigo-tag">${data.codigo}</span></h2>
    </div>
    <div class="cards-grid">${cards}</div>
  `;
}

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
    renderizarResultado(data);
  } catch (err) {
    resultadoAreaEl.innerHTML = '<div class="msg erro">Erro ao consultar o servidor.</div>';
    console.error(err);
  }
});

carregarEdicoes();
