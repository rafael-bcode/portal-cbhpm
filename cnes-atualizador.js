// Verifica e baixa atualizações do Cadastro Nacional de Estabelecimentos de
// Saúde (CNES) a partir da fonte oficial do DATASUS. Ao contrário de
// CMED/operadoras (URL sempre "vigente"), o CNES publica um arquivo por
// competência (mês) — por isso primeiro consultamos a listagem oficial
// (mesma API que a tela de downloads do CNES usa) pra achar a competência
// mais recente, e só então baixamos o ZIP correspondente.
const https = require('https');
const AdmZip = require('adm-zip');

const URL_LISTAGEM = 'https://cnes.datasus.gov.br/services/arquivos-download/base-dados/';
const URL_DOWNLOAD = (nomeArquivo) => `https://cnes.datasus.gov.br/EstatisticasServlet?path=${nomeArquivo}`;

// A listagem exige um User-Agent de navegador — com o UA padrão do curl (ou
// sem UA) o WAF do DATASUS recusa a conexão nesse endpoint específico
// (confirmado testando; o endpoint de download do ZIP em si não tem essa
// exigência, mas mantemos o mesmo UA nos dois por segurança).
const OPCOES_HTTPS = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'application/json',
    Referer: 'https://cnes.datasus.gov.br/pages/downloads/arquivosBaseDados.jsp',
  },
  rejectUnauthorized: false,
};

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

