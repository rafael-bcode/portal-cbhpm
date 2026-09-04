require('dotenv').config();
const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ARQUIVO = 'Planilha-CBHPM-Comparativo-2004-ate-2017.xlsx';

async function importarTabelasReferencia() {
  const workbook = XLSX.readFile(ARQUIVO);
  const nomesAbas = workbook.SheetNames.filter((nome) => nome !== 'Plan2');

  // Busca o id de cada edição já salva no banco
  const { rows: edicoesDb } = await pool.query('SELECT id, nome FROM edicoes');
  const edicaoIdPorNome = new Map(edicoesDb.map((e) => [e.nome, e.id]));

  let totalPorte = 0;
  let totalPorteAN = 0;

  for (const nomeAba of nomesAbas) {
    const edicaoId = edicaoIdPorNome.get(nomeAba);
    if (!edicaoId) {
      console.warn(`Aviso: edição "${nomeAba}" não encontrada no banco. Pulando.`);
      continue;
    }

    const sheet = workbook.Sheets[nomeAba];
    // Lê a aba como matriz bruta (linhas x colunas), sem tratar cabeçalho
    const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Localiza a coluna onde começa a tabela de referência (cabeçalho começa com "CBHPM")
    const linhaCabecalho = linhas[0];
    const colInicio = linhaCabecalho.findIndex(
      (celula) => typeof celula === 'string' && celula.trim().startsWith('CBHPM')
    );

    if (colInicio === -1) {
      console.warn(`Aviso: tabela de referência não encontrada na aba "${nomeAba}".`);
      continue;
    }

    // A linha 1 (segunda linha) traz os subtítulos: Porte AN | Valor | Porte | Valor
    const colPorteAN = colInicio;       // Porte AN
    const colValorAN = colInicio + 1;   // Valor (do Porte AN)
    const colPorte = colInicio + 2;     // Porte
    const colValorPorte = colInicio + 3; // Valor (do Porte)

    // --- Extrai Porte Anestésico -> Valor ---
    let porteANCount = 0;
    for (let i = 2; i < linhas.length; i++) {
      const porteAN = linhas[i]?.[colPorteAN];
      const valor = linhas[i]?.[colValorAN];
      if (porteAN === null || porteAN === undefined || porteAN === '') break;

      await pool.query(
        `INSERT INTO tabela_porte_anestesico (edicao_id, porte_an, valor)
         VALUES ($1, $2, $3)
         ON CONFLICT (edicao_id, porte_an) DO NOTHING`,
        [edicaoId, porteAN.toString(), valor ?? 0]
      );
      porteANCount++;
    }

    // --- Extrai Porte -> Valor ---
    let porteCount = 0;
    for (let i = 2; i < linhas.length; i++) {
      const porte = linhas[i]?.[colPorte];
      const valor = linhas[i]?.[colValorPorte];
      if (porte === null || porte === undefined || porte === '') break;

      await pool.query(
        `INSERT INTO tabela_porte (edicao_id, porte, valor)
         VALUES ($1, $2, $3)
         ON CONFLICT (edicao_id, porte) DO NOTHING`,
        [edicaoId, porte.toString(), valor ?? 0]
      );
      porteCount++;
    }

    totalPorteAN += porteANCount;
    totalPorte += porteCount;
    console.log(`Aba "${nomeAba}": ${porteANCount} portes anestésicos, ${porteCount} portes.`);
  }

  console.log(`\nImportação concluída! Total: ${totalPorteAN} registros de Porte Anestésico, ${totalPorte} registros de Porte.`);
  await pool.end();
}

importarTabelasReferencia().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
