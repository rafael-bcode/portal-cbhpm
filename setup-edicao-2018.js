require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Valores de Porte -> R$ conforme Comunicado Oficial CBHPM (vigência a partir de out/2018)
const TABELA_PORTE_2018 = {
  '1A': 19.84, '1B': 39.68, '1C': 59.53,
  '2A': 79.38, '2B': 104.64, '2C': 143.81,
  '3A': 202.37, '3B': 262.10, '3C': 310.38,
  '4A': 370.21, '4B': 415.83, '4C': 471.79,
  '5A': 517.41, '5B': 565.61, '5C': 609.95,
  '6A': 664.61, '6B': 725.73, '6C': 788.15,
  '7A': 847.97, '7B': 923.29, '7C': 1043.81,
  '8A': 1117.84, '8B': 1175.10, '8C': 1242.67,
  '9A': 1314.12, '9B': 1412.69, '9C': 1525.45,
  '10A': 1620.15, '10B': 1730.34, '10C': 1876.68,
  '11A': 1972.66, '11B': 2122.89, '11C': 2286.02,
  '12A': 2367.80, '12B': 2515.15, '12C': 2930.37,
  '13A': 3169.69, '13B': 3421.92, '13C': 3719.35,
  '14A': 4069.72, '14B': 4373.61, '14C': 4753.67,
  'UCO': 20.47,
};

async function setup() {
  // 1) Renomeia todas as edições existentes para manter só o ano
  const { rows: existentes } = await pool.query('SELECT id, nome, ano_inicio FROM edicoes');
  for (const e of existentes) {
    const novoNome = String(e.ano_inicio);
    if (e.nome !== novoNome) {
      await pool.query('UPDATE edicoes SET nome = $1 WHERE id = $2', [novoNome, e.id]);
    }
  }
  console.log(`${existentes.length} edições renomeadas (mantendo só o ano).`);

  // 2) Ajusta a vigência da edição 2017 para terminar em 2017 (já que 2018 vem em seguida)
  await pool.query(`UPDATE edicoes SET ano_fim = 2017 WHERE nome = '2017'`);

  // 3) Cria a edição 2018
  const { rows } = await pool.query(
    `INSERT INTO edicoes (nome, ano_inicio, ano_fim)
     VALUES ('2018', 2018, 2019)
     ON CONFLICT (nome) DO UPDATE SET ano_fim = EXCLUDED.ano_fim
     RETURNING id`,
    []
  );
  const edicaoId = rows[0].id;
  console.log(`Edição "2018" criada/confirmada com id ${edicaoId}.`);

  // 4) Insere a tabela de Porte -> Valor
  let count = 0;
  for (const [porte, valor] of Object.entries(TABELA_PORTE_2018)) {
    await pool.query(
      `INSERT INTO tabela_porte (edicao_id, porte, valor)
       VALUES ($1, $2, $3)
       ON CONFLICT (edicao_id, porte) DO UPDATE SET valor = EXCLUDED.valor`,
      [edicaoId, porte, valor]
    );
    count++;
  }
  console.log(`${count} valores de porte (incluindo UCO) inseridos para a edição 2018.`);

  await pool.end();
}

setup().catch((err) => {
  console.error('Erro:', err);
  pool.end();
});