async function buscarUltimaCompetenciaDisponivel() {
  const buf = await baixarBuffer(URL_LISTAGEM);
  const lista = JSON.parse(buf.toString('utf8'));
  const arquivo = lista.find((i) => /^BASE_DE_DADOS_CNES_\d{6}\.ZIP$/.test(i.nomeArquivo));
  if (!arquivo) throw new Error('Nenhum arquivo BASE_DE_DADOS_CNES_*.ZIP encontrado na listagem oficial.');
  const competencia = arquivo.nomeArquivo.match(/(\d{6})/)[1];
  return { competencia, nomeArquivo: arquivo.nomeArquivo };
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

function paraNumero(v) {
  const t = limpar(v);
  if (t === null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// lê uma entrada do ZIP (latin1, mesmo padrão de encoding do sigtap-atualizador.js
// para arquivos-fonte do DATASUS) e devolve um Map codigo -> nome, a partir
// das colunas indicadas (tabelas de domínio pequenas: município, natureza
// jurídica, tipo de estabelecimento).
function lerTabelaDominio(zip, nomeArquivo, idxCodigo, idxNome, extra) {
  const entrada = zip.getEntries().find((e) => e.entryName.toLowerCase().includes(nomeArquivo.toLowerCase()));
  if (!entrada) throw new Error(`Arquivo ${nomeArquivo} não encontrado no ZIP.`);
  const linhas = entrada.getData().toString('latin1').split(/\r?\n/).filter(Boolean);
  linhas.shift(); // cabeçalho
  const mapa = new Map();
  for (const l of linhas) {
    const campos = parseLinha(l);
    const codigo = limpar(campos[idxCodigo]);
    if (!codigo) continue;
    mapa.set(codigo, extra ? extra(campos) : limpar(campos[idxNome]));
  }
  return mapa;
}

// tbEstabelecimento (layout oficial, colunas separadas por ';'):
// CO_UNIDADE(0) CO_CNES(1) NU_CNPJ_MANTENEDORA(2) ... NO_RAZAO_SOCIAL(5)
// NO_FANTASIA(6) NO_LOGRADOURO(7) NU_ENDERECO(8) NO_COMPLEMENTO(9)
// NO_BAIRRO(10) CO_CEP(11) ... NU_TELEFONE(16) NU_FAX(17) NO_EMAIL(18) ...
// NU_CNPJ(20) ... CO_ESTADO_GESTOR(30) CO_MUNICIPIO_GESTOR(31) ...
// NO_URL(38) NU_LATITUDE(39) NU_LONGITUDE(40) ... CO_NATUREZA_JUR(43) ...
// CO_TIPO_ESTABELECIMENTO(51)
function parseCnesZip(buffer) {
  const zip = new AdmZip(buffer);

  const municipios = lerTabelaDominio(zip, 'tbMunicipio', 0, 1, (c) => ({ nome: limpar(c[1]), uf: limpar(c[2]) }));
  const naturezasJuridicas = lerTabelaDominio(zip, 'tbNaturezaJuridica', 0, 1);
  const tiposEstabelecimento = lerTabelaDominio(zip, 'tbTipoEstabelecimento', 0, 1);

  const entradaEstab = zip.getEntries().find((e) => e.entryName.toLowerCase().includes('tbestabelecimento'));
  if (!entradaEstab) throw new Error('Arquivo tbEstabelecimento não encontrado no ZIP.');
  const linhas = entradaEstab.getData().toString('latin1').split(/\r?\n/).filter(Boolean);
  linhas.shift();

  const cols = {
    codigo_cnes: [], codigo_unidade: [], cnpj: [], cnpj_mantenedora: [], razao_social: [],
    nome_fantasia: [], logradouro: [], numero: [], complemento: [], bairro: [], cep: [],
    cidade: [], uf: [], codigo_municipio_ibge: [], telefone: [], fax: [], email: [], site: [],
    tipo_estabelecimento: [], natureza_juridica: [], latitude: [], longitude: [],
  };

  const vistos = new Set();
  let totalLinhas = 0;
  for (const l of linhas) {
    totalLinhas++;
    const campos = parseLinha(l);
    if (campos.length < 52) continue;
    const cnes = limpar(campos[1]);
    if (!cnes || vistos.has(cnes)) continue;
    vistos.add(cnes);

    const codMunicipio = limpar(campos[31]);
    const municipio = codMunicipio ? municipios.get(codMunicipio) : null;

    cols.codigo_cnes.push(cnes);
    cols.codigo_unidade.push(limpar(campos[0]));
    cols.cnpj.push(limpar(campos[20]));
    cols.cnpj_mantenedora.push(limpar(campos[2]));
    cols.razao_social.push(limpar(campos[5]) || '(sem razão social)');
    cols.nome_fantasia.push(limpar(campos[6]));
    cols.logradouro.push(limpar(campos[7]));
    cols.numero.push(limpar(campos[8]));
    cols.complemento.push(limpar(campos[9]));
    cols.bairro.push(limpar(campos[10]));
    cols.cep.push(limpar(campos[11]));
    cols.cidade.push(municipio ? municipio.nome : null);
    cols.uf.push(municipio ? municipio.uf : null);
    cols.codigo_municipio_ibge.push(codMunicipio);
    cols.telefone.push(limpar(campos[16]));
    cols.fax.push(limpar(campos[17]));
    cols.email.push(limpar(campos[18]));
    cols.site.push(limpar(campos[38]));
    cols.latitude.push(paraNumero(campos[39]));
    cols.longitude.push(paraNumero(campos[40]));
    const codNatureza = limpar(campos[43]);
    cols.natureza_juridica.push(codNatureza ? naturezasJuridicas.get(codNatureza) || null : null);
    const codTipo = limpar(campos[51]);
    cols.tipo_estabelecimento.push(codTipo ? tiposEstabelecimento.get(codTipo) || null : null);
  }

  return { cols, totalLinhas, totalRegistros: cols.codigo_cnes.length };
}

// Em lotes — uma única query UNNEST com as 632 mil linhas inteiras estoura
// o statement_timeout do banco (confirmado). 20.000 por vez equilibra
// velocidade (poucas idas e vindas) com tempo de execução por query.
const CNES_TAMANHO_LOTE = 20_000;

async function importarCnes(pool, cols) {
  const total = cols.codigo_cnes.length;
  for (let inicio = 0; inicio < total; inicio += CNES_TAMANHO_LOTE) {
    const fim = Math.min(inicio + CNES_TAMANHO_LOTE, total);
    const fatia = (arr) => arr.slice(inicio, fim);

    await pool.query(
      `INSERT INTO cnes_estabelecimentos (
        codigo_cnes, codigo_unidade, cnpj, cnpj_mantenedora, razao_social,
        nome_fantasia, logradouro, numero, complemento, bairro, cep, cidade,
        uf, codigo_municipio_ibge, telefone, fax, email, site,
        tipo_estabelecimento, natureza_juridica, latitude, longitude, atualizado_em
      )
      SELECT *, CURRENT_DATE FROM UNNEST (
        $1::text[], $2::text[], $3::text[], $4::text[], $5::text[],
        $6::text[], $7::text[], $8::text[], $9::text[], $10::text[],
        $11::text[], $12::text[], $13::text[], $14::text[],
        $15::text[], $16::text[], $17::text[], $18::text[], $19::text[],
        $20::text[], $21::numeric[], $22::numeric[]
      )
      ON CONFLICT (codigo_cnes) DO UPDATE SET
        codigo_unidade = EXCLUDED.codigo_unidade, cnpj = EXCLUDED.cnpj,
        cnpj_mantenedora = EXCLUDED.cnpj_mantenedora, razao_social = EXCLUDED.razao_social,
        nome_fantasia = EXCLUDED.nome_fantasia, logradouro = EXCLUDED.logradouro,
        numero = EXCLUDED.numero, complemento = EXCLUDED.complemento, bairro = EXCLUDED.bairro,
        cep = EXCLUDED.cep, cidade = EXCLUDED.cidade, uf = EXCLUDED.uf,
        codigo_municipio_ibge = EXCLUDED.codigo_municipio_ibge, telefone = EXCLUDED.telefone,
        fax = EXCLUDED.fax, email = EXCLUDED.email, site = EXCLUDED.site,
        tipo_estabelecimento = EXCLUDED.tipo_estabelecimento, natureza_juridica = EXCLUDED.natureza_juridica,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, atualizado_em = CURRENT_DATE`,
      [
        fatia(cols.codigo_cnes), fatia(cols.codigo_unidade), fatia(cols.cnpj), fatia(cols.cnpj_mantenedora), fatia(cols.razao_social),
        fatia(cols.nome_fantasia), fatia(cols.logradouro), fatia(cols.numero), fatia(cols.complemento), fatia(cols.bairro),
        fatia(cols.cep), fatia(cols.cidade), fatia(cols.uf), fatia(cols.codigo_municipio_ibge), fatia(cols.telefone),
        fatia(cols.fax), fatia(cols.email), fatia(cols.site), fatia(cols.tipo_estabelecimento), fatia(cols.natureza_juridica),
        fatia(cols.latitude), fatia(cols.longitude),
      ]
    );
    console.log(`  ... ${fim}/${total} importados`);
  }
}

async function atualizarMetadata(pool, competencia, totalRegistros) {
  await pool.query(
    `INSERT INTO cnes_metadata (id, competencia, atualizado_em, total_registros) VALUES (1, $1, now(), $2)
     ON CONFLICT (id) DO UPDATE SET competencia = EXCLUDED.competencia, atualizado_em = now(), total_registros = EXCLUDED.total_registros`,
    [competencia, totalRegistros]
  );
}

// Baixa a Base de Dados CNES da competência mais recente, reimporta a
// tabela de estabelecimentos (com nomes de município/natureza jurídica/tipo
// já resolvidos) e atualiza cnes_metadata.
async function atualizarCnes(pool) {
  const { competencia, nomeArquivo } = await buscarUltimaCompetenciaDisponivel();
  const buffer = await baixarBuffer(URL_DOWNLOAD(nomeArquivo));
  const { cols, totalLinhas, totalRegistros } = parseCnesZip(buffer);

  await importarCnes(pool, cols);
  await atualizarMetadata(pool, competencia, totalRegistros);

  return { competencia, totalLinhas, totalRegistros };
}

module.exports = {
  buscarUltimaCompetenciaDisponivel,
  parseCnesZip,
  importarCnes,
  atualizarCnes,
};
