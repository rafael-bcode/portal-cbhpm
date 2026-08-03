require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Comunicados de reajuste (somente Faixa Original) que faltavam no histórico.
// A AMB costuma publicar o comunicado de correção INPC/IBGE em outubro de
// cada ano (o mais recente, "2025-2026", saiu em 18/10/2025 e vale até
// set/2026). Quando sair o próximo (ciclo "2026-2027"), repita o padrão
// abaixo com os novos valores oficiais de porte/UCO e rode este script de
// novo — não adivinhe os valores antes do comunicado real ser publicado.
const NOVAS_EDICOES = [
  {
    nome: '2020-2021',
    ano_inicio: 2020,
    ano_fim: 2021,
    uco: 21.89,
    portes: {
      '1A': 24.37, '1B': 67.32, '1C': 96.43,
      '2A': 142.90, '2B': 224.90, '2C': 306.61,
      '3A': 439.28, '3B': 571.95, '3C': 704.62,
      '4A': 837.29, '4B': 969.96, '4C': 1102.63,
      '5A': 1235.29, '5B': 1367.96, '5C': 1500.63,
      '6A': 1633.30, '6B': 1765.97, '6C': 1898.64,
      '7A': 2031.31, '7B': 2163.98, '7C': 2296.65,
      '8A': 2429.32, '8B': 2561.98, '8C': 2694.65,
      '9A': 2827.32, '9B': 2959.99, '9C': 3092.66,
      '10A': 3225.33, '10B': 3358.00, '10C': 3490.67,
      '11A': 3623.34, '11B': 3756.00, '11C': 3888.67,
      '12A': 4021.34, '12B': 4154.01, '12C': 4286.68,
      '13A': 4419.35, '13B': 4552.02, '13C': 4684.69,
      '14A': 4817.36, '14B': 4950.03, '14C': 5082.69,
    },
  },
  {
    nome: '2022-2023',
    ano_inicio: 2022,
    ano_fim: 2023,
    uco: 25.98,
    portes: {
      '1A': 23.31, '1B': 46.63, '1C': 69.96,
      '2A': 93.29, '2B': 122.98, '2C': 145.53,
      '3A': 198.85, '3B': 254.15, '3C': 291.04,
      '4A': 346.38, '4B': 379.17, '4C': 428.38,
      '5A': 461.16, '5B': 498.04, '5C': 528.79,
      '6A': 575.94, '6B': 633.33, '6C': 692.77,
      '7A': 748.10, '7B': 828.03, '7C': 979.69,
      '8A': 1057.58, '8B': 1108.83, '8C': 1176.47,
      '9A': 1250.25, '9B': 1367.08, '9C': 1506.44,
      '10A': 1617.12, '10B': 1752.40, '10C': 1945.06,
      '11A': 2057.78, '11B': 2256.60, '11C': 2475.91,
      '12A': 2566.09, '12B': 2758.75, '12C': 3379.77,
      '13A': 3720.01, '13B': 4080.73, '13C': 4513.20,
      '14A': 5029.70, '14B': 5472.42, '14C': 6035.45,
    },
  },
  {
    nome: '2023-2024',
    ano_inicio: 2023,
    ano_fim: 2024,
    uco: 27.15,
    portes: {
      '1A': 24.36, '1B': 48.73, '1C': 73.12,
      '2A': 97.50, '2B': 128.53, '2C': 152.09,
      '3A': 207.82, '3B': 265.61, '3C': 304.17,
      '4A': 362.00, '4B': 396.27, '4C': 447.70,
      '5A': 481.96, '5B': 520.50, '5C': 552.64,
      '6A': 601.91, '6B': 661.89, '6C': 724.01,
      '7A': 781.84, '7B': 865.37, '7C': 1023.87,
      '8A': 1105.28, '8B': 1158.84, '8C': 1229.53,
      '9A': 1306.64, '9B': 1428.74, '9C': 1574.38,
      '10A': 1690.05, '10B': 1831.43, '10C': 2032.78,
      '11A': 2150.59, '11B': 2358.37, '11C': 2587.57,
      '12A': 2681.82, '12B': 2883.17, '12C': 3532.20,
      '13A': 3887.78, '13B': 4264.77, '13C': 4716.75,
      '14A': 5256.54, '14B': 5719.23, '14C': 6307.65,
    },
  },
  {
    nome: '2025-2026',
    ano_inicio: 2025,
    ano_fim: null,
    uco: 29.80,
    portes: {
      '1A': 26.74, '1B': 53.48, '1C': 80.24,
      '2A': 107.00, '2B': 141.05, '2C': 166.92,
      '3A': 228.07, '3B': 291.50, '3C': 333.81,
      '4A': 397.28, '4B': 434.89, '4C': 491.33,
      '5A': 528.93, '5B': 571.23, '5C': 606.50,
      '6A': 660.57, '6B': 726.40, '6C': 794.57,
      '7A': 858.03, '7B': 949.71, '7C': 1123.65,
      '8A': 1212.99, '8B': 1271.77, '8C': 1349.35,
      '9A': 1433.97, '9B': 1567.97, '9C': 1727.81,
      '10A': 1854.75, '10B': 2009.91, '10C': 2230.89,
      '11A': 2360.17, '11B': 2588.21, '11C': 2839.74,
      '12A': 2943.18, '12B': 3164.15, '12C': 3876.43,
      '13A': 4266.66, '13B': 4680.39, '13C': 5176.41,
      '14A': 5768.81, '14B': 6276.59, '14C': 6922.36,
    },
  },
];

