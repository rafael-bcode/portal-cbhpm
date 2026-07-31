require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Valores de Porte -> R$ conforme Comunicado Oficial CBHPM (vigência a partir de out/2019)
const TABELA_PORTE_2020 = {
  '1A': 23.46, '1B': 50.64, '1C': 82.21,
  '2A': 117.18, '2B': 167.43, '2C': 207.63,
  '3A': 302.47, '3B': 397.48, '3C': 486.51,
  '4A': 581.52, '4B': 669.22, '4C': 762.25,
  '5A': 849.95, '5B': 938.98, '5C': 1026.02,
  '6A': 1118.37, '6B': 1214.05, '6C': 1310.39,
  '7A': 1405.40, '7B': 1508.39, '7C': 1634.63,
  '8A': 1736.95, '8B': 1830.64, '8C': 1929.64,
  '9A': 2030.63, '9B': 2145.57, '9C': 2267.83,
  '10A': 2380.78, '10B': 2501.71, '10C': 2641.24,
  '11A': 2754.85, '11B': 2896.38, '11C': 3044.55,
  '12A': 3150.86, '12B': 3290.39, '12C': 3568.80,
  '13A': 3756.17, '13B': 3950.19, '13C': 4167.46,
  '14A': 4411.98, '14B': 4632.58, '14C': 4892.38,
  'UCO': 21.07,
};

async function setup() {
  // Atualiza o fim de vigência da edição anterior (9ª - 2017), que ficava em aberto
  await pool.query(
    `UPDATE edicoes SET ano_fim = 2019 WHERE nome = '9ª EDIÇÃO - 2017' AND ano_fim IS NULL`
  );
  console.log('Vigência da 9ª EDIÇÃO - 2017 atualizada para terminar em 2019.');

  // Cria a nova edição
  const { rows } = await pool.query(
    `INSERT INTO edicoes (nome, ano_inicio, ano_fim)
     VALUES ('10ª EDIÇÃO - 2020', 2020, NULL)
     ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id`,
    []
  );
  const edicaoId = rows[0].id;
  console.log(`Edição "10ª EDIÇÃO - 2020" criada/confirmada com id ${edicaoId}.`);

  // Insere a tabela de Porte -> Valor
  let count = 0;
  for (const [porte, valor] of Object.entries(TABELA_PORTE_2020)) {
    await pool.query(
      `INSERT INTO tabela_porte (edicao_id, porte, valor)
       VALUES ($1, $2, $3)
       ON CONFLICT (edicao_id, porte) DO UPDATE SET valor = EXCLUDED.valor`,
      [edicaoId, porte, valor]
    );
    count++;
  }
  console.log(`${count} valores de porte (incluindo UCO) inseridos para a edição 2020.`);

  await pool.end();
}

setup().catch((err) => {
  console.error('Erro:', err);
  pool.end();
});
