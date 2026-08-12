// Verifica e baixa atualizações do Cadastro de Operadoras Ativas a partir
// da fonte oficial e aberta da ANS: dadosabertos.ans.gov.br/FTP/PDA/
// operadoras_de_plano_de_saude_ativas/Relatorio_cadop.csv (dado
// institucional público, sem cadastro). A URL sempre serve a versão
// vigente — "atualizar" é comparar o header Last-Modified contra o que já
// foi importado, igual ao cmed-atualizador.js.
const https = require('https');

const URL_OPERADORAS_CSV = 'https://dadosabertos.ans.gov.br/FTP/PDA/operadoras_de_plano_de_saude_ativas/Relatorio_cadop.csv';

// rejectUnauthorized: false pelo mesmo motivo do cmed-atualizador.js — rede
// local com interceptação de TLS quebra a cadeia de certificado padrão do
// Node pra hosts externos, mesmo com certificado válido.
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

function buscarUltimaModificacaoAns() {
  return new Promise((resolve, reject) => {
    https
      .request(URL_OPERADORAS_CSV, { method: 'HEAD', ...OPCOES_HTTPS }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(buscarUltimaModificacaoAns());
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} ao consultar ${URL_OPERADORAS_CSV}`));
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

function paraData(v) {
  const t = limpar(v);
  if (t === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

// Layout oficial (cabeçalho do CSV): REGISTRO_OPERADORA;CNPJ;Razao_Social;
// Nome_Fantasia;Modalidade;Logradouro;Numero;Complemento;Bairro;Cidade;UF;
// CEP;DDD;Telefone;Fax;Endereco_eletronico;Representante;Cargo_Representante;
// Regiao_de_Comercializacao;Data_Registro_ANS
function parseOperadorasCsv(texto) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headerIdx = linhas.findIndex((l) => l.startsWith('REGISTRO_OPERADORA') || l.startsWith('﻿REGISTRO_OPERADORA'));
  if (headerIdx === -1) throw new Error('Cabeçalho "REGISTRO_OPERADORA" não encontrado no CSV — layout da ANS pode ter mudado.');

  const dataLinhas = linhas.slice(headerIdx + 1);
  const registros = dataLinhas.map(parseLinha).filter((campos) => campos.length === 20);

  const cols = {
    registro_ans: [], cnpj: [], razao_social: [], nome_fantasia: [], modalidade: [],
    logradouro: [], numero: [], complemento: [], bairro: [], cidade: [], uf: [], cep: [],
    ddd: [], telefone: [], fax: [], email: [], regiao_comercializacao: [], data_registro_ans: [],
  };

  const vistos = new Set();
  for (const campos of registros) {
    const registro = limpar(campos[0]);
    if (!registro || vistos.has(registro)) continue;
    vistos.add(registro);

    cols.registro_ans.push(registro);
    cols.cnpj.push(limpar(campos[1]));
    cols.razao_social.push(limpar(campos[2]) || '(sem razão social)');
    cols.nome_fantasia.push(limpar(campos[3]));
    cols.modalidade.push(limpar(campos[4]));
    cols.logradouro.push(limpar(campos[5]));
    cols.numero.push(limpar(campos[6]));
    cols.complemento.push(limpar(campos[7]));
    cols.bairro.push(limpar(campos[8]));
    cols.cidade.push(limpar(campos[9]));
    cols.uf.push(limpar(campos[10]));
    cols.cep.push(limpar(campos[11]));
    cols.ddd.push(limpar(campos[12]));
    cols.telefone.push(limpar(campos[13]));
    cols.fax.push(limpar(campos[14]));
    cols.email.push(limpar(campos[15]));
    cols.regiao_comercializacao.push(limpar(campos[18]));
    cols.data_registro_ans.push(paraData(campos[19]));
  }

  return { cols, totalLinhas: dataLinhas.length, totalRegistros: cols.registro_ans.length };
}

async function importarOperadoras(pool, cols) {
  await pool.query(
    `INSERT INTO operadoras_ans (
      registro_ans, cnpj, razao_social, nome_fantasia, modalidade, logradouro,
      numero, complemento, bairro, cidade, uf, cep, ddd, telefone, fax, email,
      regiao_comercializacao, data_registro_ans, atualizado_em
    )
    SELECT *, CURRENT_DATE FROM UNNEST (
      $1::varchar[], $2::varchar[], $3::text[], $4::text[], $5::varchar[],
      $6::text[], $7::varchar[], $8::text[], $9::text[], $10::text[],
      $11::varchar[], $12::varchar[], $13::varchar[], $14::varchar[],
      $15::varchar[], $16::text[], $17::varchar[], $18::date[]
    )
    ON CONFLICT (registro_ans) DO UPDATE SET
      cnpj = EXCLUDED.cnpj, razao_social = EXCLUDED.razao_social,
      nome_fantasia = EXCLUDED.nome_fantasia, modalidade = EXCLUDED.modalidade,
      logradouro = EXCLUDED.logradouro, numero = EXCLUDED.numero,
      complemento = EXCLUDED.complemento, bairro = EXCLUDED.bairro,
      cidade = EXCLUDED.cidade, uf = EXCLUDED.uf, cep = EXCLUDED.cep,
      ddd = EXCLUDED.ddd, telefone = EXCLUDED.telefone, fax = EXCLUDED.fax,
      email = EXCLUDED.email, regiao_comercializacao = EXCLUDED.regiao_comercializacao,
      data_registro_ans = EXCLUDED.data_registro_ans, atualizado_em = CURRENT_DATE`,
    [
      cols.registro_ans, cols.cnpj, cols.razao_social, cols.nome_fantasia, cols.modalidade,
      cols.logradouro, cols.numero, cols.complemento, cols.bairro, cols.cidade,
      cols.uf, cols.cep, cols.ddd, cols.telefone, cols.fax, cols.email,
      cols.regiao_comercializacao, cols.data_registro_ans,
    ]
  );
}

async function atualizarMetadata(pool, publicadoEm, totalRegistros) {
  await pool.query(
    `INSERT INTO operadoras_metadata (id, publicado_em, atualizado_em, total_registros) VALUES (1, $1, now(), $2)
     ON CONFLICT (id) DO UPDATE SET publicado_em = EXCLUDED.publicado_em, atualizado_em = now(), total_registros = EXCLUDED.total_registros`,
    [publicadoEm, totalRegistros]
  );
}

async function atualizarOperadoras(pool) {
  const publicadoEm = await buscarUltimaModificacaoAns();
  const buffer = await baixarBuffer(URL_OPERADORAS_CSV);
  const { cols, totalLinhas, totalRegistros } = parseOperadorasCsv(buffer.toString('utf8'));

  await importarOperadoras(pool, cols);
  await atualizarMetadata(pool, publicadoEm, totalRegistros);

  return { publicadoEm, totalLinhas, totalRegistros };
}

module.exports = {
  URL_OPERADORAS_CSV,
  buscarUltimaModificacaoAns,
  parseOperadorasCsv,
  importarOperadoras,
  atualizarOperadoras,
};
