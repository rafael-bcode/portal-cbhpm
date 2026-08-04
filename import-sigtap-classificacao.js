require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function lerLinhas(caminho) {
  return fs.readFileSync(caminho).toString('latin1').split(/\r\n/).filter(Boolean);
}

async function importarDominio(tabela, caminho, fimCodigo, fimNome) {
  const linhas = lerLinhas(caminho);
  const codigos = [];
  const nomes = [];
  for (const l of linhas) {
    codigos.push(l.slice(0, fimCodigo));
    nomes.push(l.slice(fimCodigo, fimNome).trim());
  }
  await pool.query(
    `INSERT INTO ${tabela} (codigo, nome)
     SELECT * FROM UNNEST($1::varchar[], $2::text[])
     ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome`,
    [codigos, nomes]
  );
  console.log(`${tabela}: ${linhas.length} registros`);
}

async function importarRelacao(tabela, caminho, colunaX, fimX) {
  const linhas = lerLinhas(caminho);
  const codigosProcedimento = [];
  const codigosX = [];
  for (const l of linhas) {
    codigosProcedimento.push(l.slice(0, 10));
    codigosX.push(l.slice(10, fimX));
  }
  await pool.query(
    `INSERT INTO ${tabela} (codigo_procedimento, ${colunaX})
     SELECT * FROM UNNEST($1::varchar[], $2::varchar[])
     ON CONFLICT DO NOTHING`,
    [codigosProcedimento, codigosX]
  );
  console.log(`${tabela}: ${linhas.length} registros`);
}

async function importar() {
  // Tabelas de domínio primeiro (as relações têm FK para elas)
  await importarDominio('sigtap_grupo', 'tb_grupo.txt', 2, 102);
  await importarDominio('sigtap_sub_grupo', 'tb_sub_grupo.txt', 4, 104);
  await importarDominio('sigtap_forma_organizacao', 'tb_forma_organizacao.txt', 6, 106);
  await importarDominio('sigtap_modalidade', 'tb_modalidade.txt', 2, 102);
  await importarDominio('sigtap_registro', 'tb_registro.txt', 2, 52);
  await importarDominio('sigtap_financiamento', 'tb_financiamento.txt', 2, 102);
  await importarDominio('sigtap_rubrica', 'tb_rubrica.txt', 6, 106);
  await importarDominio('sigtap_detalhe', 'tb_detalhe.txt', 3, 103);

  // Relações N:N (dependem de sigtap_procedimentos já estar populada)
  await importarRelacao('sigtap_procedimento_registro', 'rl_procedimento_registro.txt', 'codigo_registro', 12);
  await importarRelacao('sigtap_procedimento_modalidade', 'rl_procedimento_modalidade.txt', 'codigo_modalidade', 12);
  await importarRelacao('sigtap_procedimento_detalhe', 'rl_procedimento_detalhe.txt', 'codigo_detalhe', 13);

  console.log('\nImportação de classificação SIGTAP concluída.');
  await pool.end();
}

importar().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
