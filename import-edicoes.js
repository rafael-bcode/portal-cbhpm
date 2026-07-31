require('dotenv').config();
const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Nome do arquivo da planilha (ajuste se o nome do seu arquivo for diferente)
const ARQUIVO = 'Planilha-CBHPM-Comparativo-2004-ate-2017.xlsx';

async function importarEdicoes() {
  const workbook = XLSX.readFile(ARQUIVO);

  // Pega todas as abas, exceto a "Plan2" (que é a calculadora, não uma edição)
  const nomesAbas = workbook.SheetNames.filter((nome) => nome !== 'Plan2');

  console.log(`Encontradas ${nomesAbas.length} edições:`);
  nomesAbas.forEach((nome) => console.log(' -', nome));

  // Extrai o ano de cada nome de aba, ex: "9ª EDIÇÃO - 2017" -> 2017
  const edicoes = nomesAbas.map((nome) => {
    const match = nome.match(/(\d{4})/);
    const ano = match ? parseInt(match[1]) : null;
    return { nome, ano_inicio: ano };
  });

  // Calcula ano_fim: é o ano_inicio da próxima edição, menos 1
  for (let i = 0; i < edicoes.length; i++) {
    if (i < edicoes.length - 1) {
      edicoes[i].ano_fim = edicoes[i + 1].ano_inicio - 1;
    } else {
      edicoes[i].ano_fim = null; // última edição, ainda vigente
    }
  }

  // Insere no banco
  for (const edicao of edicoes) {
    await pool.query(
      `INSERT INTO edicoes (nome, ano_inicio, ano_fim)
       VALUES ($1, $2, $3)
       ON CONFLICT (nome) DO NOTHING`,
      [edicao.nome, edicao.ano_inicio, edicao.ano_fim]
    );
    console.log(`Inserido: ${edicao.nome} (${edicao.ano_inicio} - ${edicao.ano_fim ?? 'atual'})`);
  }

  console.log('\nImportação de edições concluída!');
  await pool.end();
}

importarEdicoes().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});