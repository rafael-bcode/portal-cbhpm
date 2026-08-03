// Baixa a lista oficial de operadoras ativas da ANS (dados abertos) e gera
// public/operadoras-ans.json — usado pelo Validador de XML TISS para mostrar
// o nome da operadora a partir do <ans:registroANS> do arquivo.
// Fonte oficial: https://dados.gov.br/dados/conjuntos-dados/operadoras-de-planos-de-saude-ativas
// Rode de novo periodicamente (a ANS atualiza esse CSV regularmente) para manter a lista em dia.
const fs = require('fs');
const https = require('https');

const URL_CSV = 'https://dadosabertos.ans.gov.br/FTP/PDA/operadoras_de_plano_de_saude_ativas/Relatorio_cadop.csv';
const DESTINO = 'public/operadoras-ans.json';

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

function parseCsvLineQuoted(linha) {
  return linha.replace(/^"|"$/g, '').split('";"');
}

async function main() {
  console.log(`Baixando ${URL_CSV} ...`);
  const buffer = await baixar(URL_CSV);
  const texto = buffer.toString('utf8');
  const linhas = texto.split(/\r?\n/).filter(Boolean);

  const cabecalho = linhas[0].split(';');
  const idxRegistro = cabecalho.indexOf('REGISTRO_OPERADORA');
  const idxRazao = cabecalho.indexOf('Razao_Social');
  const idxFantasia = cabecalho.indexOf('Nome_Fantasia');
  const idxModalidade = cabecalho.indexOf('Modalidade');

  const mapa = {};
  for (let i = 1; i < linhas.length; i++) {
    const campos = parseCsvLineQuoted(linhas[i]);
    const registro = (campos[idxRegistro] || '').trim();
    if (!registro) continue;
    mapa[registro] = {
      razaoSocial: (campos[idxRazao] || '').trim(),
      nomeFantasia: (campos[idxFantasia] || '').trim(),
      modalidade: (campos[idxModalidade] || '').trim(),
    };
  }

  fs.writeFileSync(DESTINO, JSON.stringify(mapa));
  console.log(`OK: ${Object.keys(mapa).length} operadoras gravadas em ${DESTINO}`);
}

main().catch((err) => {
  console.error('Erro ao atualizar operadoras ANS:', err);
  process.exit(1);
});