const EDICAO_BASE = '2022'; // edição de onde copiamos a classificação de porte dos procedimentos

async function main() {
  const { rows: baseRows } = await pool.query('SELECT id FROM edicoes WHERE nome = $1', [EDICAO_BASE]);
  if (baseRows.length === 0) {
    throw new Error(`Edição base "${EDICAO_BASE}" não encontrada.`);
  }
  const edicaoBaseId = baseRows[0].id;

  for (const nova of NOVAS_EDICOES) {
    console.log(`\n=== Processando ${nova.nome} ===`);

    // 1) Cria a edição
    const { rows } = await pool.query(
      `INSERT INTO edicoes (nome, ano_inicio, ano_fim)
       VALUES ($1, $2, $3)
       ON CONFLICT (nome) DO UPDATE SET ano_fim = EXCLUDED.ano_fim
       RETURNING id`,
      [nova.nome, nova.ano_inicio, nova.ano_fim]
    );
    const edicaoId = rows[0].id;

    // 2) Insere a tabela de Porte -> Valor (incluindo UCO)
    const entradas = Object.entries(nova.portes);
    entradas.push(['UCO', nova.uco]);
    for (const [porte, valor] of entradas) {
      await pool.query(
        `INSERT INTO tabela_porte (edicao_id, porte, valor)
         VALUES ($1, $2, $3)
         ON CONFLICT (edicao_id, porte) DO UPDATE SET valor = EXCLUDED.valor`,
        [edicaoId, porte, valor]
      );
    }
    console.log(`Tabela de porte inserida (${entradas.length} valores).`);

    // 3) Copia a classificação de porte/uco/etc. da edição base (2022),
    //    recalculando os totais com os novos valores de referência
    await pool.query(
      `INSERT INTO valores_procedimento (
        codigo, edicao_id, descricao, porte, fracao_porte, valor_porte, total_porte,
        incidencias, filme, total_filme, uco, total_uco, porte_anestesico,
        valor_porte_anestesico, total_porte_anestesico, numero_auxiliares,
        total_auxiliares, total_1_auxiliar, total_2_auxiliar, total_3_auxiliar,
        total_4_auxiliar, subtotal
      )
      SELECT
        vp.codigo, $1, vp.descricao, vp.porte, vp.fracao_porte,
        COALESCE(tp.valor, 0) AS valor_porte,
        vp.fracao_porte * COALESCE(tp.valor, 0) AS total_porte,
        vp.incidencias, vp.filme, NULL,
        vp.uco,
        vp.uco * COALESCE(tuco.valor, 0) AS total_uco,
        vp.porte_anestesico, NULL, NULL,
        vp.numero_auxiliares, 0, NULL, NULL, NULL, NULL,
        (vp.fracao_porte * COALESCE(tp.valor, 0)) + (vp.uco * COALESCE(tuco.valor, 0)) AS subtotal
      FROM valores_procedimento vp
      LEFT JOIN tabela_porte tp ON tp.edicao_id = $1 AND tp.porte = vp.porte
      LEFT JOIN tabela_porte tuco ON tuco.edicao_id = $1 AND tuco.porte = 'UCO'
      WHERE vp.edicao_id = $2
      ON CONFLICT (codigo, edicao_id) DO NOTHING`,
      [edicaoId, edicaoBaseId]
    );

    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) FROM valores_procedimento WHERE edicao_id = $1',
      [edicaoId]
    );
    console.log(`${countRows[0].count} registros de valores_procedimento criados para ${nova.nome}.`);
  }

  console.log('\nConcluído!');
  await pool.end();
}

main().catch((err) => {
  console.error('Erro:', err);
  pool.end();
});
