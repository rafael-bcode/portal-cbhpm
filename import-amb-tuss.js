require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ARQUIVO = 'amb_tuss_dados.json';

async function importar() {
  const dados = JSON.parse(fs.readFileSync(ARQUIVO, 'utf-8'));
  console.log(`Lidos ${dados.length} registros. Inserindo em lote...`);

  const cols = {
    codigo_cbhpm: [], codigo_amb90: [], codigo_amb92: [], codigo_amb96: [],
    codigo_amb99: [], codigo_tuss: [], procedimento: [], procedimento_tuss: [],
  };

  for (const r of dados) {
    cols.codigo_cbhpm.push(r.cbhpm ? Number(r.cbhpm) : null);
    cols.codigo_amb90.push(r.amb90);
    cols.codigo_amb92.push(r.amb92);
    cols.codigo_amb96.push(r.amb96);
    cols.codigo_amb99.push(r.amb99);
    cols.codigo_tuss.push(r.tuss);
    cols.procedimento.push(r.procedimento);
    cols.procedimento_tuss.push(r.procedimento_tuss);
  }

  await pool.query(
    `INSERT INTO mapeamento_amb_tuss (
      codigo_cbhpm, codigo_amb90, codigo_amb92, codigo_amb96, codigo_amb99,
      codigo_tuss, procedimento, procedimento_tuss
    )
    SELECT * FROM UNNEST (
      $1::bigint[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[],
      $6::varchar[], $7::text[], $8::text[]
    )`,
    [
      cols.codigo_cbhpm, cols.codigo_amb90, cols.codigo_amb92, cols.codigo_amb96,
      cols.codigo_amb99, cols.codigo_tuss, cols.procedimento, cols.procedimento_tuss,
    ]
  );

  console.log(`\nImportação concluída! ${dados.length} registros inseridos.`);
  await pool.end();
}

importar().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
