// Verifica e baixa atualizações da Tabela Unificada SIGTAP a partir do
// espelho público https://github.com/RenatoKR/SIGTAP (sincroniza
// diariamente com o FTP oficial do DATASUS, dados de domínio público).
// Reimporta procedimentos + tabelas de classificação (grupo, sub-grupo,
// forma de organização, modalidade, registro, financiamento, rubrica,
// detalhe e as relações N:N) na mesma competência do arquivo baixado.
const https = require('https');
const AdmZip = require('adm-zip');

const GITHUB_API_TABELAS = 'https://api.github.com/repos/RenatoKR/SIGTAP/contents/tabelas';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function competenciaLegivel(competencia) {
  if (!competencia || competencia.length !== 6) return competencia;
  const mes = Number(competencia.slice(4, 6));
  const ano = competencia.slice(0, 4);
  return `${MESES[mes - 1] || competencia.slice(4, 6)}/${ano}`;
}

function baixarBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'cons-cbhpm-portal' } }, (res) => {
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

async function buscarUltimaDisponivelGitHub() {
  const buf = await baixarBuffer(GITHUB_API_TABELAS);
  const itens = JSON.parse(buf.toString('utf-8'));
  const zips = itens
    .filter((i) => /^TabelaUnificada_(\d{6})_v\d+\.zip$/.test(i.name))
    .map((i) => ({
      nome: i.name,
      competencia: i.name.match(/^TabelaUnificada_(\d{6})_/)[1],
      downloadUrl: i.download_url,
    }))
    .sort((a, b) => (a.competencia < b.competencia ? 1 : -1));

  if (zips.length === 0) throw new Error('Nenhum arquivo TabelaUnificada_*.zip encontrado no repositório.');
  return zips[0];
}

function lerEntradaZip(zip, nomeArquivo) {
  const entrada = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(nomeArquivo.toLowerCase()));
  if (!entrada) throw new Error(`Arquivo ${nomeArquivo} não encontrado no ZIP.`);
  return entrada.getData().toString('latin1').split(/\r\n/).filter(Boolean);
}

// meses -> "N ano(s)" / "N mes(es)" / null (9999 = não se aplica).
// Regra confirmada contra a tela oficial do SIGTAP/DATASUS (ex: código
// 0301010056 tem idade_maxima_meses=1571, que não é múltiplo exato de 12,
// e o site oficial mostra "Idade Máxima: 130 anos" — ou seja, é divisão
// inteira por 12, não exige múltiplo exato).
function mesesParaLegivel(meses) {
  if (meses === 9999) return null;
  if (meses >= 12) return `${Math.floor(meses / 12)} ano(s)`;
  return `${meses} mes(es)`;
}

// tb_procedimento.txt (layout oficial DATASUS/SIGTAP):
// CO_PROCEDIMENTO(10) NO_PROCEDIMENTO(250) TP_COMPLEXIDADE(1) TP_SEXO(1)
// QT_MAXIMA_EXECUCAO(4) QT_DIAS_PERMANENCIA(4) QT_PONTOS(4)
// VL_IDADE_MINIMA(4) VL_IDADE_MAXIMA(4) VL_SH(12) VL_SA(12) VL_SP(12)
// CO_FINANCIAMENTO(2) CO_RUBRICA(6) QT_TEMPO_PERMANENCIA(4) DT_COMPETENCIA(6)
function parseTbProcedimento(linhas) {
  return linhas.map((l) => {
    const idadeMinMeses = Number(l.slice(274, 278));
    const idadeMaxMeses = Number(l.slice(278, 282));
    return {
      codigo: l.slice(0, 10),
      nome: l.slice(10, 260).trim(),
      complexidade: l.slice(260, 261),
      sexo: l.slice(261, 262),
      qt_maxima_execucao: Number(l.slice(262, 266)),
      qt_dias_permanencia: Number(l.slice(266, 270)),
      qt_pontos: Number(l.slice(270, 274)),
      idade_minima_meses: idadeMinMeses,
      idade_maxima_meses: idadeMaxMeses,
      idade_minima_legivel: mesesParaLegivel(idadeMinMeses),
      idade_maxima_legivel: mesesParaLegivel(idadeMaxMeses),
      vl_sh: Number(l.slice(282, 294)) / 100,
      vl_sa: Number(l.slice(294, 306)) / 100,
      vl_sp: Number(l.slice(306, 318)) / 100,
      financiamento: l.slice(318, 320),
      rubrica: l.slice(320, 326).trim(),
      tempo_permanencia: Number(l.slice(326, 330)),
    };
  });
}

