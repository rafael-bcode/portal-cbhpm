// Verifica e baixa atualizações de Produtos para Saúde (inclui OPME —
// órteses, próteses e materiais especiais) a partir da fonte oficial e
// aberta da ANVISA: dados.anvisa.gov.br/dados/TA_PRODUTO_SAUDE_SITE.csv
// (Registro/Cadastro vigente de cada produto, atualizado diariamente pela
// própria ANVISA). Mesmo padrão do cmed-atualizador.js: a URL sempre serve
// a versão vigente, então "atualizar" é comparar o header Last-Modified
// contra o que já foi importado.
const https = require('https');

const URL_PRODUTO_SAUDE_CSV = 'https://dados.anvisa.gov.br/dados/TA_PRODUTO_SAUDE_SITE.csv';

// rejectUnauthorized: false pelo mesmo motivo do cmed-atualizador.js — dado
// público e somente leitura, sem credenciais envolvidas.
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

function buscarUltimaModificacaoAnvisa() {
  return new Promise((resolve, reject) => {
    https
      .request(URL_PRODUTO_SAUDE_CSV, { method: 'HEAD', ...OPCOES_HTTPS }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(buscarUltimaModificacaoAnvisa());
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} ao consultar ${URL_PRODUTO_SAUDE_CSV}`));
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
  return t === '' ? null : t;
}

// Datas do arquivo vêm em DD/MM/AAAA (data_publicacao) ou "DD/MM/AAAA
// HH:MM:SS" (atualizado_em_anvisa) — nunca ISO. Parseado manualmente porque
// o formato brasileiro é ambíguo pro parser padrão do JS/Postgres (DD>12
// quebraria uma leitura MDY silenciosamente errada em vez de falhar).
function paraDataBr(v) {
  const t = limpar(v);
  if (!t) return null;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = m;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss)));
}

// Recebe o texto bruto do CSV oficial (ISO-8859-1, ';' como separador) e
// devolve um registro por linha (numero_registro_cadastro NÃO é único: um
// mesmo registro pode ter uma linha por fabricante/planta habilitada).
function parseProdutoSaudeCsv(texto) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!linhas[0] || !linhas[0].startsWith('NUMERO_REGISTRO_CADASTRO')) {
    throw new Error('Cabeçalho "NUMERO_REGISTRO_CADASTRO" não encontrado no CSV — layout de Produtos para Saúde da ANVISA pode ter mudado.');
  }
  const dataLinhas = linhas.slice(1);

  const cols = {
    numero_registro_cadastro: [], numero_processo: [], nome_tecnico: [], classe_risco: [],
    nome_comercial: [], cnpj_detentor: [], detentor_registro_cadastro: [], nome_fabricante: [],
    pais_fabricante: [], data_publicacao: [], validade_bruta: [], validade_data: [], atualizado_em_anvisa: [],
  };

  for (const linha of dataLinhas) {
    const campos = parseLinha(linha);
    if (campos.length < 12) continue;
    const registro = limpar(campos[0]);
    if (!registro) continue;

    const validadeBruta = limpar(campos[10]);

    cols.numero_registro_cadastro.push(registro);
    cols.numero_processo.push(limpar(campos[1]));
    cols.nome_tecnico.push(limpar(campos[2]));
    cols.classe_risco.push(limpar(campos[3]));
    cols.nome_comercial.push(limpar(campos[4]) || '(sem nome comercial)');
    cols.cnpj_detentor.push(limpar(campos[5]));
    cols.detentor_registro_cadastro.push(limpar(campos[6]));
    cols.nome_fabricante.push(limpar(campos[7]));
    cols.pais_fabricante.push(limpar(campos[8]));
    cols.data_publicacao.push(paraDataBr(campos[9]));
    cols.validade_bruta.push(validadeBruta);
    cols.validade_data.push(validadeBruta && validadeBruta.toUpperCase() === 'VIGENTE' ? null : paraDataBr(validadeBruta));
    cols.atualizado_em_anvisa.push(paraDataBr(campos[11]));
  }

  return { cols, totalLinhas: dataLinhas.length, totalRegistros: cols.numero_registro_cadastro.length };
}

// Em lotes, mesmo motivo do CNES: uma query única com as ~115 mil linhas
// pode estourar o statement_timeout do banco. Sem chave única pra upsert
// (numero_registro_cadastro se repete por fabricante) — o dado é republicado
// inteiro todo dia pela ANVISA, então TRUNCATE + reinsere é mais simples e
// correto que tentar casar linha a linha com o que já estava.
const PRODUTO_SAUDE_TAMANHO_LOTE = 20_000;

async function importarProdutoSaude(pool, cols) {
  await pool.query('TRUNCATE TABLE produtos_saude_anvisa');
  const total = cols.numero_registro_cadastro.length;
  for (let inicio = 0; inicio < total; inicio += PRODUTO_SAUDE_TAMANHO_LOTE) {
    const fim = Math.min(inicio + PRODUTO_SAUDE_TAMANHO_LOTE, total);
    const fatia = (arr) => arr.slice(inicio, fim);

    await pool.query(
      `INSERT INTO produtos_saude_anvisa (
        numero_registro_cadastro, numero_processo, nome_tecnico, classe_risco, nome_comercial,
        cnpj_detentor, detentor_registro_cadastro, nome_fabricante, pais_fabricante,
        data_publicacao, validade_bruta, validade_data, atualizado_em_anvisa, atualizado_em
      )
      SELECT *, CURRENT_DATE FROM UNNEST (
        $1::text[], $2::text[], $3::text[], $4::text[], $5::text[],
        $6::text[], $7::text[], $8::text[], $9::text[],
        $10::date[], $11::text[], $12::date[], $13::timestamptz[]
      )`,
      [
        fatia(cols.numero_registro_cadastro), fatia(cols.numero_processo), fatia(cols.nome_tecnico), fatia(cols.classe_risco), fatia(cols.nome_comercial),
        fatia(cols.cnpj_detentor), fatia(cols.detentor_registro_cadastro), fatia(cols.nome_fabricante), fatia(cols.pais_fabricante),
        fatia(cols.data_publicacao), fatia(cols.validade_bruta), fatia(cols.validade_data), fatia(cols.atualizado_em_anvisa),
      ]
    );
    console.log(`  ... ${fim}/${total} importados`);
  }
}

async function atualizarMetadata(pool, publicadoEm, totalRegistros) {
  await pool.query(
    `INSERT INTO produto_saude_metadata (id, publicado_em, atualizado_em, total_registros) VALUES (1, $1, now(), $2)
     ON CONFLICT (id) DO UPDATE SET publicado_em = EXCLUDED.publicado_em, atualizado_em = now(), total_registros = EXCLUDED.total_registros`,
    [publicadoEm, totalRegistros]
  );
}

// Baixa o CSV vigente da ANVISA, reimporta tudo e atualiza
// produto_saude_metadata. Usada tanto pelo botão manual (protegido por
// senha) quanto pela rotina automática agendada no server.js.
async function atualizarProdutoSaude(pool) {
  const publicadoEm = await buscarUltimaModificacaoAnvisa();
  const buffer = await baixarBuffer(URL_PRODUTO_SAUDE_CSV);
  const { cols, totalLinhas, totalRegistros } = parseProdutoSaudeCsv(buffer.toString('latin1'));

  await importarProdutoSaude(pool, cols);
  await atualizarMetadata(pool, publicadoEm, totalRegistros);

  return { publicadoEm, totalLinhas, totalRegistros };
}

module.exports = {
  URL_PRODUTO_SAUDE_CSV,
  baixarBuffer,
  buscarUltimaModificacaoAnvisa,
  parseProdutoSaudeCsv,
  importarProdutoSaude,
  atualizarProdutoSaude,
};
