// Baixa a tabela oficial de CBO (Classificação Brasileira de Ocupações,
// Ministério do Trabalho e Emprego) e filtra só a família 225 (médicos),
// gerando public/cbo-medicos.json — usado pelo Validador de XML TISS para
// mostrar a especialidade a partir do código CBO (<ans:CBOS>).
// Fonte oficial: https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads
// Rode de novo periodicamente para manter a lista em dia (o MTE cria novos
// códigos ocasionalmente).
const fs = require('fs');
const https = require('https');

const URL_CSV = 'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads/cbo2002-ocupacao.csv';
const DESTINO = 'public/cbo-medicos.json';

function baixar(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(baixar(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} ao baixar ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log(`Baixando ${URL_CSV} ...`);
  const buffer = await baixar(URL_CSV);
  const texto = buffer.toString('latin1'); // CSV do MTE vem em ISO-8859-1
  const linhas = texto.split(/\r?\n/).filter(Boolean).slice(1); // pula cabeçalho CODIGO;TITULO

  const mapa = {};
  linhas.forEach((linha) => {
    if (!linha.startsWith('225')) return; // só a família "Médicos"
    const [codigo, titulo] = linha.split(';');
    if (codigo && titulo) mapa[codigo] = titulo;
  });

  fs.writeFileSync(DESTINO, JSON.stringify(mapa));
  console.log(`OK: ${Object.keys(mapa).length} ocupações da família 225 (médicos) gravadas em ${DESTINO}`);
}

main().catch((err) => {
  console.error('Erro ao atualizar CBO de médicos:', err);
  process.exit(1);
});
