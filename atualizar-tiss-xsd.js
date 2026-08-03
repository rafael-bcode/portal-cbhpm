// Baixa o "Componente de Comunicação" oficial do Padrão TISS (ANS) — o ZIP
// com os XSDs — e extrai só os arquivos necessários para validar a
// estrutura de uma mensagemTISS na versão 4.03.00, gravando em
// public/tiss-xsd/. Usado pelo Validador de XML TISS para a checagem
// "Estrutura (XSD oficial)", rodada inteiramente no navegador via
// vendor/xmllint-wasm (ver public/vendor/xmllint-wasm/LICENSE).
// Fonte oficial: https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss
// (página "Padrão TISS" mais recente — o link do "Componente de Comunicação" muda de nome a cada atualização).
// Rode de novo quando a ANS publicar uma nova versão do Padrão TISS.
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');

const URL_ZIP =
  'https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/copy_of_copy3_of_PadroTISSComunicao_202511.zip';
const DESTINO_DIR = 'public/tiss-xsd';

// Só os arquivos que a mensagemTISS v4.03.00 realmente importa/inclui
// (ver schemaLocation dentro de tissV4_03_00.xsd e suas dependências).
const ARQUIVOS_NECESSARIOS = [
  'tissV4_03_00.xsd',
  'tissSimpleTypesV4_03_00.xsd',
  'tissComplexTypesV4_03_00.xsd',
  'tissGuiasV4_03_00.xsd',
  'tissAssinaturaDigital_v1.01.xsd',
  'xmldsig-core-schema.xsd',
];

function baixar(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
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
      })
      .on('error', reject);
  });
}

async function main() {
  console.log(`Baixando ${URL_ZIP} ...`);
  const buffer = await baixar(URL_ZIP);
  const zip = new AdmZip(buffer);

  fs.mkdirSync(DESTINO_DIR, { recursive: true });

  let gravados = 0;
  ARQUIVOS_NECESSARIOS.forEach((nome) => {
    const entrada = zip.getEntries().find((e) => e.entryName.endsWith('/' + nome) || e.entryName === nome);
    if (!entrada) {
      console.warn(`⚠ Não encontrei ${nome} dentro do ZIP — confira se a estrutura de pastas mudou.`);
      return;
    }
    fs.writeFileSync(`${DESTINO_DIR}/${nome}`, entrada.getData());
    gravados++;
  });

  console.log(`OK: ${gravados}/${ARQUIVOS_NECESSARIOS.length} arquivos XSD gravados em ${DESTINO_DIR}`);
}

main().catch((err) => {
  console.error('Erro ao atualizar XSD do Padrão TISS:', err);
  process.exit(1);
});
