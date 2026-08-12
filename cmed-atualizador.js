// Verifica e baixa atualizações do Preço-teto CMED a partir da fonte oficial
// e aberta da ANVISA: dados.anvisa.gov.br/dados/TA_PRECO_MEDICAMENTO.csv
// (dado público, licença Creative Commons Atribuição-SemDerivações, sem
// necessidade de autenticação). Ao contrário do SIGTAP (arquivos datados por
// competência), essa URL sempre serve a versão vigente — "atualizar" aqui é
// comparar o header Last-Modified contra o que já foi importado.
const https = require('https');

const URL_CMED_CSV = 'https://dados.anvisa.gov.br/dados/TA_PRECO_MEDICAMENTO.csv';

// Mesmos rótulos/índices de coluna usados pelo import-cmed.js (script de
// importação manual, a partir de um arquivo local) — mantidos aqui como
// única fonte da verdade para os dois caminhos de importação.
const FAIXAS_PF = ['sem_impostos', '0', '12', '17', '17_5', '18', '19', '19_5', '20', '20_5', '21', '22', '22_5', '23'];
const FAIXAS_PMC = ['sem_impostos', '0', '12', '17', '17_5', '18', '19', '19_5', '20', '20_5', '21', '22', '22_5', '23'];
const IDX_PF = [13, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38];
const IDX_PMC = [39, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64];

// rejectUnauthorized: false pelo mesmo motivo do `ssl` do Pool do Postgres
// em server.js — algumas redes (proxy/antivírus corporativo interceptando
// TLS) quebram a cadeia de certificado padrão do Node para hosts externos,
// mesmo quando o certificado do site é válido (confirmado via curl/OS). O
// dado em si é público e somente leitura, sem credenciais envolvidas.
const OPCOES_HTTPS = { headers: { 'User-Agent': 'cons-cbhpm-portal' }, rejectUnauthorized: false };

function baixarBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, OPCOES_HTTPS, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(baixarBuffer(res.headers.location));
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

