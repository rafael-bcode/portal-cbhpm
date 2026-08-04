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
};
