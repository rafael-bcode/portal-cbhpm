require('dotenv').config();
const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ARQUIVO = 'Planilha-CBHPM-Comparativo-2004-ate-2017.xlsx';

async function importarProcedimentos() {
  const workbook = XLSX.readFile(ARQUIVO);
  const nomesAbas = workbook.SheetNames.filter((nome) => nome !== 'Plan2');

  // Mapa: codigo -> descricao mais recente encontrada
  // Como percorremos as abas em ordem (2004 -> 2017), a última sobrescrita
  // sempre será a descrição mais recente.
  const procedimentosMap = new Map();

  for (const nomeAba of nomesAbas) {
    const sheet = workbook.Sheets[nomeAba];
    // Lê por posição de coluna (array), não por nome do cabeçalho —
    // a aba "3ª EDIÇÃO - 2004" tem espaços a mais nos nomes das colunas,
    // o que quebrava a leitura por nome (ex: " Procedimento" em vez de "Procedimento").
    const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    for (let i = 1; i < linhas.length; i++) {
      const codigo = linhas[i][0];       // coluna A: Codigo
      const descricao = linhas[i][1];    // coluna B: Procedimento

      if (codigo && descricao) {
        procedimentosMap.set(Number(codigo), descricao.toString().trim());
      }
    }

    console.log(`Aba "${nomeAba}" processada. Total acumulado: ${procedimentosMap.size} códigos únicos.`);
  }

  console.log(`\nTotal final de procedimentos únicos: ${procedimentosMap.size}`);
  console.log('Iniciando inserção no banco...\n');

  let inseridos = 0;
  for (const [codigo, descricao] of procedimentosMap) {
    await pool.query(
      `INSERT INTO procedimentos (codigo, descricao)
       VALUES ($1, $2)
       ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao`,
      [codigo, descricao]
    );
    inseridos++;
    if (inseridos % 500 === 0) {
      console.log(`${inseridos} procedimentos inseridos...`);
    }
  }

  console.log(`\nImportação concluída! ${inseridos} procedimentos inseridos/atualizados.`);
  await pool.end();
}

importarProcedimentos().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