// HEAD request só pra ler o header Last-Modified, sem baixar os ~16MB do
// arquivo inteiro — usado tanto pela checagem manual (botão) quanto pela
// rotina automática, que roda periodicamente sem intervenção do usuário.
function buscarUltimaModificacaoAnvisa() {
  return new Promise((resolve, reject) => {
    https
      .request(URL_CMED_CSV, { method: 'HEAD', ...OPCOES_HTTPS }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(buscarUltimaModificacaoAnvisa());
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} ao consultar ${URL_CMED_CSV}`));
        }
        const lastModified = res.headers['last-modified'];
        resolve(lastModified ? new Date(lastModified) : null);
      })
      .on('error', reject)
      .end();
  });
}

function parseLinha(linha) {
  const out = [];
  let atual = '';
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (entreAspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') { atual += '"'; i++; }
        else entreAspas = false;
      } else atual += c;
    } else {
      if (c === '"') entreAspas = true;
      else if (c === ';') { out.push(atual); atual = ''; }
      else atual += c;
    }
  }
  out.push(atual);
  return out;
}

function limpar(v) {
  if (v === undefined) return null;
  const t = v.trim();
  if (t === '' || t === '-' || /^-+$/.test(t)) return null;
  return t;
}

function paraNumero(v) {
  const t = limpar(v);
  if (t === null) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function paraBooleano(v) {
  const t = limpar(v);
  if (t === null) return null;
  return t.toLowerCase() === 'sim';
}

function montarFaixas(campos, indices, rotulos) {
  const obj = {};
  indices.forEach((idx, i) => {
    const n = paraNumero(campos[idx]);
    if (n !== null) obj[rotulos[i]] = n;
  });
  return Object.keys(obj).length > 0 ? obj : null;
}

// Recebe o texto bruto do CSV oficial (UTF-8 com BOM, `;` como separador) e
// devolve um registro por apresentação (código GGREM), já pronto pro UNNEST.
function parseCmedCsv(texto) {
  const linhas = texto.split(/\r?\n/);
  const headerIdx = linhas.findIndex((l) => l.startsWith('SUBSTÂNCIA') || l.startsWith('﻿SUBSTÂNCIA'));
  if (headerIdx === -1) throw new Error('Cabeçalho "SUBSTÂNCIA" não encontrado no CSV — layout da CMED pode ter mudado.');

  const dataLinhas = linhas.slice(headerIdx + 1).filter((l) => l.trim().length > 0);
  const registros = dataLinhas.map(parseLinha).filter((campos) => campos.length === 74);

  const vistos = new Set();
  const cols = {
    codigo_ggrem: [], substancia: [], laboratorio: [], cnpj: [], registro: [],
    ean1: [], ean2: [], ean3: [], produto: [], apresentacao: [], classe_terapeutica: [],
    tipo_produto: [], regime_preco: [], pf_sem_impostos: [], pmc_sem_impostos: [],
    pf_faixas: [], pmc_faixas: [], restricao_hospitalar: [], tarja: [], comercializacao_2025: [],
  };

  for (const campos of registros) {
    const ggrem = limpar(campos[3]);
    if (!ggrem || vistos.has(ggrem)) continue;
    vistos.add(ggrem);

    cols.codigo_ggrem.push(ggrem);
    cols.substancia.push(limpar(campos[0]));
    cols.laboratorio.push(limpar(campos[2]));
    cols.cnpj.push(limpar(campos[1]));
    cols.registro.push(limpar(campos[4]));
    cols.ean1.push(limpar(campos[5]));
    cols.ean2.push(limpar(campos[6]));
    cols.ean3.push(limpar(campos[7]));
    cols.produto.push(limpar(campos[8]) || '(sem nome)');
    cols.apresentacao.push(limpar(campos[9]) || '(sem apresentação)');
    cols.classe_terapeutica.push(limpar(campos[10]));
    cols.tipo_produto.push(limpar(campos[11]));
    cols.regime_preco.push(limpar(campos[12]));
    cols.pf_sem_impostos.push(paraNumero(campos[13]));
    cols.pmc_sem_impostos.push(paraNumero(campos[39]));
    cols.pf_faixas.push(JSON.stringify(montarFaixas(campos, IDX_PF, FAIXAS_PF)));
    cols.pmc_faixas.push(JSON.stringify(montarFaixas(campos, IDX_PMC, FAIXAS_PMC)));
    cols.restricao_hospitalar.push(paraBooleano(campos[65]));
    cols.tarja.push(limpar(campos[72]));
    cols.comercializacao_2025.push(paraBooleano(campos[71]));
  }

  return { cols, totalLinhas: dataLinhas.length, totalRegistros: cols.codigo_ggrem.length };
}

async function importarCmed(pool, cols) {
  await pool.query(
    `INSERT INTO cmed_medicamentos (
      codigo_ggrem, substancia, laboratorio, cnpj, registro, ean1, ean2, ean3,
      produto, apresentacao, classe_terapeutica, tipo_produto, regime_preco,
      pf_sem_impostos, pmc_sem_impostos, pf_faixas, pmc_faixas,
      restricao_hospitalar, tarja, comercializacao_2025, atualizado_em
    )
    SELECT *, CURRENT_DATE FROM UNNEST (
      $1::varchar[], $2::text[], $3::text[], $4::varchar[], $5::varchar[],
      $6::varchar[], $7::varchar[], $8::varchar[], $9::text[], $10::text[],
      $11::text[], $12::varchar[], $13::varchar[], $14::numeric[], $15::numeric[],
      $16::jsonb[], $17::jsonb[], $18::boolean[], $19::varchar[], $20::boolean[]
    )
    ON CONFLICT (codigo_ggrem) DO UPDATE SET
      substancia = EXCLUDED.substancia, laboratorio = EXCLUDED.laboratorio,
      produto = EXCLUDED.produto, apresentacao = EXCLUDED.apresentacao,
      classe_terapeutica = EXCLUDED.classe_terapeutica, tipo_produto = EXCLUDED.tipo_produto,
      regime_preco = EXCLUDED.regime_preco, pf_sem_impostos = EXCLUDED.pf_sem_impostos,
      pmc_sem_impostos = EXCLUDED.pmc_sem_impostos, pf_faixas = EXCLUDED.pf_faixas,
      pmc_faixas = EXCLUDED.pmc_faixas, restricao_hospitalar = EXCLUDED.restricao_hospitalar,
      tarja = EXCLUDED.tarja, comercializacao_2025 = EXCLUDED.comercializacao_2025,
      atualizado_em = CURRENT_DATE`,
    [
      cols.codigo_ggrem, cols.substancia, cols.laboratorio, cols.cnpj, cols.registro,
      cols.ean1, cols.ean2, cols.ean3, cols.produto, cols.apresentacao,
      cols.classe_terapeutica, cols.tipo_produto, cols.regime_preco,
      cols.pf_sem_impostos, cols.pmc_sem_impostos, cols.pf_faixas, cols.pmc_faixas,
      cols.restricao_hospitalar, cols.tarja, cols.comercializacao_2025,
    ]
  );
}

async function atualizarMetadata(pool, publicadoEm, totalRegistros) {
  await pool.query(
    `INSERT INTO cmed_metadata (id, publicado_em, atualizado_em, total_registros) VALUES (1, $1, now(), $2)
     ON CONFLICT (id) DO UPDATE SET publicado_em = EXCLUDED.publicado_em, atualizado_em = now(), total_registros = EXCLUDED.total_registros`,
    [publicadoEm, totalRegistros]
  );
}

// Baixa o CSV vigente da ANVISA, reimporta tudo e atualiza cmed_metadata.
// Usada tanto pelo botão manual (protegido por senha) quanto pela rotina
// automática agendada no server.js.
async function atualizarCmed(pool) {
  const publicadoEm = await buscarUltimaModificacaoAnvisa();
  const buffer = await baixarBuffer(URL_CMED_CSV);
  const { cols, totalLinhas, totalRegistros } = parseCmedCsv(buffer.toString('utf8'));

  await importarCmed(pool, cols);
  await atualizarMetadata(pool, publicadoEm, totalRegistros);

  return { publicadoEm, totalLinhas, totalRegistros };
}

module.exports = {
  URL_CMED_CSV,
  baixarBuffer,
  buscarUltimaModificacaoAnvisa,
  parseCmedCsv,
  importarCmed,
  atualizarCmed,
};
