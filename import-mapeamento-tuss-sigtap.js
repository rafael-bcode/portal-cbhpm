// Importa o mapeamento TUSS x SIGTAP a partir da planilha oficial ANS
// (aba "Mapeamento ativos" de padraotiss_mapeamento_tuss_sigtap.zip, extraído
// de MAPEAMENTO TUSS x SIGTAP 2017 04.xlsx). Só importa linhas com
// "Status Final" = "Mapeado" (código SIGTAP equivalente confirmado) — linhas
// sem mapeamento ou marcadas "Não existe na Sigtap" não têm valor para o
// conversor.
require('dotenv').config();
const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ARQUIVO_XLSX = process.argv[2] || 'MAPEAMENTO TUSS x SIGTAP 2017 04.xlsx';

async function importar() {
  const wb = XLSX.readFile(ARQUIVO_XLSX);
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets['Mapeamento ativos'], { defval: '' });
  const mapeadas = linhas.filter((l) => l['Status Final'] === 'Mapeado' && l['Código Sigtap Final']);

  console.log(`Lidas ${linhas.length} linhas, ${mapeadas.length} com mapeamento confirmado. Inserindo...`);

  const codigosTuss = [];
  const termosTuss = [];
  const codigosSigtap = [];
  const procedimentosSigtap = [];
  const graus = [];

  for (const l of mapeadas) {
    codigosTuss.push(String(l['Código TUSS']));
    termosTuss.push(l['Termo TUSS'] || null);
    // Excel guarda o código SIGTAP como número em algumas linhas, perdendo o
    // zero à esquerda (SIGTAP sempre tem 10 dígitos) — repõe com padStart.
    codigosSigtap.push(String(l['Código Sigtap Final']).padStart(10, '0'));
    procedimentosSigtap.push(l['Procedimento Sigtap Final'] || null);
    const grau = Number(l['Grau de equivalencia ']);
    graus.push(Number.isFinite(grau) ? grau : null);
  }

  await pool.query('TRUNCATE mapeamento_tuss_sigtap');
  await pool.query(
    `INSERT INTO mapeamento_tuss_sigtap (codigo_tuss, termo_tuss, codigo_sigtap, procedimento_sigtap, grau_equivalencia)
     SELECT * FROM UNNEST($1::varchar[], $2::text[], $3::varchar[], $4::text[], $5::smallint[])`,
    [codigosTuss, termosTuss, codigosSigtap, procedimentosSigtap, graus]
  );

  console.log(`Importação concluída! ${mapeadas.length} mapeamentos TUSS x SIGTAP inseridos.`);
  await pool.end();
}

importar().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
