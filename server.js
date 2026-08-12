require('dotenv').config();
const path = require('path');
const express = require('express');
const { Pool } = require('pg');
const packageJson = require('./package.json');
const changelog = require('./CHANGELOG.json');
const { competenciaLegivel, buscarUltimaDisponivelGitHub, atualizarSigtap } = require('./sigtap-atualizador');
const { buscarUltimaModificacaoAnvisa, atualizarCmed } = require('./cmed-atualizador');
const { buscarUltimaModificacaoAns, atualizarOperadoras } = require('./operadoras-atualizador');

const app = express();
app.use(express.json());

// Página institucional na raiz — a ferramenta em si (public/index.html)
// continua acessível normalmente em /index.html via o static abaixo.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.use(express.static(path.join(__dirname, 'public'))); // serve os arquivos da tela (HTML/CSS/JS)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Versão atual do portal e histórico de mudanças (exibidos no rodapé da tela)
app.get('/api/versao', (req, res) => {
  res.json({ versaoAtual: packageJson.version, changelog });
});

// Lista todas as edições disponíveis (usado para montar os checkboxes na tela)
app.get('/api/edicoes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nome, ano_inicio FROM edicoes ORDER BY ano_inicio, id');
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar edições:', err);
    res.status(500).json({ erro: 'Erro ao buscar edições.' });
  }
});