async function importarProcedimentos(pool, procedimentos) {
  const cols = {
    codigo: [], nome: [], complexidade: [], sexo: [], qt_maxima_execucao: [],
    qt_dias_permanencia: [], qt_pontos: [], idade_minima_meses: [], idade_maxima_meses: [],
    idade_minima_legivel: [], idade_maxima_legivel: [], vl_sh: [], vl_sa: [], vl_sp: [],
    financiamento: [], rubrica: [], tempo_permanencia: [],
  };
  for (const r of procedimentos) {
    cols.codigo.push(r.codigo);
    cols.nome.push(r.nome);
    cols.complexidade.push(r.complexidade || null);
    cols.sexo.push(r.sexo || null);
    cols.qt_maxima_execucao.push(r.qt_maxima_execucao);
    cols.qt_dias_permanencia.push(r.qt_dias_permanencia);
    cols.qt_pontos.push(r.qt_pontos);
    cols.idade_minima_meses.push(r.idade_minima_meses);
    cols.idade_maxima_meses.push(r.idade_maxima_meses);
    cols.idade_minima_legivel.push(r.idade_minima_legivel);
    cols.idade_maxima_legivel.push(r.idade_maxima_legivel);
    cols.vl_sh.push(r.vl_sh);
    cols.vl_sa.push(r.vl_sa);
    cols.vl_sp.push(r.vl_sp);
    cols.financiamento.push(r.financiamento || null);
    cols.rubrica.push(r.rubrica || null);
    cols.tempo_permanencia.push(r.tempo_permanencia);
  }
  await pool.query(
    `INSERT INTO sigtap_procedimentos (
      codigo, nome, complexidade, sexo, qt_maxima_execucao, qt_dias_permanencia,
      qt_pontos, idade_minima_meses, idade_maxima_meses, idade_minima_legivel,
      idade_maxima_legivel, vl_sh, vl_sa, vl_sp, financiamento, rubrica, tempo_permanencia
    )
    SELECT * FROM UNNEST (
      $1::varchar[], $2::text[], $3::varchar[], $4::varchar[], $5::int[], $6::int[],
      $7::int[], $8::int[], $9::int[], $10::varchar[], $11::varchar[], $12::numeric[],
      $13::numeric[], $14::numeric[], $15::varchar[], $16::varchar[], $17::int[]
    )
    ON CONFLICT (codigo) DO UPDATE SET
      nome = EXCLUDED.nome, complexidade = EXCLUDED.complexidade, sexo = EXCLUDED.sexo,
      qt_maxima_execucao = EXCLUDED.qt_maxima_execucao, qt_dias_permanencia = EXCLUDED.qt_dias_permanencia,
      qt_pontos = EXCLUDED.qt_pontos, idade_minima_meses = EXCLUDED.idade_minima_meses,
      idade_maxima_meses = EXCLUDED.idade_maxima_meses, idade_minima_legivel = EXCLUDED.idade_minima_legivel,
      idade_maxima_legivel = EXCLUDED.idade_maxima_legivel, vl_sh = EXCLUDED.vl_sh, vl_sa = EXCLUDED.vl_sa,
      vl_sp = EXCLUDED.vl_sp, financiamento = EXCLUDED.financiamento, rubrica = EXCLUDED.rubrica,
      tempo_permanencia = EXCLUDED.tempo_permanencia`,
    [
      cols.codigo, cols.nome, cols.complexidade, cols.sexo, cols.qt_maxima_execucao,
      cols.qt_dias_permanencia, cols.qt_pontos, cols.idade_minima_meses, cols.idade_maxima_meses,
      cols.idade_minima_legivel, cols.idade_maxima_legivel, cols.vl_sh, cols.vl_sa, cols.vl_sp,
      cols.financiamento, cols.rubrica, cols.tempo_permanencia,
    ]
  );
  return procedimentos.length;
}

