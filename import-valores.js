require('dotenv').config();
const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ARQUIVO = 'Planilha-CBHPM-Comparativo-2004-ate-2017.xlsx';

// Converte valor de célula em número seguro (null/undefined/vazio -> null)
function num(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return isNaN(n) ? null : n;
}

async function importarValores() {
  const workbook = XLSX.readFile(ARQUIVO);
  const nomesAbas = workbook.SheetNames.filter((nome) => nome !== 'Plan2');

  const { rows: edicoesDb } = await pool.query('SELECT id, nome FROM edicoes');
  const edicaoIdPorNome = new Map(edicoesDb.map((e) => [e.nome, e.id]));

  let totalGeral = 0;

  for (const nomeAba of nomesAbas) {
    const edicaoId = edicaoIdPorNome.get(nomeAba);
    if (!edicaoId) {
      console.warn(`Aviso: edição "${nomeAba}" não encontrada no banco. Pulando.`);
      continue;
    }

    const sheet = workbook.Sheets[nomeAba];
    const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Colunas fixas (posição), da linha 1 em diante (linha 0 é o cabeçalho)
    const registros = [];
    for (let i = 1; i < linhas.length; i++) {
      const l = linhas[i];
      const codigo = l[0];
      if (codigo === null || codigo === undefined || codigo === '') continue; // fim dos dados

      registros.push({
        codigo: Number(codigo),
        descricao: (l[1] ?? '').toString().trim(),
        porte: l[2]?.toString() ?? null,
        fracao_porte: num(l[3]),
        valor_porte: num(l[4]),
        total_porte: num(l[5]),
        incidencias: num(l[6]),
        filme: num(l[7]),
        total_filme: num(l[8]),
        uco: num(l[9]),
        total_uco: num(l[10]),
        porte_anestesico: l[11]?.toString() ?? null,
        valor_porte_anestesico: num(l[12]),
        total_porte_anestesico: num(l[13]),
        numero_auxiliares: num(l[14]),
        total_auxiliares: num(l[15]),
        total_1_auxiliar: num(l[16]),
        total_2_auxiliar: num(l[17]),
        total_3_auxiliar: num(l[18]),
        total_4_auxiliar: num(l[19]),
        subtotal: num(l[20]) ?? 0,
      });
    }

    if (registros.length === 0) {
      console.log(`Aba "${nomeAba}": nenhum registro encontrado.`);
      continue;
    }

    // Monta arrays para inserção em lote via UNNEST
    const cols = {
      codigo: [], edicao_id: [], descricao: [], porte: [], fracao_porte: [],
      valor_porte: [], total_porte: [], incidencias: [], filme: [], total_filme: [],
      uco: [], total_uco: [], porte_anestesico: [], valor_porte_anestesico: [],
      total_porte_anestesico: [], numero_auxiliares: [], total_auxiliares: [],
      total_1_auxiliar: [], total_2_auxiliar: [], total_3_auxiliar: [], total_4_auxiliar: [],
      subtotal: [],
    };

    for (const r of registros) {
      cols.codigo.push(r.codigo);
      cols.edicao_id.push(edicaoId);
      cols.descricao.push(r.descricao);
      cols.porte.push(r.porte);
      cols.fracao_porte.push(r.fracao_porte);
      cols.valor_porte.push(r.valor_porte);
      cols.total_porte.push(r.total_porte);
      cols.incidencias.push(r.incidencias);
      cols.filme.push(r.filme);
      cols.total_filme.push(r.total_filme);
      cols.uco.push(r.uco);
      cols.total_uco.push(r.total_uco);
      cols.porte_anestesico.push(r.porte_anestesico);
      cols.valor_porte_anestesico.push(r.valor_porte_anestesico);
      cols.total_porte_anestesico.push(r.total_porte_anestesico);
      cols.numero_auxiliares.push(r.numero_auxiliares);
      cols.total_auxiliares.push(r.total_auxiliares);
      cols.total_1_auxiliar.push(r.total_1_auxiliar);
      cols.total_2_auxiliar.push(r.total_2_auxiliar);
      cols.total_3_auxiliar.push(r.total_3_auxiliar);
      cols.total_4_auxiliar.push(r.total_4_auxiliar);
      cols.subtotal.push(r.subtotal);
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

    totalGeral += registros.length;
    console.log(`Aba "${nomeAba}": ${registros.length} registros inseridos. Total geral: ${totalGeral}`);
  }

  console.log(`\nImportação concluída! ${totalGeral} registros no total.`);
  await pool.end();
}

importarValores().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
