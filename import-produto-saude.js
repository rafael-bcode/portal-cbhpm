// Importação manual de Produtos para Saúde (OPME e demais) a partir de um
// arquivo local já baixado (TA_PRODUTO_SAUDE_SITE.csv, mesmo layout do
// dados.anvisa.gov.br) — útil offline ou pra reprocessar um arquivo
// específico. Em produção, a atualização normal roda via
// produto-saude-atualizador.js (rotina automática ou botão "Atualizar" na
// tela), que baixa direto da ANVISA.
require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');
const { parseProdutoSaudeCsv, importarProdutoSaude } = require('./produto-saude-atualizador');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ARQUIVO = process.argv[2] || 'TA_PRODUTO_SAUDE_SITE.csv';

async function importar() {
  const texto = fs.readFileSync(ARQUIVO, 'latin1');
  const { cols, totalLinhas, totalRegistros } = parseProdutoSaudeCsv(texto);
  console.log(`Lidas ${totalLinhas} linhas, ${totalRegistros} registros. Inserindo em lotes...`);

  await importarProdutoSaude(pool, cols);
  await pool.query(
    `INSERT INTO produto_saude_metadata (id, atualizado_em, total_registros) VALUES (1, now(), $1)
     ON CONFLICT (id) DO UPDATE SET atualizado_em = now(), total_registros = EXCLUDED.total_registros`,
    [totalRegistros]
  );

  console.log(`\nImportação concluída! ${totalRegistros} produtos para saúde (ANVISA) inseridos.`);
  await pool.end();
}

importar().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