async function importarDominio(pool, tabela, linhas, fimCodigo, fimNome) {
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
  return linhas.length;
}

async function importarRelacao(pool, tabela, linhas, colunaX, fimX) {
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
  return linhas.length;
}

// tb_habilitacao.txt: CO_HABILITACAO(4) NO_HABILITACAO(150) DT_COMPETENCIA(6)
async function importarHabilitacao(pool, linhas) {
  const codigos = [];
  const nomes = [];
  for (const l of linhas) {
    codigos.push(l.slice(0, 4));
    nomes.push(l.slice(4, 154).trim());
  }
  await pool.query(
    `INSERT INTO sigtap_habilitacao (codigo, nome)
     SELECT * FROM UNNEST($1::varchar[], $2::text[])
     ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome`,
    [codigos, nomes]
  );
  return linhas.length;
}

// tb_grupo_habilitacao.txt: NU_GRUPO_HABILITACAO(4) NO_GRUPO_HABILITACAO(20) DS_GRUPO_HABILITACAO(250)
async function importarGrupoHabilitacao(pool, linhas) {
  const codigos = [];
  const nomes = [];
  const descricoes = [];
  for (const l of linhas) {
    codigos.push(l.slice(0, 4));
    nomes.push(l.slice(4, 24).trim());
    descricoes.push(l.slice(24, 274).trim());
  }
  await pool.query(
    `INSERT INTO sigtap_grupo_habilitacao (codigo, nome, descricao)
     SELECT * FROM UNNEST($1::varchar[], $2::text[], $3::text[])
     ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao`,
    [codigos, nomes, descricoes]
  );
  return linhas.length;
}

// rl_procedimento_habilitacao.txt: CO_PROCEDIMENTO(10) CO_HABILITACAO(4) NU_GRUPO_HABILITACAO(4) DT_COMPETENCIA(6)
async function importarProcedimentoHabilitacao(pool, linhas) {
  const codigosProcedimento = [];
  const codigosHabilitacao = [];
  const grupos = [];
  for (const l of linhas) {
    codigosProcedimento.push(l.slice(0, 10));
    codigosHabilitacao.push(l.slice(10, 14));
    const grupo = l.slice(14, 18).trim();
    grupos.push(grupo || null);
  }
  await pool.query(
    `INSERT INTO sigtap_procedimento_habilitacao (codigo_procedimento, codigo_habilitacao, codigo_grupo_habilitacao)
     SELECT * FROM UNNEST($1::varchar[], $2::varchar[], $3::varchar[])
     ON CONFLICT (codigo_procedimento, codigo_habilitacao) DO NOTHING`,
    [codigosProcedimento, codigosHabilitacao, grupos]
  );
  return linhas.length;
}

