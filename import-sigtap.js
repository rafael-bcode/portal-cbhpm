require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ARQUIVO = 'sigtap_procedimentos.json';

async function importar() {
  const dados = JSON.parse(fs.readFileSync(ARQUIVO, 'utf-8'));
  console.log(`Lidos ${dados.length} registros. Inserindo em lote...`);

  const cols = {
    codigo: [], nome: [], complexidade: [], sexo: [], qt_maxima_execucao: [],
    qt_dias_permanencia: [], qt_pontos: [], idade_minima_meses: [], idade_maxima_meses: [],
    idade_minima_legivel: [], idade_maxima_legivel: [], vl_sh: [], vl_sa: [], vl_sp: [],
    financiamento: [], rubrica: [], tempo_permanencia: [],
  };

  for (const r of dados) {
    cols.codigo.push(r.codigo);
    cols.nome.push(r.nome);
    cols.complexidade.push(r.complexidade || null);
    cols.sexo.push(r.sexo || null);
    cols.qt_maxima_execucao.push(r.qt_maxima_execucao);
    cols.qt_dias_permanencia.push(r.qt_dias_permanencia);
    cols.qt_pontos.push(r.qt_pontos);
    cols.idade_minima_meses.push(r.idade_minima_meses);
    cols.idade_maxima_meses.push(r.idade_maxima_meses);
    cols.idade_minima_legivel.push(r.idade_minima_legivel);
    cols.idade_maxima_legivel.push(r.idade_maxima_legivel);
    cols.vl_sh.push(r.vl_sh);
    cols.vl_sa.push(r.vl_sa);
    cols.vl_sp.push(r.vl_sp);
    cols.financiamento.push(r.financiamento || null);
    cols.rubrica.push(r.rubrica || null);
    cols.tempo_permanencia.push(r.tempo_permanencia);
  }

  await pool.query(
    `INSERT INTO sigtap_procedimentos (
      codigo, nome, complexidade, sexo, qt_maxima_execucao, qt_dias_permanencia,
      qt_pontos, idade_minima_meses, idade_maxima_meses, idade_minima_legivel,
      idade_maxima_legivel, vl_sh, vl_sa, vl_sp, financiamento, rubrica, tempo_permanencia
    )
    SELECT * FROM UNNEST (
      $1::varchar[], $2::text[], $3::varchar[], $4::varchar[], $5::int[], $6::int[],
      $7::int[], $8::int[], $9::int[], $10::varchar[], $11::varchar[], $12::numeric[],
      $13::numeric[], $14::numeric[], $15::varchar[], $16::varchar[], $17::int[]
    )
    ON CONFLICT (codigo) DO UPDATE SET
      nome = EXCLUDED.nome, vl_sh = EXCLUDED.vl_sh, vl_sa = EXCLUDED.vl_sa, vl_sp = EXCLUDED.vl_sp`,
    [
      cols.codigo, cols.nome, cols.complexidade, cols.sexo, cols.qt_maxima_execucao,
      cols.qt_dias_permanencia, cols.qt_pontos, cols.idade_minima_meses, cols.idade_maxima_meses,
      cols.idade_minima_legivel, cols.idade_maxima_legivel, cols.vl_sh, cols.vl_sa, cols.vl_sp,
      cols.financiamento, cols.rubrica, cols.tempo_permanencia,
    ]
  );

  console.log(`\nImportação concluída! ${dados.length} procedimentos SIGTAP inseridos.`);
  await pool.end();
}

importar().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
