require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const packageJson = require('./package.json');
const changelog = require('./CHANGELOG.json');

const app = express();
app.use(express.json());
app.use(express.static('public')); // serve os arquivos da tela (HTML/CSS/JS)

// Versão atual do portal e histórico de mudanças (exibidos no rodapé da tela)
app.get('/api/versao', (req, res) => {
  res.json({ versaoAtual: packageJson.version, changelog });
});

// Lista todas as edições disponíveis (usado para montar os checkboxes na tela)
app.get('/api/edicoes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nome, ano_inicio FROM edicoes ORDER BY ano_inicio');
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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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

    res.json({ codigo, resultados: resultado });
  } catch (err) {
    console.error('Erro na consulta:', err);
    res.status(500).json({ erro: 'Erro interno ao consultar procedimento.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
