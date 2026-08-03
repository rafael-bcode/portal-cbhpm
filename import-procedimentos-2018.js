require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ARQUIVO = 'cbhpm2018_dados.json';

async function importarProcedimentos2022() {
  const dados = JSON.parse(fs.readFileSync(ARQUIVO, 'utf-8'));
  console.log(`Lidos ${dados.length} registros de ${ARQUIVO}. Inserindo em lote...`);

  const codigos = dados.map((d) => d.codigo);
  const descricoes = dados.map((d) => d.descricao);

  await pool.query(
    `INSERT INTO procedimentos (codigo, descricao)
     SELECT * FROM UNNEST($1::bigint[], $2::text[])
     ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao`,
    [codigos, descricoes]
  );

  console.log(`\nConcluído! ${dados.length} procedimentos processados.`);
  await pool.end();
}

importarProcedimentos2022().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
