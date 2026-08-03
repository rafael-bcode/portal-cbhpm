// Testes de regressão da lógica de cálculo (server.js).
// Usa os valores oficiais da CBHPM já conferidos manualmente nesta sessão como
// oráculo — se a lógica de cálculo mudar de forma incorreta no futuro, estes
// testes quebram. Precisa de DATABASE_URL válido (.env) — são testes de
// integração contra o Supabase, não mocks.
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

let baseUrl;
let server;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function post(caminho, corpo) {
  const resp = await fetch(`${baseUrl}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return { status: resp.status, corpo: await resp.json() };
}

// Busca pelo ano em vez do nome exato: o nome carrega o número da edição
// oficial (ex: "8ª Edição - 2015") e pode mudar de redação sem que o ano de
// referência mude. Ignora as entradas "Reajuste ..." (não são edições reais,
// são o catálogo de uma edição reprecificado por comunicados de correção).
async function edicaoIdPorAno(ano) {
  const resp = await fetch(`${baseUrl}/api/edicoes`);
  const edicoes = await resp.json();
  const edicao = edicoes.find((e) => e.ano_inicio === ano && !e.nome.startsWith('Reajuste'));
  if (!edicao) throw new Error(`Edição com ano_inicio ${ano} não encontrada — ajuste o teste.`);
  return edicao.id;
}

test('GET /api/edicoes retorna lista não vazia com id/nome/ano_inicio', async () => {
  const resp = await fetch(`${baseUrl}/api/edicoes`);
  assert.equal(resp.status, 200);
  const edicoes = await resp.json();
  assert.ok(Array.isArray(edicoes) && edicoes.length > 0);
  assert.ok('id' in edicoes[0] && 'nome' in edicoes[0] && 'ano_inicio' in edicoes[0]);
});

test('consultar-procedimento: Cesariana (31309054) na edição 2004 bate com a planilha oficial', async () => {
  const edicaoId = await edicaoIdPorAno(2004);
  const { status, corpo } = await post('/api/consultar-procedimento', {
    codigo: 31309054,
    edicoes: [edicaoId],
  });
  assert.equal(status, 200);
  const r = corpo.resultados[0];
  // Sem nenhum ajuste percentual, o subtotal deve bater com o valor original da planilha.
  assert.equal(r.cirurgiao.subtotal, r.cirurgiao.subtotal_original_planilha);
  assert.equal(r.cirurgiao.subtotal, 422.4);
  assert.equal(r.anestesista.aplicavel, true);
  assert.equal(r.anestesista.total, 374);
});

test('consultar-procedimento: código inexistente retorna 404', async () => {
  const { status, corpo } = await post('/api/consultar-procedimento', {
    codigo: 999999999,
    edicoes: [1],
  });
  assert.equal(status, 404);
  assert.ok(corpo.erro);
});

test('consultar-multiplos-procedimentos: via de acesso (mesma via, 50%) bate com o cálculo manual', async () => {
  const edicaoId = await edicaoIdPorAno(2015);
  const { status, corpo } = await post('/api/consultar-multiplos-procedimentos', {
    edicaoId,
    procedimentos: [
      { codigo: 31309054, relacao: 'principal' },
      { codigo: 40701018, relacao: 'mesma_via' },
    ],
  });
  assert.equal(status, 200);

  const [principal, secundario] = corpo.procedimentos;
  assert.equal(principal.percentual_relacao, 100);
  assert.equal(principal.porte.total_pago, 832.87);
  assert.equal(secundario.percentual_relacao, 50);
  assert.equal(secundario.porte.total_pago, 35.03);
  assert.equal(secundario.uco.total, 103.58); // UCO não é reduzido pela via

  // Porte anestésico é cobrado uma única vez por sessão (maior valor, não soma).
  assert.equal(corpo.sessao.anestesista.aplicavel, true);
  assert.equal(corpo.sessao.anestesista.total, 735.87);

  // Base de cálculo da equipe = soma dos portes já ponderados pela via.
  assert.equal(corpo.sessao.equipe.base_calculo, 789);
  assert.equal(corpo.sessao.cirurgiao.subtotal, 971.48);
});

test('consultar-multiplos-procedimentos: exige exatamente 1 principal', async () => {
  const edicaoId = await edicaoIdPorAno(2015);
  const { status, corpo } = await post('/api/consultar-multiplos-procedimentos', {
    edicaoId,
    procedimentos: [
      { codigo: 31309054, relacao: 'mesma_via' },
      { codigo: 40701018, relacao: 'mesma_via' },
    ],
  });
  assert.equal(status, 400);
  assert.ok(corpo.erro);
});