// rl_procedimento_compativel.txt: CO_PROCEDIMENTO_PRINCIPAL(10) CO_REGISTRO_PRINCIPAL(2)
// CO_PROCEDIMENTO_COMPATIVEL(10) CO_REGISTRO_COMPATIVEL(2) TP_COMPATIBILIDADE(1) QT_PERMITIDA(4) DT_COMPETENCIA(6)
async function importarCompativel(pool, linhas) {
  const principais = [];
  const registrosPrincipais = [];
  const compativeis = [];
  const registrosCompativeis = [];
  const tipos = [];
  const quantidades = [];
  for (const l of linhas) {
    principais.push(l.slice(0, 10));
    registrosPrincipais.push(l.slice(10, 12));
    compativeis.push(l.slice(12, 22));
    registrosCompativeis.push(l.slice(22, 24));
    tipos.push(l.slice(24, 25));
    quantidades.push(Number(l.slice(25, 29)));
  }
  await pool.query(
    `INSERT INTO sigtap_procedimento_compativel (
      codigo_principal, codigo_registro_principal, codigo_compativel,
      codigo_registro_compativel, tipo_compatibilidade, quantidade_permitida
    )
    SELECT * FROM UNNEST($1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[], $6::int[])
    ON CONFLICT (codigo_principal, codigo_compativel, codigo_registro_principal, codigo_registro_compativel)
    DO NOTHING`,
    [principais, registrosPrincipais, compativeis, registrosCompativeis, tipos, quantidades]
  );
  return linhas.length;
}

// rl_procedimento_cid.txt: CO_PROCEDIMENTO(10) CO_CID(4) ST_PRINCIPAL(1) DT_COMPETENCIA(6)
// CO_CID vem com espaço de preenchimento quando o CID é só de categoria (3
// chars, ex. "C73 "); guardamos sempre sem esse espaço pra casar direto com
// cid10_categoria (3 chars) ou cid10_subcategoria (4 chars).
async function importarProcedimentoCid(pool, linhas) {
  const codigosProcedimento = [];
  const codigosCid = [];
  const principais = [];
  for (const l of linhas) {
    codigosProcedimento.push(l.slice(0, 10));
    codigosCid.push(l.slice(10, 14).trim());
    principais.push(l.slice(14, 15) === 'S');
  }
  await pool.query(
    `INSERT INTO sigtap_procedimento_cid (codigo_procedimento, codigo_cid, principal)
     SELECT * FROM UNNEST($1::varchar[], $2::varchar[], $3::boolean[])
     ON CONFLICT (codigo_procedimento, codigo_cid) DO UPDATE SET principal = EXCLUDED.principal`,
    [codigosProcedimento, codigosCid, principais]
  );
  return linhas.length;
}

// rl_excecao_compatibilidade.txt: CO_PROCEDIMENTO_RESTRICAO(10) CO_PROCEDIMENTO_PRINCIPAL(10)
// CO_REGISTRO_PRINCIPAL(2) CO_PROCEDIMENTO_COMPATIVEL(10) CO_REGISTRO_COMPATIVEL(2) TP_COMPATIBILIDADE(1) DT_COMPETENCIA(6)
async function importarExcecaoCompatibilidade(pool, linhas) {
  const restricoes = [];
  const principais = [];
  const registrosPrincipais = [];
  const compativeis = [];
  const registrosCompativeis = [];
  const tipos = [];
  for (const l of linhas) {
    restricoes.push(l.slice(0, 10));
    principais.push(l.slice(10, 20));
    registrosPrincipais.push(l.slice(20, 22));
    compativeis.push(l.slice(22, 32));
    registrosCompativeis.push(l.slice(32, 34));
    tipos.push(l.slice(34, 35));
  }
  await pool.query(
    `INSERT INTO sigtap_excecao_compatibilidade (
      codigo_restricao, codigo_principal, codigo_registro_principal,
      codigo_compativel, codigo_registro_compativel, tipo_compatibilidade
    )
    SELECT * FROM UNNEST($1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[], $6::varchar[])
    ON CONFLICT (codigo_restricao, codigo_principal, codigo_compativel, codigo_registro_principal, codigo_registro_compativel)
    DO NOTHING`,
    [restricoes, principais, registrosPrincipais, compativeis, registrosCompativeis, tipos]
  );
  return linhas.length;
}

