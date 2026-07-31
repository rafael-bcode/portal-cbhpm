require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Valores de Porte -> R$ conforme Comunicado Oficial CBHPM (vigência a partir de out/2021)
const TABELA_PORTE_2022 = {
  '1A': 27.00, '1B': 74.58, '1C': 106.83,
  '2A': 158.30, '2B': 249.14, '2C': 339.66,
  '3A': 486.63, '3B': 633.61, '3C': 780.58,
  '4A': 927.55, '4B': 1074.52, '4C': 1221.49,
  '5A': 1368.45, '5B': 1515.43, '5C': 1662.40,
  '6A': 1809.37, '6B': 1956.34, '6C': 2103.31,
  '7A': 2250.29, '7B': 2397.26, '7C': 2544.23,
  '8A': 2691.20, '8B': 2838.16, '8C': 2985.13,
  '9A': 3132.11, '9B': 3279.08, '9C': 3426.05,
  '10A': 3573.02, '10B': 3719.99, '10C': 3866.96,
  '11A': 4013.94, '11B': 4160.90, '11C': 4307.87,
  '12A': 4454.84, '12B': 4601.81, '12C': 4748.78,
  '13A': 4895.76, '13B': 5042.73, '13C': 5189.70,
  '14A': 5336.67, '14B': 5483.64, '14C': 5630.60,
  'UCO': 24.24,
};

async function setup() {
  // Atualiza o fim de vigência da edição anterior (10ª - 2020)
  await pool.query(
    `UPDATE edicoes SET ano_fim = 2021 WHERE nome = '10ª EDIÇÃO - 2020' AND ano_fim IS NULL`
  );
  console.log('Vigência da 10ª EDIÇÃO - 2020 atualizada para terminar em 2021.');

  const { rows } = await pool.query(
    `INSERT INTO edicoes (nome, ano_inicio, ano_fim)
     VALUES ('11ª EDIÇÃO - 2022', 2022, NULL)
     ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id`,
    []
  );
  const edicaoId = rows[0].id;
  console.log(`Edição "11ª EDIÇÃO - 2022" criada/confirmada com id ${edicaoId}.`);

  let count = 0;
  for (const [porte, valor] of Object.entries(TABELA_PORTE_2022)) {
    await pool.query(
      `INSERT INTO tabela_porte (edicao_id, porte, valor)
       VALUES ($1, $2, $3)
       ON CONFLICT (edicao_id, porte) DO UPDATE SET valor = EXCLUDED.valor`,
      [edicaoId, porte, valor]
    );
    count++;
  }
  console.log(`${count} valores de porte (incluindo UCO) inseridos para a edição 2022.`);

  await pool.end();
}

setup().catch((err) => {
  console.error('Erro:', err);
  pool.end();
});
