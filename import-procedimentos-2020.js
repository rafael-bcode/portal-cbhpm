require('dotenv').config();
const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ARQUIVO = 'TABELA_CBHPM_2020.xlsx';
const ABA = 'CBHPM 2020';

async function importarProcedimentos2020() {
  const workbook = XLSX.readFile(ARQUIVO);
  const sheet = workbook.Sheets[ABA];
  const dados = XLSX.utils.sheet_to_json(sheet, { defval: null });

  console.log(`Lidos ${dados.length} registros da aba "${ABA}".`);

  let inseridos = 0;
  let novos = 0;
  let ignorados = 0;
  for (const linha of dados) {
    const codigoRaw = linha['ID do Procedimento'];
    const descricao = linha['Descrição do Procedimento'];
    if (!codigoRaw || !descricao) continue;

    const codigo = Number(codigoRaw);
    if (isNaN(codigo)) {
      console.warn(`Aviso: código inválido ignorado: "${codigoRaw}" (${descricao})`);
      ignorados++;
      continue;
    }

    const { rows } = await pool.query('SELECT 1 FROM procedimentos WHERE codigo = $1', [codigo]);
    if (rows.length === 0) novos++;

    await pool.query(
      `INSERT INTO procedimentos (codigo, descricao)
       VALUES ($1, $2)
       ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao`,
      [codigo, descricao.toString().trim()]
    );
    inseridos++;
  }

  console.log(`\nConcluído! ${inseridos} procedimentos processados (${novos} códigos novos adicionados, ${ignorados} ignorados por código inválido).`);
  await pool.end();
}

importarProcedimentos2020().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
