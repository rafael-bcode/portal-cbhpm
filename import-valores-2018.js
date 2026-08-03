require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ARQUIVO = 'cbhpm2018_dados.json';
const NOME_EDICAO = '2018';

// Converte valores em formato brasileiro (vírgula decimal) ou "–"/"*" para número
function parseNumero(valor) {
  if (valor === null || valor === undefined) return 0;
  const s = valor.toString().trim();
  if (s === '' || s === '–' || s === '-' || s === '*') return 0;
  const n = Number(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

async function importarValores2022() {
  const { rows: edicaoRows } = await pool.query('SELECT id FROM edicoes WHERE nome = $1', [NOME_EDICAO]);
  if (edicaoRows.length === 0) {
    throw new Error(`Edição "${NOME_EDICAO}" não encontrada. Rode o setup-edicao-2022.js primeiro.`);
  }
  const edicaoId = edicaoRows[0].id;

  const { rows: portesRows } = await pool.query(
    'SELECT porte, valor FROM tabela_porte WHERE edicao_id = $1',
    [edicaoId]
  );
  const valorPorteMap = new Map(portesRows.map((p) => [p.porte, Number(p.valor)]));
  const valorUco = valorPorteMap.get('UCO') || 0;

  const dados = JSON.parse(fs.readFileSync(ARQUIVO, 'utf-8'));
  console.log(`Lidos ${dados.length} registros. Calculando e importando...`);

  const cols = {
    codigo: [], edicao_id: [], descricao: [], porte: [], fracao_porte: [],
    valor_porte: [], total_porte: [], incidencias: [], filme: [], total_filme: [],
    uco: [], total_uco: [], porte_anestesico: [], valor_porte_anestesico: [],
    total_porte_anestesico: [], numero_auxiliares: [], total_auxiliares: [],
    total_1_auxiliar: [], total_2_auxiliar: [], total_3_auxiliar: [], total_4_auxiliar: [],
    subtotal: [],
  };

  for (const item of dados) {
    const porte = (item.porte === '–' || item.porte === '-') ? null : item.porte;
    const fracao = 1; // documento não traz conceito de fração — sempre porte cheio
    const valorPorteUnitario = porte ? (valorPorteMap.get(porte) || 0) : 0;
    const totalPorte = fracao * valorPorteUnitario;

    const uco = parseNumero(item.custo);
    const totalUco = uco * valorUco;

    const filme = parseNumero(item.filme);
    const incidencias = parseNumero(item.incid);
    const numeroAuxiliares = parseNumero(item.aux);
    const porteAnestesico = (item.anest && item.anest !== '–' && item.anest !== '-')
      ? item.anest.toString()
      : null;

    const subtotal = totalPorte + totalUco;

    cols.codigo.push(item.codigo);
    cols.edicao_id.push(edicaoId);
    cols.descricao.push(item.descricao);
    cols.porte.push(porte);
    cols.fracao_porte.push(fracao);
    cols.valor_porte.push(valorPorteUnitario);
    cols.total_porte.push(totalPorte);
    cols.incidencias.push(incidencias);
    cols.filme.push(filme);
    cols.total_filme.push(null);
    cols.uco.push(uco);
    cols.total_uco.push(totalUco);
    cols.porte_anestesico.push(porteAnestesico);
    cols.valor_porte_anestesico.push(null);
    cols.total_porte_anestesico.push(null);
    cols.numero_auxiliares.push(numeroAuxiliares);
    cols.total_auxiliares.push(0);
    cols.total_1_auxiliar.push(null);
    cols.total_2_auxiliar.push(null);
    cols.total_3_auxiliar.push(null);
    cols.total_4_auxiliar.push(null);
    cols.subtotal.push(subtotal);
  }

  await pool.query(
    `INSERT INTO valores_procedimento (
      codigo, edicao_id, descricao, porte, fracao_porte, valor_porte, total_porte,
      incidencias, filme, total_filme, uco, total_uco, porte_anestesico,
      valor_porte_anestesico, total_porte_anestesico, numero_auxiliares,
      total_auxiliares, total_1_auxiliar, total_2_auxiliar, total_3_auxiliar,
      total_4_auxiliar, subtotal
    )
    SELECT * FROM UNNEST (
      $1::bigint[], $2::int[], $3::text[], $4::varchar[], $5::numeric[], $6::numeric[],
      $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::numeric[],
      $12::numeric[], $13::varchar[], $14::numeric[], $15::numeric[], $16::int[],
      $17::numeric[], $18::numeric[], $19::numeric[], $20::numeric[], $21::numeric[],
      $22::numeric[]
    )
    ON CONFLICT (codigo, edicao_id) DO NOTHING`,
    [
      cols.codigo, cols.edicao_id, cols.descricao, cols.porte, cols.fracao_porte,
      cols.valor_porte, cols.total_porte, cols.incidencias, cols.filme, cols.total_filme,
      cols.uco, cols.total_uco, cols.porte_anestesico, cols.valor_porte_anestesico,
      cols.total_porte_anestesico, cols.numero_auxiliares, cols.total_auxiliares,
      cols.total_1_auxiliar, cols.total_2_auxiliar, cols.total_3_auxiliar,
      cols.total_4_auxiliar, cols.subtotal,
    ]
  );

  console.log(`\nImportação concluída! ${cols.codigo.length} registros inseridos.`);
  await pool.end();
}

importarValores2022().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