// Baixa a versão mais recente do espelho GitHub, reimporta tudo (procedimentos
// + classificação) e atualiza sigtap_metadata. Lança erro se algo falhar —
// quem chamar decide como reportar.
async function atualizarSigtap(pool) {
  const ultima = await buscarUltimaDisponivelGitHub();
  const zipBuffer = await baixarBuffer(ultima.downloadUrl);
  const zip = new AdmZip(zipBuffer);

  const resumo = {};

  const procedimentos = parseTbProcedimento(lerEntradaZip(zip, 'tb_procedimento.txt'));
  resumo.sigtap_procedimentos = await importarProcedimentos(pool, procedimentos);

  resumo.sigtap_grupo = await importarDominio(pool, 'sigtap_grupo', lerEntradaZip(zip, 'tb_grupo.txt'), 2, 102);
  resumo.sigtap_sub_grupo = await importarDominio(pool, 'sigtap_sub_grupo', lerEntradaZip(zip, 'tb_sub_grupo.txt'), 4, 104);
  resumo.sigtap_forma_organizacao = await importarDominio(pool, 'sigtap_forma_organizacao', lerEntradaZip(zip, 'tb_forma_organizacao.txt'), 6, 106);
  resumo.sigtap_modalidade = await importarDominio(pool, 'sigtap_modalidade', lerEntradaZip(zip, 'tb_modalidade.txt'), 2, 102);
  resumo.sigtap_registro = await importarDominio(pool, 'sigtap_registro', lerEntradaZip(zip, 'tb_registro.txt'), 2, 52);
  resumo.sigtap_financiamento = await importarDominio(pool, 'sigtap_financiamento', lerEntradaZip(zip, 'tb_financiamento.txt'), 2, 102);
  resumo.sigtap_rubrica = await importarDominio(pool, 'sigtap_rubrica', lerEntradaZip(zip, 'tb_rubrica.txt'), 6, 106);
  resumo.sigtap_detalhe = await importarDominio(pool, 'sigtap_detalhe', lerEntradaZip(zip, 'tb_detalhe.txt'), 3, 103);

  resumo.sigtap_procedimento_registro = await importarRelacao(pool, 'sigtap_procedimento_registro', lerEntradaZip(zip, 'rl_procedimento_registro.txt'), 'codigo_registro', 12);
  resumo.sigtap_procedimento_modalidade = await importarRelacao(pool, 'sigtap_procedimento_modalidade', lerEntradaZip(zip, 'rl_procedimento_modalidade.txt'), 'codigo_modalidade', 12);
  resumo.sigtap_procedimento_detalhe = await importarRelacao(pool, 'sigtap_procedimento_detalhe', lerEntradaZip(zip, 'rl_procedimento_detalhe.txt'), 'codigo_detalhe', 13);

  resumo.sigtap_habilitacao = await importarHabilitacao(pool, lerEntradaZip(zip, 'tb_habilitacao.txt'));
  resumo.sigtap_grupo_habilitacao = await importarGrupoHabilitacao(pool, lerEntradaZip(zip, 'tb_grupo_habilitacao.txt'));
  resumo.sigtap_procedimento_habilitacao = await importarProcedimentoHabilitacao(pool, lerEntradaZip(zip, 'rl_procedimento_habilitacao.txt'));
  resumo.sigtap_procedimento_compativel = await importarCompativel(pool, lerEntradaZip(zip, 'rl_procedimento_compativel.txt'));
  resumo.sigtap_excecao_compatibilidade = await importarExcecaoCompatibilidade(pool, lerEntradaZip(zip, 'rl_excecao_compatibilidade.txt'));
  resumo.sigtap_procedimento_cid = await importarProcedimentoCid(pool, lerEntradaZip(zip, 'rl_procedimento_cid.txt'));

  await pool.query(
    `INSERT INTO sigtap_metadata (id, competencia, atualizado_em) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET competencia = EXCLUDED.competencia, atualizado_em = now()`,
    [ultima.competencia]
  );

  return { competencia: ultima.competencia, arquivo: ultima.nome, resumo };
}

module.exports = {
  competenciaLegivel,
  buscarUltimaDisponivelGitHub,
  atualizarSigtap,
  lerEntradaZip,
  importarProcedimentoCid,
};
