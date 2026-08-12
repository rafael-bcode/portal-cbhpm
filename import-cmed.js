// Importação manual do Preço-teto CMED a partir de um arquivo local já
// baixado (TA_PRECO_MEDICAMENTO.csv, mesmo layout do dados.anvisa.gov.br) —
// útil offline ou pra reprocessar um arquivo específico. Em produção, a
// atualização normal roda via cmed-atualizador.js (rotina automática ou
// botão "Atualizar" na tela), que baixa direto da ANVISA.
require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');
const { parseCmedCsv, importarCmed } = require('./cmed-atualizador');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ARQUIVO = 'TA_PRECO_MEDICAMENTO.csv';

async function importar() {
  const texto = fs.readFileSync(ARQUIVO, 'utf8');
  const { cols, totalLinhas, totalRegistros } = parseCmedCsv(texto);
  console.log(`Lidas ${totalLinhas} linhas, ${totalRegistros} registros únicos (por código GGREM). Inserindo em lote...`);

  await importarCmed(pool, cols);
  await pool.query(
    `INSERT INTO cmed_metadata (id, atualizado_em, total_registros) VALUES (1, now(), $1)
     ON CONFLICT (id) DO UPDATE SET atualizado_em = now(), total_registros = EXCLUDED.total_registros`,
    [totalRegistros]
  );

  console.log(`\nImportação concluída! ${totalRegistros} apresentações de medicamentos (CMED) inseridas/atualizadas.`);
  await pool.end();
}

importar().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