// Busca procedimentos por descrição (autocomplete) — retorna os que COMEÇAM com o termo digitado
app.get('/api/buscar-procedimentos', async (req, res) => {
  try {
    const termo = (req.query.q || '').trim();
    if (termo.length < 2) {
      return res.json([]);
    }

    const { rows } = await pool.query(
      `SELECT codigo, descricao
       FROM procedimentos
       WHERE descricao ILIKE $1
       ORDER BY descricao
       LIMIT 15`,
      [`${termo}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro na busca de procedimentos:', err);
    res.status(500).json({ erro: 'Erro ao buscar procedimentos.' });
  }
});

/**
 * POST /api/consultar-procedimento
 * Body esperado:
 * {
 *   "codigo": 10102019,
 *   "edicoes": [1, 2, 3]   // ids das edições, ou "todas"
 *   "ajustes": {
 *     "pctPorte": 0,          // percentual (ex: 10 = +10%, -5 = -5%)
 *     "pctUco": 0,
 *     "pctPorteAnestesico": 0,
 *     "valorFilme": 0,        // valor em R$ do m² do filme (informado pelo usuário)
 *     "pctFilme": 0,
 *     "pct1Auxiliar": 30,     // percentuais da equipe, sobre o valor de porte do cirurgião
 *     "pct2Auxiliar": 20,
 *     "pct3Auxiliar": 20,
 *     "pct4Auxiliar": 20,
 *     "pctInstrumentador": 10,
 *     "pctAuxAnestesista": 30
 *   }
 * }
 *
 * O honorário do cirurgião (porte + UCO + filme), o do anestesista (porte
 * anestésico) e o da equipe (auxiliares/instrumentador) são profissionais
 * distintos — por isso são calculados e retornados separadamente, sem somar
 * tudo num único total.
 */
app.post('/api/consultar-procedimento', async (req, res) => {
  try {
    const { codigo, edicoes, ajustes = {} } = req.body;

    if (!codigo) {
      return res.status(400).json({ erro: 'Informe o código do procedimento.' });
    }

    const pctPorte = Number(ajustes.pctPorte) || 0;
    const pctUco = Number(ajustes.pctUco) || 0;
    const pctPorteAN = Number(ajustes.pctPorteAnestesico) || 0;
    const valorFilme = Number(ajustes.valorFilme) || 0;
    const pctFilme = Number(ajustes.pctFilme) || 0;

    const pct1Auxiliar = Number(ajustes.pct1Auxiliar) || 0;
    const pct2Auxiliar = Number(ajustes.pct2Auxiliar) || 0;
    const pct3Auxiliar = Number(ajustes.pct3Auxiliar) || 0;
    const pct4Auxiliar = Number(ajustes.pct4Auxiliar) || 0;
    const pctInstrumentador = Number(ajustes.pctInstrumentador) || 0;
    const pctAuxAnestesista = Number(ajustes.pctAuxAnestesista) || 0;

    // Monta o filtro de edições
    let filtroEdicao = '';
    let params = [codigo];
    if (edicoes && edicoes !== 'todas' && Array.isArray(edicoes) && edicoes.length > 0) {
      filtroEdicao = 'AND vp.edicao_id = ANY($2)';
      params.push(edicoes);
    }

    // Busca os dados base do procedimento em cada edição, já trazendo
    // o valor de referência do UCO daquela edição (tabela_porte, porte = 'UCO')
    const query = `
      SELECT
        vp.edicao_id,
        e.nome AS edicao_nome,
        e.ano_inicio,
        vp.descricao,
        vp.porte,
        vp.fracao_porte,
        vp.valor_porte,
        vp.total_porte,
        vp.uco,
        vp.porte_anestesico,
        vp.valor_porte_anestesico,
        vp.total_porte_anestesico,
        vp.filme AS quantidade_filme,
        vp.total_filme,
        vp.numero_auxiliares,
        vp.total_auxiliares,
        (SELECT valor FROM tabela_porte tp WHERE tp.edicao_id = vp.edicao_id AND tp.porte = 'UCO') AS valor_uco_referencia
      FROM valores_procedimento vp
      JOIN edicoes e ON e.id = vp.edicao_id
      WHERE vp.codigo = $1
      ${filtroEdicao}
      ORDER BY e.ano_inicio
    `;

    const { rows } = await pool.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Código não encontrado nas edições selecionadas.' });
    }

    // Busca o mapeamento AMB/TUSS para esse código (pode ter mais de uma variante)
    const { rows: mapeamento } = await pool.query(
      `SELECT codigo_amb90, codigo_amb92, codigo_amb96, codigo_amb99, codigo_tuss
       FROM mapeamento_amb_tuss
       WHERE codigo_cbhpm = $1`,
      [codigo]
    );

    // Aplica o cálculo em cada edição retornada.
    // Regra (CALCULO_CBHPM.md): porte + UCO + filme compõem o valor do
    // procedimento (honorário do cirurgião). Porte anestésico (anestesista) e
    // auxiliares/instrumentador são honorários de OUTROS profissionais e nunca
    // somam ao valor do procedimento — por isso vêm em blocos separados.
    const resultado = rows.map((r) => {
      // As colunas "total_porte"/"total_porte_anestesico" da planilha-fonte das
      // edições 2004-2017 (Planilha-CBHPM-Comparativo-2004-ate-2017.xlsx) trazem
      // um fator de 10% embutido sobre fração×valor_porte em 100% das linhas —
      // confirmado por auditoria (59.694/59.694 linhas com razão exata 1,10) e
      // pelas próprias colunas de auxiliar da planilha, que calculam o percentual
      // sobre fração×valor_porte SEM o fator, não sobre o total gravado. Por isso
      // recalculamos aqui em vez de confiar no total já gravado.
      const valorPorte = Number(r.valor_porte) || 0;
      const fracaoPorte = Number(r.fracao_porte) || 0;
      const totalPorteBase = Number((fracaoPorte * valorPorte).toFixed(2));
      const totalPorte = totalPorteBase * (1 + pctPorte / 100);

      const qtdUco = Number(r.uco) || 0;
      const valorUcoRef = Number(r.valor_uco_referencia) || 0;
      const totalUco = qtdUco * valorUcoRef * (1 + pctUco / 100);

      const qtdFilme = Number(r.quantidade_filme) || 0;
      const totalFilme = qtdFilme * valorFilme * (1 + pctFilme / 100);
      const totalFilmeBase = Number(r.total_filme) || 0;

      const subtotalCirurgiao = totalPorte + totalUco + totalFilme;
      const subtotalCirurgiaoOriginal = totalPorteBase + qtdUco * valorUcoRef + totalFilmeBase;

      // Anestesista: honorário à parte, nunca somado ao valor do procedimento.
      // Não há coluna de fração para o porte anestésico (fração = 1 implícita,
      // confirmado pelas edições 2018+ onde total_porte_anestesico == valor_porte_anestesico).
      const valorPorteAN = Number(r.valor_porte_anestesico) || 0;
      const totalPorteANBase = valorPorteAN;
      const totalPorteAN = totalPorteANBase * (1 + pctPorteAN / 100);

      // Equipe (auxiliares/instrumentador): percentual configurável sobre o
      // valor unitário do porte do cirurgião (base sem ajuste de %), também
      // nunca somado ao valor do procedimento.
      const papeis = [
        { papel: '1º Auxiliar', percentual: pct1Auxiliar },
        { papel: '2º Auxiliar', percentual: pct2Auxiliar },
        { papel: '3º Auxiliar', percentual: pct3Auxiliar },
        { papel: '4º Auxiliar', percentual: pct4Auxiliar },
        { papel: 'Instrumentador', percentual: pctInstrumentador },
        { papel: 'Auxiliar de Anestesista', percentual: pctAuxAnestesista },
      ].map((p) => ({
        ...p,
        total: Number(((valorPorte * p.percentual) / 100).toFixed(2)),
      }));
      const totalEquipe = papeis.reduce((soma, p) => soma + p.total, 0);

      return {
        edicao: r.edicao_nome,
        ano: r.ano_inicio,
        descricao: r.descricao,
        cirurgiao: {
          porte: {
            classificacao: r.porte,
            fracao: fracaoPorte,
            valor_unitario: valorPorte,
            percentual_aplicado: pctPorte,
            total: Number(totalPorte.toFixed(2)),
          },
          uco: {
            quantidade: qtdUco,
            valor_unitario_referencia: valorUcoRef,
            percentual_aplicado: pctUco,
            total: Number(totalUco.toFixed(2)),
          },
          filme: {
            quantidade_m2: qtdFilme,
            valor_informado: valorFilme,
            percentual_aplicado: pctFilme,
            total: Number(totalFilme.toFixed(2)),
          },
          subtotal: Number(subtotalCirurgiao.toFixed(2)),
          subtotal_original_planilha: Number(subtotalCirurgiaoOriginal.toFixed(2)),
        },
        anestesista: {
          // Só se aplica quando o procedimento tem porte anestésico atribuído
          // (classe "0"/vazia = procedimento não usa anestesia).
          aplicavel: Boolean(r.porte_anestesico) && r.porte_anestesico !== '0',
          classificacao: r.porte_anestesico,
          valor_unitario: valorPorteAN,
          percentual_aplicado: pctPorteAN,
          total: Number(totalPorteAN.toFixed(2)),
          total_original_planilha: Number(totalPorteANBase.toFixed(2)),
        },
        equipe: {
          // Independente da anestesia: só se aplica quando o procedimento
          // realmente prevê auxiliar(es) na tabela.
          aplicavel: Number(r.numero_auxiliares) > 0,
          quantidade_auxiliares_procedimento: r.numero_auxiliares,
          valor_referencia_porte: valorPorte,
          papeis,
          total: Number(totalEquipe.toFixed(2)),
          total_original_planilha: Number((Number(r.total_auxiliares) || 0).toFixed(2)),
        },
      };
    });

    res.json({ codigo, mapeamento_amb_tuss: mapeamento, resultados: resultado });
  } catch (err) {
    console.error('Erro na consulta:', err);
    res.status(500).json({ erro: 'Erro interno ao consultar procedimento.' });
  }
});

/**
 * POST /api/consultar-multiplos-procedimentos
 * Simula honorários quando mais de um procedimento é feito no mesmo ato
 * cirúrgico (mesma sessão), aplicando os redutores da CBHPM para o Porte do
 * cirurgião conforme a relação de cada procedimento com o principal:
 *   - principal: 100% do porte
 *   - mesma_via: percentual configurável (padrão 50%)
 *   - via_diferente: percentual configurável (padrão 70%)
 *   - equipe_diferente: percentual configurável (padrão 100%, equipe distinta fatura integral)
 *
 * UCO e Filme não sofrem redução (permanecem integrais para cada
 * procedimento). O Porte Anestésico é cobrado uma única vez por sessão
 * (maior valor entre os procedimentos, já que é uma anestesia só). A Equipe
 * (auxiliares/instrumentador) aplica seu percentual sobre a soma dos valores
 * de referência de porte já ponderados pela relação de cada procedimento
 * (o "total pago ao cirurgião" na sessão).
 *
 * Body esperado:
 * {
 *   "edicaoId": 12,
 *   "procedimentos": [
 *     { "codigo": 31309054, "relacao": "principal" },
 *     { "codigo": 12345678, "relacao": "mesma_via" }
 *   ],
 *   "ajustes": { ...mesmos campos de /api/consultar-procedimento...,
 *     "pctMesmaVia": 50, "pctViaDiferente": 70, "pctEquipeDiferente": 100 }
 * }
 */
app.post('/api/consultar-multiplos-procedimentos', async (req, res) => {
  try {
    const { edicaoId, procedimentos, ajustes = {} } = req.body;

    if (!edicaoId) {
      return res.status(400).json({ erro: 'Informe a edição.' });
    }
    if (!Array.isArray(procedimentos) || procedimentos.length < 2) {
      return res.status(400).json({ erro: 'Informe ao menos 2 procedimentos.' });
    }
    const principais = procedimentos.filter((p) => p.relacao === 'principal');
    if (principais.length !== 1) {
      return res.status(400).json({ erro: 'Marque exatamente um procedimento como principal.' });
    }

    const pctPorte = Number(ajustes.pctPorte) || 0;
    const pctUco = Number(ajustes.pctUco) || 0;
    const pctPorteAN = Number(ajustes.pctPorteAnestesico) || 0;
    const valorFilme = Number(ajustes.valorFilme) || 0;
    const pctFilme = Number(ajustes.pctFilme) || 0;
    const pct1Auxiliar = Number(ajustes.pct1Auxiliar) || 0;
    const pct2Auxiliar = Number(ajustes.pct2Auxiliar) || 0;
    const pct3Auxiliar = Number(ajustes.pct3Auxiliar) || 0;
    const pct4Auxiliar = Number(ajustes.pct4Auxiliar) || 0;
    const pctInstrumentador = Number(ajustes.pctInstrumentador) || 0;
    const pctAuxAnestesista = Number(ajustes.pctAuxAnestesista) || 0;

    const pctRelacao = {
      principal: 100,
      mesma_via: ajustes.pctMesmaVia !== undefined ? Number(ajustes.pctMesmaVia) : 50,
      via_diferente: ajustes.pctViaDiferente !== undefined ? Number(ajustes.pctViaDiferente) : 70,
      equipe_diferente: ajustes.pctEquipeDiferente !== undefined ? Number(ajustes.pctEquipeDiferente) : 100,
    };

    const codigos = procedimentos.map((p) => Number(p.codigo));

    const { rows } = await pool.query(
      `SELECT
        vp.codigo,
        vp.descricao,
        vp.porte,
        vp.fracao_porte,
        vp.valor_porte,
        vp.total_porte,
        vp.uco,
        vp.porte_anestesico,
        vp.valor_porte_anestesico,
        vp.total_porte_anestesico,
        vp.filme AS quantidade_filme,
        vp.numero_auxiliares,
        (SELECT valor FROM tabela_porte tp WHERE tp.edicao_id = vp.edicao_id AND tp.porte = 'UCO') AS valor_uco_referencia
      FROM valores_procedimento vp
      WHERE vp.edicao_id = $1 AND vp.codigo = ANY($2)`,
      [edicaoId, codigos]
    );

    const porCodigo = new Map(rows.map((r) => [Number(r.codigo), r]));
    const faltando = codigos.filter((c) => !porCodigo.has(c));
    if (faltando.length > 0) {
      return res.status(404).json({ erro: `Código(s) não encontrado(s) nesta edição: ${faltando.join(', ')}` });
    }

    let subtotalCirurgiaoSessao = 0;
    let baseEquipeSessao = 0;
    let maiorPorteAnestesico = 0;
    let anestesistaAplicavel = false;
    let equipeAplicavel = false;

    const procedimentosCalculados = procedimentos.map((p) => {
      const r = porCodigo.get(Number(p.codigo));
      const relacaoPct = pctRelacao[p.relacao];
      if (relacaoPct === undefined) {
        throw Object.assign(new Error(`Relação inválida para o código ${p.codigo}: ${p.relacao}`), { status: 400 });
      }

      // Ver nota em /api/consultar: a coluna total_porte/total_porte_anestesico
      // da planilha-fonte das edições 2004-2017 embute um fator de 10% em 100%
      // das linhas — recalculamos a partir de fração×valor_porte em vez de
      // confiar no total já gravado.
      const valorPorte = Number(r.valor_porte) || 0;
      const fracaoPorte = Number(r.fracao_porte) || 0;
      const totalPorteBase = Number((fracaoPorte * valorPorte).toFixed(2));
      const totalPorteAjustado = totalPorteBase * (1 + pctPorte / 100);
      const portePago = totalPorteAjustado * (relacaoPct / 100);

      const qtdUco = Number(r.uco) || 0;
      const valorUcoRef = Number(r.valor_uco_referencia) || 0;
      const totalUco = qtdUco * valorUcoRef * (1 + pctUco / 100);

      const qtdFilme = Number(r.quantidade_filme) || 0;
      const totalFilme = qtdFilme * valorFilme * (1 + pctFilme / 100);

      const totalPorteANBase = Number(r.valor_porte_anestesico) || 0;
      const totalPorteAN = totalPorteANBase * (1 + pctPorteAN / 100);
      const temAnestesia = Boolean(r.porte_anestesico) && r.porte_anestesico !== '0';

      const equipeBaseProcedimento = valorPorte * (relacaoPct / 100);

      subtotalCirurgiaoSessao += portePago + totalUco + totalFilme;
      baseEquipeSessao += equipeBaseProcedimento;
      if (temAnestesia) {
        anestesistaAplicavel = true;
        if (totalPorteAN > maiorPorteAnestesico) maiorPorteAnestesico = totalPorteAN;
      }
      if (Number(r.numero_auxiliares) > 0) equipeAplicavel = true;

      return {
        codigo: Number(p.codigo),
        descricao: r.descricao,
        relacao: p.relacao,
        percentual_relacao: relacaoPct,
        porte: {
          classificacao: r.porte,
          valor_unitario: valorPorte,
          total_pago: Number(portePago.toFixed(2)),
        },
        uco: { quantidade: qtdUco, total: Number(totalUco.toFixed(2)) },
        filme: { quantidade_m2: qtdFilme, total: Number(totalFilme.toFixed(2)) },
        porte_anestesico: {
          aplicavel: temAnestesia,
          classificacao: r.porte_anestesico,
          total: Number(totalPorteAN.toFixed(2)),
        },
      };
    });

    const papeis = [
      { papel: '1º Auxiliar', percentual: pct1Auxiliar },
      { papel: '2º Auxiliar', percentual: pct2Auxiliar },
      { papel: '3º Auxiliar', percentual: pct3Auxiliar },
      { papel: '4º Auxiliar', percentual: pct4Auxiliar },
      { papel: 'Instrumentador', percentual: pctInstrumentador },
      { papel: 'Auxiliar de Anestesista', percentual: pctAuxAnestesista },
    ].map((p) => ({ ...p, total: Number(((baseEquipeSessao * p.percentual) / 100).toFixed(2)) }));
    const totalEquipe = papeis.reduce((soma, p) => soma + p.total, 0);

    res.json({
      procedimentos: procedimentosCalculados,
      sessao: {
        cirurgiao: { subtotal: Number(subtotalCirurgiaoSessao.toFixed(2)) },
        anestesista: {
          aplicavel: anestesistaAplicavel,
          total: Number(maiorPorteAnestesico.toFixed(2)),
        },
        equipe: {
          aplicavel: equipeAplicavel,
          base_calculo: Number(baseEquipeSessao.toFixed(2)),
          papeis,
          total: Number(totalEquipe.toFixed(2)),
        },
      },
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ erro: err.message });
    }
    console.error('Erro na consulta de múltiplos procedimentos:', err);
    res.status(500).json({ erro: 'Erro interno ao consultar múltiplos procedimentos.' });
  }
});

// Busca procedimentos SIGTAP por código exato ou por trecho do nome (ILIKE)
app.get('/api/sigtap/buscar', async (req, res) => {
  try {
    const termo = (req.query.q || '').trim();
    if (termo.length < 2) {
      return res.json([]);
    }

    const { rows } = await pool.query(
      `SELECT
         sp.codigo, sp.nome, sp.complexidade, sp.sexo,
         sp.qt_maxima_execucao, sp.qt_dias_permanencia, sp.qt_pontos, sp.tempo_permanencia,
         sp.idade_minima_legivel, sp.idade_maxima_legivel,
         sp.vl_sh, sp.vl_sa, sp.vl_sp,
         fin.nome AS financiamento_nome,
         rub.nome AS sub_tipo_financiamento_nome,
         g.nome  AS grupo_nome,
         sg.nome AS sub_grupo_nome,
         fo.nome AS forma_organizacao_nome,
         COALESCE(reg.lista, '{}') AS instrumentos_registro,
         COALESCE(mod.lista, '{}') AS modalidades_atendimento,
         COALESCE(det.lista, '{}') AS atributos_complementares
       FROM sigtap_procedimentos sp
       LEFT JOIN sigtap_financiamento fin     ON fin.codigo = sp.financiamento
       LEFT JOIN sigtap_rubrica rub           ON rub.codigo = sp.rubrica
       LEFT JOIN sigtap_grupo g               ON g.codigo  = LEFT(sp.codigo, 2)
       LEFT JOIN sigtap_sub_grupo sg          ON sg.codigo = LEFT(sp.codigo, 4)
       LEFT JOIN sigtap_forma_organizacao fo  ON fo.codigo = LEFT(sp.codigo, 6)
       LEFT JOIN LATERAL (
         SELECT array_agg(r.nome ORDER BY r.nome) AS lista
         FROM sigtap_procedimento_registro spr JOIN sigtap_registro r ON r.codigo = spr.codigo_registro
         WHERE spr.codigo_procedimento = sp.codigo
       ) reg ON true
       LEFT JOIN LATERAL (
         SELECT array_agg(m.nome ORDER BY m.nome) AS lista
         FROM sigtap_procedimento_modalidade spm JOIN sigtap_modalidade m ON m.codigo = spm.codigo_modalidade
         WHERE spm.codigo_procedimento = sp.codigo
       ) mod ON true
       LEFT JOIN LATERAL (
         SELECT array_agg(d.nome ORDER BY d.nome) AS lista
         FROM sigtap_procedimento_detalhe spd JOIN sigtap_detalhe d ON d.codigo = spd.codigo_detalhe
         WHERE spd.codigo_procedimento = sp.codigo
       ) det ON true
       WHERE sp.codigo = $1 OR sp.nome ILIKE $2
       ORDER BY (sp.codigo = $1) DESC, sp.nome
       LIMIT 50`,
      [termo, `%${termo}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro na busca SIGTAP:', err);
    res.status(500).json({ erro: 'Erro ao buscar procedimentos SIGTAP.' });
  }
});

// Preço-teto CMED (medicamentos) — dado público/aberto da ANVISA (não é Simpro
// nem Brasíndice, que são bases comerciais pagas). Busca por nome do produto,
// substância ou número de registro ANVISA.
app.get('/api/cmed/buscar', async (req, res) => {
  try {
    const termo = (req.query.q || '').trim();
    if (termo.length < 2) {
      return res.json([]);
    }

    const { rows } = await pool.query(
      `SELECT
         codigo_ggrem, substancia, laboratorio, registro, produto, apresentacao,
         classe_terapeutica, tipo_produto, regime_preco, pf_sem_impostos,
         pmc_sem_impostos, pf_faixas, pmc_faixas, restricao_hospitalar, tarja,
         comercializacao_2025, atualizado_em
       FROM cmed_medicamentos
       WHERE registro = $1 OR produto ILIKE $2 OR substancia ILIKE $2
       ORDER BY (registro = $1) DESC, produto
       LIMIT 40`,
      [termo, `%${termo}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro na busca CMED:', err);
    res.status(500).json({ erro: 'Erro ao buscar medicamentos na base CMED.' });
  }
});

// Data de publicação do arquivo CMED carregado no banco (header Last-Modified
// da fonte oficial ANVISA), e se a ANVISA já publicou uma versão mais nova.
app.get('/api/cmed/status', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT publicado_em, atualizado_em, total_registros FROM cmed_metadata WHERE id = 1');
    const atual = rows[0] || null;

    let ultimaModificacao = null;
    let erroVerificacao = null;
    try {
      ultimaModificacao = await buscarUltimaModificacaoAnvisa();
    } catch (err) {
      console.error('Erro ao verificar atualização CMED na ANVISA:', err);
      erroVerificacao = 'Não foi possível verificar atualizações agora.';
    }

    const publicadoEm = atual && atual.publicado_em ? new Date(atual.publicado_em) : null;
    res.json({
      publicadoEm,
      atualizadoEm: atual ? atual.atualizado_em : null,
      totalRegistros: atual ? atual.total_registros : null,
      ultimaModificacao,
      atualizacaoDisponivel: Boolean(publicadoEm && ultimaModificacao && ultimaModificacao > publicadoEm),
      erroVerificacao,
    });
  } catch (err) {
    console.error('Erro ao consultar status do CMED:', err);
    res.status(500).json({ erro: 'Erro ao consultar status do CMED.' });
  }
});

// Baixa e reimporta o Preço-teto CMED direto da ANVISA. Protegido pela mesma
// senha administrativa do SIGTAP (SIGTAP_UPDATE_SENHA no .env) — evita que
// qualquer visitante dispare o download/reescrita do banco.
app.post('/api/cmed/atualizar', async (req, res) => {
  try {
    const { senha } = req.body || {};
    if (!process.env.SIGTAP_UPDATE_SENHA || senha !== process.env.SIGTAP_UPDATE_SENHA) {
      return res.status(401).json({ erro: 'Senha inválida.' });
    }

    const resultado = await atualizarCmed(pool);
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao atualizar CMED:', err);
    res.status(500).json({ erro: 'Erro ao atualizar a base CMED.' });
  }
});

// Cadastro de Operadoras Ativas (ANS) — dado público/institucional (CNPJ,
// endereço, telefone, e-mail da empresa registrada), sem nenhum dado de
// beneficiário. Busca por razão social, nome fantasia, registro ANS ou CNPJ.
app.get('/api/operadoras/buscar', async (req, res) => {
  try {
    const termo = (req.query.q || '').trim();
    if (termo.length < 2) {
      return res.json([]);
    }
    const termoDigitos = termo.replace(/\D/g, '');

    const { rows } = await pool.query(
      `SELECT
         registro_ans, cnpj, razao_social, nome_fantasia, modalidade,
         logradouro, numero, complemento, bairro, cidade, uf, cep, ddd,
         telefone, fax, email, regiao_comercializacao, data_registro_ans,
         atualizado_em
       FROM operadoras_ans
       WHERE registro_ans = $1 OR (length($3) > 0 AND cnpj = $3)
          OR razao_social ILIKE $2 OR nome_fantasia ILIKE $2
       ORDER BY (registro_ans = $1) DESC, razao_social
       LIMIT 40`,
      [termo, `%${termo}%`, termoDigitos]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro na busca de operadoras:', err);
    res.status(500).json({ erro: 'Erro ao buscar operadoras.' });
  }
});

// Data de publicação do arquivo de operadoras carregado no banco, e se a
// ANS já publicou uma versão mais nova.
app.get('/api/operadoras/status', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT publicado_em, atualizado_em, total_registros FROM operadoras_metadata WHERE id = 1');
    const atual = rows[0] || null;

    let ultimaModificacao = null;
    let erroVerificacao = null;
    try {
      ultimaModificacao = await buscarUltimaModificacaoAns();
    } catch (err) {
      console.error('Erro ao verificar atualização de operadoras na ANS:', err);
      erroVerificacao = 'Não foi possível verificar atualizações agora.';
    }

    const publicadoEm = atual && atual.publicado_em ? new Date(atual.publicado_em) : null;
    res.json({
      publicadoEm,
      atualizadoEm: atual ? atual.atualizado_em : null,
      totalRegistros: atual ? atual.total_registros : null,
      ultimaModificacao,
      atualizacaoDisponivel: Boolean(publicadoEm && ultimaModificacao && ultimaModificacao > publicadoEm),
      erroVerificacao,
    });
  } catch (err) {
    console.error('Erro ao consultar status de operadoras:', err);
    res.status(500).json({ erro: 'Erro ao consultar status de operadoras.' });
  }
});

// Baixa e reimporta o Cadastro de Operadoras direto da ANS. Protegido pela
// mesma senha administrativa do SIGTAP/CMED (SIGTAP_UPDATE_SENHA no .env).
app.post('/api/operadoras/atualizar', async (req, res) => {
  try {
    const { senha } = req.body || {};
    if (!process.env.SIGTAP_UPDATE_SENHA || senha !== process.env.SIGTAP_UPDATE_SENHA) {
      return res.status(401).json({ erro: 'Senha inválida.' });
    }

    const resultado = await atualizarOperadoras(pool);
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao atualizar operadoras:', err);
    res.status(500).json({ erro: 'Erro ao atualizar a base de operadoras.' });
  }
});

// Competência atual da Tabela Unificada SIGTAP carregada no banco, e se há
// uma competência mais nova disponível no espelho GitHub (RenatoKR/SIGTAP,
// sincronizado diariamente com o FTP oficial do DATASUS).
app.get('/api/sigtap/status', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT competencia, atualizado_em FROM sigtap_metadata WHERE id = 1');
    const atual = rows[0] || null;

    let ultimaDisponivel = null;
    let erroVerificacao = null;
    try {
      const ultima = await buscarUltimaDisponivelGitHub();
      ultimaDisponivel = ultima.competencia;
    } catch (err) {
      console.error('Erro ao verificar atualização SIGTAP no GitHub:', err);
      erroVerificacao = 'Não foi possível verificar atualizações agora.';
    }

    res.json({
      competencia: atual ? atual.competencia : null,
      competenciaLegivel: atual ? competenciaLegivel(atual.competencia) : null,
      atualizadoEm: atual ? atual.atualizado_em : null,
      ultimaDisponivel,
      ultimaDisponivelLegivel: ultimaDisponivel ? competenciaLegivel(ultimaDisponivel) : null,
      atualizacaoDisponivel: Boolean(atual && ultimaDisponivel && ultimaDisponivel > atual.competencia),
      erroVerificacao,
    });
  } catch (err) {
    console.error('Erro ao consultar status do SIGTAP:', err);
    res.status(500).json({ erro: 'Erro ao consultar status do SIGTAP.' });
  }
});

// Baixa e reimporta a Tabela Unificada SIGTAP mais recente do espelho
// GitHub. Protegido por senha simples (SIGTAP_UPDATE_SENHA no .env) — evita
// que qualquer visitante do portal dispare downloads e reescrita do banco.
app.post('/api/sigtap/atualizar', async (req, res) => {
  try {
    const { senha } = req.body || {};
    if (!process.env.SIGTAP_UPDATE_SENHA || senha !== process.env.SIGTAP_UPDATE_SENHA) {
      return res.status(401).json({ erro: 'Senha inválida.' });
    }

    const resultado = await atualizarSigtap(pool);
    res.json({
      ok: true,
      competencia: resultado.competencia,
      competenciaLegivel: competenciaLegivel(resultado.competencia),
      arquivo: resultado.arquivo,
      resumo: resultado.resumo,
    });
  } catch (err) {
    console.error('Erro ao atualizar SIGTAP:', err);
    res.status(500).json({ erro: 'Erro ao atualizar a base SIGTAP: ' + err.message });
  }
});

// Verifica compatibilidade entre 2+ procedimentos SIGTAP (par a par) — usa
// a tabela oficial de compatibilidade (rl_procedimento_compativel) e as
// exceções (rl_excecao_compatibilidade, quando a presença de um terceiro
// código anula a compatibilidade). Ausência de registro NÃO significa
// necessariamente incompatibilidade — só que não há registro explícito.
app.get('/api/sigtap/compatibilidade', async (req, res) => {
  try {
    const codigos = [...new Set((req.query.codigos || '').split(',').map((s) => s.trim()).filter(Boolean))];
    if (codigos.length < 2) {
      return res.status(400).json({ erro: 'Informe pelo menos 2 códigos, separados por vírgula.' });
    }

    const [{ rows: compat }, { rows: excecoes }, { rows: nomes }] = await Promise.all([
      pool.query(
        `SELECT codigo_principal, codigo_compativel, tipo_compatibilidade, quantidade_permitida
         FROM sigtap_procedimento_compativel
         WHERE codigo_principal = ANY($1) AND codigo_compativel = ANY($1)`,
        [codigos]
      ),
      pool.query(
        `SELECT codigo_restricao, codigo_principal, codigo_compativel
         FROM sigtap_excecao_compatibilidade
         WHERE codigo_principal = ANY($1) AND codigo_compativel = ANY($1)`,
        [codigos]
      ),
      pool.query('SELECT codigo, nome FROM sigtap_procedimentos WHERE codigo = ANY($1)', [codigos]),
    ]);
    const nomePorCodigo = Object.fromEntries(nomes.map((n) => [n.codigo, n.nome]));

    const pares = [];
    for (let i = 0; i < codigos.length; i++) {
      for (let j = i + 1; j < codigos.length; j++) {
        const a = codigos[i];
        const b = codigos[j];
        const encontrado = compat.find(
          (c) => (c.codigo_principal === a && c.codigo_compativel === b) || (c.codigo_principal === b && c.codigo_compativel === a)
        );
        const excecoesPar = excecoes.filter(
          (e) =>
            ((e.codigo_principal === a && e.codigo_compativel === b) || (e.codigo_principal === b && e.codigo_compativel === a)) &&
            codigos.includes(e.codigo_restricao)
        );
        pares.push({
          codigoA: a,
          nomeA: nomePorCodigo[a] || null,
          codigoB: b,
          nomeB: nomePorCodigo[b] || null,
          compativel: Boolean(encontrado),
          tipoCompatibilidade: encontrado ? encontrado.tipo_compatibilidade : null,
          quantidadePermitida: encontrado ? encontrado.quantidade_permitida : null,
          excecoesAplicaveis: excecoesPar.map((e) => e.codigo_restricao),
        });
      }
    }
    res.json({ codigos, codigosNaoEncontrados: codigos.filter((c) => !nomePorCodigo[c]), pares });
  } catch (err) {
    console.error('Erro ao verificar compatibilidade SIGTAP:', err);
    res.status(500).json({ erro: 'Erro ao verificar compatibilidade.' });
  }
});

// Habilitações exigidas do prestador para um procedimento SIGTAP.
app.get('/api/sigtap/habilitacao', async (req, res) => {
  try {
    const codigo = (req.query.codigo || '').trim();
    if (!codigo) {
      return res.status(400).json({ erro: 'Informe o código do procedimento.' });
    }
    const [{ rows }, { rows: procRows }] = await Promise.all([
      pool.query(
        `SELECT sh.codigo, sh.nome,
                sph.codigo_grupo_habilitacao AS grupo_codigo,
                sgh.nome AS grupo_nome, sgh.descricao AS grupo_descricao
         FROM sigtap_procedimento_habilitacao sph
         JOIN sigtap_habilitacao sh ON sh.codigo = sph.codigo_habilitacao
         LEFT JOIN sigtap_grupo_habilitacao sgh ON sgh.codigo = sph.codigo_grupo_habilitacao
         WHERE sph.codigo_procedimento = $1
         ORDER BY sph.codigo_grupo_habilitacao NULLS LAST, sh.nome`,
        [codigo]
      ),
      pool.query('SELECT nome FROM sigtap_procedimentos WHERE codigo = $1', [codigo]),
    ]);
    res.json({ codigo, procedimentoNome: procRows[0]?.nome || null, habilitacoes: rows });
  } catch (err) {
    console.error('Erro ao consultar habilitação SIGTAP:', err);
    res.status(500).json({ erro: 'Erro ao consultar habilitação.' });
  }
});

// Conversor CBHPM <-> TUSS <-> SIGTAP: a partir de QUALQUER código de
// qualquer uma das 3 tabelas, encontra os equivalentes nas outras duas.
// Funciona em 2 passos porque não há uma tabela única com as 3 pontas:
// primeiro acha o(s) código(s) TUSS relacionados ao código informado (via
// mapeamento_amb_tuss para CBHPM, ou diretamente se o código já for TUSS/
// SIGTAP), depois usa esses códigos TUSS como ponte para buscar nas duas
// tabelas de mapeamento de novo.
app.get('/api/conversor', async (req, res) => {
  try {
    const codigo = (req.query.codigo || '').trim();
    if (!codigo) {
      return res.status(400).json({ erro: 'Informe um código.' });
    }

    const [porCbhpmOuTuss, porTussOuSigtap, direto] = await Promise.all([
      pool.query(
        `SELECT DISTINCT codigo_cbhpm, codigo_tuss, procedimento
         FROM mapeamento_amb_tuss
         WHERE codigo_cbhpm::text = $1 OR codigo_tuss = $1
         LIMIT 20`,
        [codigo]
      ),
      pool.query(
        `SELECT DISTINCT codigo_tuss, termo_tuss, codigo_sigtap, procedimento_sigtap, grau_equivalencia
         FROM mapeamento_tuss_sigtap
         WHERE codigo_tuss = $1 OR codigo_sigtap = $1
         LIMIT 20`,
        [codigo]
      ),
      pool.query('SELECT codigo, nome FROM sigtap_procedimentos WHERE codigo = $1', [codigo]),
    ]);

    const codigosTuss = new Set();
    porCbhpmOuTuss.rows.forEach((r) => r.codigo_tuss && codigosTuss.add(r.codigo_tuss));
    porTussOuSigtap.rows.forEach((r) => r.codigo_tuss && codigosTuss.add(r.codigo_tuss));

    let cbhpm = porCbhpmOuTuss.rows;
    let tussSigtap = porTussOuSigtap.rows;

    if (codigosTuss.size > 0) {
      const tussArr = [...codigosTuss];
      const [c, s] = await Promise.all([
        pool.query(
          `SELECT DISTINCT codigo_cbhpm, codigo_tuss, procedimento FROM mapeamento_amb_tuss WHERE codigo_tuss = ANY($1) LIMIT 30`,
          [tussArr]
        ),
        pool.query(
          `SELECT DISTINCT codigo_tuss, termo_tuss, codigo_sigtap, procedimento_sigtap, grau_equivalencia
           FROM mapeamento_tuss_sigtap WHERE codigo_tuss = ANY($1) LIMIT 30`,
          [tussArr]
        ),
      ]);
      cbhpm = c.rows;
      tussSigtap = s.rows;
    }

    const encontrado = cbhpm.length > 0 || tussSigtap.length > 0 || direto.rows.length > 0;
    res.json({
      codigo,
      encontrado,
      cbhpmTuss: cbhpm,
      tussSigtap,
      sigtapDireto: direto.rows[0] || null,
    });
  } catch (err) {
    console.error('Erro no conversor CBHPM/TUSS/SIGTAP:', err);
    res.status(500).json({ erro: 'Erro ao converter código.' });
  }
});

// Busca CID-10 por código exato (subcategoria ou categoria) ou por trecho do
// nome. Buscar pelo código de uma categoria (ex: "J45") traz também todas as
// suas subcategorias (J45.0, J45.1...). Categorias sem subcategoria própria
// (códigos "folha" de 3 caracteres) entram na busca por texto/código também.
app.get('/api/cid10/buscar', async (req, res) => {
  try {
    const termo = (req.query.q || '').trim();
    if (termo.length < 2) {
      return res.json([]);
    }
    const codigoBusca = termo.toUpperCase().replace(/[.\s]/g, '');

    const { rows } = await pool.query(
      `SELECT 4 AS nivel, s.codigo, s.nome, c.nome AS categoria_nome, s.codigo_categoria AS categoria_codigo
       FROM cid10_subcategoria s
       JOIN cid10_categoria c ON c.codigo = s.codigo_categoria
       WHERE s.codigo = $1 OR s.codigo_categoria = $1 OR s.nome ILIKE $2
       UNION ALL
       SELECT 3 AS nivel, c.codigo, c.nome, NULL AS categoria_nome, NULL AS categoria_codigo
       FROM cid10_categoria c
       WHERE (c.codigo = $1 OR c.nome ILIKE $2)
         AND NOT EXISTS (SELECT 1 FROM cid10_subcategoria s2 WHERE s2.codigo_categoria = c.codigo)
       ORDER BY nivel DESC, codigo
       LIMIT 100`,
      [codigoBusca, `%${termo}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro na busca CID-10:', err);
    res.status(500).json({ erro: 'Erro ao buscar códigos CID-10.' });
  }
});

// Busca em lote (por código exato) usada pelos Validadores SUS (BPA/AIH/APAC)
// para conferir se os códigos de procedimento lançados existem na SIGTAP e
// para compor o relatório de conferência (PDF) com nome e valores SH/SA/SP,
// sem 1 requisição por linha do arquivo.
app.post('/api/sigtap/lote', async (req, res) => {
  try {
    const codigos = Array.isArray(req.body.codigos) ? [...new Set(req.body.codigos.map(String))] : [];
    if (codigos.length === 0) return res.json([]);
    const { rows } = await pool.query(
      'SELECT codigo, nome, sexo, vl_sh, vl_sa, vl_sp FROM sigtap_procedimentos WHERE codigo = ANY($1)',
      [codigos]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro na busca em lote SIGTAP:', err);
    res.status(500).json({ erro: 'Erro ao buscar procedimentos SIGTAP em lote.' });
  }
});

// Idem para CID-10 — usada pelo Validador BPA para conferir o campo Prd-cid
// do BPA-I contra os códigos oficiais (categoria de 3 dígitos ou subcategoria
// de 4 dígitos).
app.post('/api/cid10/lote', async (req, res) => {
  try {
    const codigos = Array.isArray(req.body.codigos) ? [...new Set(req.body.codigos.map(String))] : [];
    if (codigos.length === 0) return res.json([]);
    const { rows } = await pool.query(
      `SELECT codigo, nome FROM cid10_subcategoria WHERE codigo = ANY($1)
       UNION ALL
       SELECT codigo, nome FROM cid10_categoria WHERE codigo = ANY($1)`,
      [codigos]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro na busca em lote CID-10:', err);
    res.status(500).json({ erro: 'Erro ao buscar códigos CID-10 em lote.' });
  }
});

// O layout do AIH não traz o nome do estabelecimento — só CNES + código do
// município (sem DV). Consultamos o CNESNet público do DATASUS (não tem API
// oficial, então extraímos o campo "Nome:" do HTML) para o relatório de
// conferência do Validador AIH. Cache em memória (processo do servidor) já
// que o nome de um estabelecimento praticamente não muda.
const cnesNomeCache = new Map();
async function buscarNomeCnes(municipio, cnes) {
  const chave = `${municipio}${cnes}`;
  if (cnesNomeCache.has(chave)) return cnesNomeCache.get(chave);
  try {
    const resp = await fetch(`https://cnes2.datasus.gov.br/Mod_Conjunto.asp?VCo_Unidade=${chave}`, {
      signal: AbortSignal.timeout(8000),
    });
    const html = Buffer.from(await resp.arrayBuffer()).toString('latin1');
    const m = html.match(/<b>Nome:<\/b><\/font><\/td>[\s\S]*?<td colspan=3><font[^>]*>([^<]*)<\/font><\/td>/i);
    const nome = m ? m[1].replace(/\s+/g, ' ').trim() || null : null;
    cnesNomeCache.set(chave, nome);
    return nome;
  } catch (err) {
    console.error('Erro ao consultar CNES', chave, err.message);
    return null; // não cacheia falha de rede — pode ser transitória
  }
}

app.post('/api/cnes/lote', async (req, res) => {
  try {
    const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
    const unicos = [...new Map(
      itens
        .filter((i) => /^\d{6}$/.test(i && i.municipio) && /^\d{7}$/.test(i && i.cnes))
        .map((i) => [`${i.municipio}${i.cnes}`, i])
    ).values()].slice(0, 30); // teto defensivo: um arquivo AIH raramente tem mais que 1-2 hospitais

    const resultados = [];
    for (const { municipio, cnes } of unicos) {
      resultados.push({ municipio, cnes, nome: await buscarNomeCnes(municipio, cnes) });
    }
    res.json(resultados);
  } catch (err) {
    console.error('Erro na busca em lote CNES:', err);
    res.status(500).json({ erro: 'Erro ao buscar estabelecimentos CNES em lote.' });
  }
});

// Rotina automática do Preço-teto CMED: a ANVISA publica uma nova versão do
// arquivo por mês, sempre na mesma URL — então "atualizar" é só comparar o
// header Last-Modified contra o que já está no banco (cmed_metadata) e
// reimportar se houver algo mais novo. Roda sozinha, sem senha nem clique
// (é só releitura de dado público), verificando a cada 24h; o botão manual
// na tela continua disponível pra forçar uma checagem imediata.
const CMED_INTERVALO_AUTO_MS = 24 * 60 * 60 * 1000;
async function checarAtualizacaoAutomaticaCmed() {
  try {
    const { rows } = await pool.query('SELECT publicado_em FROM cmed_metadata WHERE id = 1');
    const publicadoEm = rows[0]?.publicado_em ? new Date(rows[0].publicado_em) : null;
    const ultimaModificacao = await buscarUltimaModificacaoAnvisa();

    if (!publicadoEm || (ultimaModificacao && ultimaModificacao > publicadoEm)) {
      console.log('[cmed] Nova versão detectada na ANVISA, atualizando automaticamente...');
      const resultado = await atualizarCmed(pool);
      console.log(`[cmed] Atualização automática concluída: ${resultado.totalRegistros} registros, publicado em ${resultado.publicadoEm}.`);
    } else {
      console.log('[cmed] Nenhuma atualização disponível (checagem automática).');
    }
  } catch (err) {
    console.error('[cmed] Erro na checagem/atualização automática:', err.message);
  }
}

// Mesma lógica da rotina do CMED, pro Cadastro de Operadoras da ANS.
const OPERADORAS_INTERVALO_AUTO_MS = 24 * 60 * 60 * 1000;
async function checarAtualizacaoAutomaticaOperadoras() {
  try {
    const { rows } = await pool.query('SELECT publicado_em FROM operadoras_metadata WHERE id = 1');
    const publicadoEm = rows[0]?.publicado_em ? new Date(rows[0].publicado_em) : null;
    const ultimaModificacao = await buscarUltimaModificacaoAns();

    if (!publicadoEm || (ultimaModificacao && ultimaModificacao > publicadoEm)) {
      console.log('[operadoras] Nova versão detectada na ANS, atualizando automaticamente...');
      const resultado = await atualizarOperadoras(pool);
      console.log(`[operadoras] Atualização automática concluída: ${resultado.totalRegistros} registros, publicado em ${resultado.publicadoEm}.`);
    } else {
      console.log('[operadoras] Nenhuma atualização disponível (checagem automática).');
    }
  } catch (err) {
    console.error('[operadoras] Erro na checagem/atualização automática:', err.message);
  }
}

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });

  setTimeout(checarAtualizacaoAutomaticaCmed, 10_000);
  setInterval(checarAtualizacaoAutomaticaCmed, CMED_INTERVALO_AUTO_MS);

  setTimeout(checarAtualizacaoAutomaticaOperadoras, 15_000);
  setInterval(checarAtualizacaoAutomaticaOperadoras, OPERADORAS_INTERVALO_AUTO_MS);
}

module.exports = app;
