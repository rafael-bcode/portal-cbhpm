require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const packageJson = require('./package.json');
const changelog = require('./CHANGELOG.json');

const app = express();
app.use(express.json());
app.use(express.static('public')); // serve os arquivos da tela (HTML/CSS/JS)

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
      // Usa os totais já gravados da planilha como base (e não fração×valor_porte
      // recalculado), pois as edições 2004-2017 embutem um fator de 10% no total
      // do porte/porte anestésico que não aparece no valor unitário isoladamente.
      const valorPorte = Number(r.valor_porte) || 0;
      const fracaoPorte = Number(r.fracao_porte) || 0;
      const totalPorteBase = Number(r.total_porte) || 0;
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
      const valorPorteAN = Number(r.valor_porte_anestesico) || 0;
      const totalPorteANBase = Number(r.total_porte_anestesico) || 0;
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

      const valorPorte = Number(r.valor_porte) || 0;
      const totalPorteBase = Number(r.total_porte) || 0;
      const totalPorteAjustado = totalPorteBase * (1 + pctPorte / 100);
      const portePago = totalPorteAjustado * (relacaoPct / 100);

      const qtdUco = Number(r.uco) || 0;
      const valorUcoRef = Number(r.valor_uco_referencia) || 0;
      const totalUco = qtdUco * valorUcoRef * (1 + pctUco / 100);

      const qtdFilme = Number(r.quantidade_filme) || 0;
      const totalFilme = qtdFilme * valorFilme * (1 + pctFilme / 100);

      const totalPorteANBase = Number(r.total_porte_anestesico) || 0;
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

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
