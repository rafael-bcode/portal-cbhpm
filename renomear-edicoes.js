require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Renomeia as edições (id -> nome) para reintroduzir o número da edição oficial
// da CBHPM na frente do ano, facilitando a identificação na lista de checkboxes.
// O ordinal de 2018 não pôde ser confirmado nas fontes pesquisadas, por isso
// fica sem número (em vez de arriscar um número errado).
// As entradas "Reajuste ..." não são edições novas: são o catálogo da 11ª
// Edição (2022) reprecificado pelos comunicados de correção INPC/IBGE
// periódicos — o rótulo deixa isso explícito para não parecerem edições reais.
const NOVOS_NOMES = {
  1: '3ª Edição - 2004',
  2: '4ª Edição - 2005',
  3: '4ª Edição - 2006',
  4: '4ª Edição - 2007',
  5: '5ª Edição - 2008',
  6: '5ª Edição - 2009',
  7: '6ª Edição - 2010',
  8: '6ª Edição - 2011',
  9: '7ª Edição - 2012',
  10: '7ª Edição - 2013',
  11: '8ª Edição - 2014',
  12: '8ª Edição - 2015',
  13: '9ª Edição - 2016',
  14: '9ª Edição - 2017',
  17: 'Edição 2018',
  15: '10ª Edição - 2020',
  18: 'Reajuste 2020-2021 (11ª Edição)',
  16: '11ª Edição - 2022',
  19: 'Reajuste 2022-2023 (11ª Edição)',
  20: 'Reajuste 2023-2024 (11ª Edição)',
  21: 'Reajuste 2025-2026 (11ª Edição)',
};

async function renomear() {
  const { rows: existentes } = await pool.query('SELECT id, nome FROM edicoes');
  const idsConhecidos = new Set(existentes.map((e) => e.id));
  const idsFaltando = Object.keys(NOVOS_NOMES).map(Number).filter((id) => !idsConhecidos.has(id));
  if (idsFaltando.length > 0) {
    throw new Error(`ids não encontrados na tabela edicoes: ${idsFaltando.join(', ')}. Confira antes de renomear.`);
  }

  let alterados = 0;
  for (const [id, novoNome] of Object.entries(NOVOS_NOMES)) {
    const { rowCount } = await pool.query(
      'UPDATE edicoes SET nome = $1 WHERE id = $2 AND nome IS DISTINCT FROM $1',
      [novoNome, Number(id)]
    );
    alterados += rowCount;
  }

  console.log(`${alterados} edições renomeadas.`);
  const { rows } = await pool.query('SELECT id, nome, ano_inicio, ano_fim FROM edicoes ORDER BY ano_inicio, id');
  console.table(rows);
  await pool.end();
}

renomear().catch((err) => {
  console.error('Erro:', err);
  pool.end();
});
