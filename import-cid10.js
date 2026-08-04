require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function lerCsv(caminho) {
  const texto = fs.readFileSync(caminho).toString('latin1');
  const linhas = texto.split(/\r?\n/).filter(Boolean);
  linhas.shift(); // cabeçalho
  return linhas.map((l) => l.split(';'));
}

async function importarCapitulos() {
  const linhas = lerCsv('cid10_capitulos.csv');
  const numeros = [];
  const inicios = [];
  const fins = [];
  const nomes = [];
  for (const [numcap, catinic, catfim, descricao] of linhas) {
    numeros.push(Number(numcap));
    inicios.push(catinic);
    fins.push(catfim);
    nomes.push(descricao);
  }
  await pool.query(
    `INSERT INTO cid10_capitulo (numero, categoria_inicial, categoria_final, nome)
     SELECT * FROM UNNEST($1::int[], $2::varchar[], $3::varchar[], $4::text[])
     ON CONFLICT (numero) DO UPDATE SET nome = EXCLUDED.nome`,
    [numeros, inicios, fins, nomes]
  );
  console.log(`cid10_capitulo: ${linhas.length} registros`);
}

async function importarCategorias() {
  const linhas = lerCsv('cid10_categorias.csv');
  const codigos = [];
  const nomes = [];
  for (const [cat, , descricao] of linhas) {
    codigos.push(cat);
    nomes.push(descricao);
  }
  await pool.query(
    `INSERT INTO cid10_categoria (codigo, nome)
     SELECT * FROM UNNEST($1::varchar[], $2::text[])
     ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome`,
    [codigos, nomes]
  );
  console.log(`cid10_categoria: ${linhas.length} registros`);
}

async function importarSubcategorias() {
  const linhas = lerCsv('cid10_subcategorias.csv');
  const codigos = [];
  const codigosCategoria = [];
  const nomes = [];
  for (const [subcat, , , , descricao] of linhas) {
    codigos.push(subcat);
    codigosCategoria.push(subcat.slice(0, 3));
    nomes.push(descricao);
  }
  await pool.query(
    `INSERT INTO cid10_subcategoria (codigo, codigo_categoria, nome)
     SELECT * FROM UNNEST($1::varchar[], $2::varchar[], $3::text[])
     ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome`,
    [codigos, codigosCategoria, nomes]
  );
  console.log(`cid10_subcategoria: ${linhas.length} registros`);
}

async function importar() {
  await importarCapitulos();
  await importarCategorias();
  await importarSubcategorias();
  console.log('\nImportação da CID-10 concluída.');
  await pool.end();
}

importar().catch((err) => {
  console.error('Erro na importação:', err);
  pool.end();
});
