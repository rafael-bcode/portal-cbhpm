require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static('public')); // serve os arquivos da tela (HTML/CSS/JS)

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
 *     "pctFilme": 0
 *   }
 * }
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
        vp.uco,
        vp.porte_anestesico,
        vp.valor_porte_anestesico,
        vp.filme AS quantidade_filme,
        vp.numero_auxiliares,
        vp.total_auxiliares,
        vp.subtotal AS subtotal_original,
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

    // Aplica o cálculo em cada edição retornada
    const resultado = rows.map((r) => {
      const valorPorte = Number(r.valor_porte) || 0;
      const fracaoPorte = Number(r.fracao_porte) || 0;
      const totalPorte = fracaoPorte * valorPorte * (1 + pctPorte / 100);

      const qtdUco = Number(r.uco) || 0;
      const valorUcoRef = Number(r.valor_uco_referencia) || 0;
      const totalUco = qtdUco * valorUcoRef * (1 + pctUco / 100);

      const valorPorteAN = Number(r.valor_porte_anestesico) || 0;
      const totalPorteAN = valorPorteAN * (1 + pctPorteAN / 100);

      const qtdFilme = Number(r.quantidade_filme) || 0;
      const totalFilme = qtdFilme * valorFilme * (1 + pctFilme / 100);

      const totalAuxiliares = Number(r.total_auxiliares) || 0;

      const totalCalculado = totalPorte + totalUco + totalPorteAN + totalFilme + totalAuxiliares;

      return {
        edicao: r.edicao_nome,
        ano: r.ano_inicio,
        descricao: r.descricao,
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
        porte_anestesico: {
          classificacao: r.porte_anestesico,
          valor_unitario: valorPorteAN,
          percentual_aplicado: pctPorteAN,
          total: Number(totalPorteAN.toFixed(2)),
        },
        filme: {
          quantidade_m2: qtdFilme,
          valor_informado: valorFilme,
          percentual_aplicado: pctFilme,
          total: Number(totalFilme.toFixed(2)),
        },
        auxiliares: {
          quantidade: r.numero_auxiliares,
          total: totalAuxiliares,
        },
        subtotal_calculado: Number(totalCalculado.toFixed(2)),
        subtotal_original_planilha: Number(r.subtotal_original),
      };
    });

    res.json({ codigo, mapeamento_amb_tuss: mapeamento, resultados: resultado });
  } catch (err) {
    console.error('Erro na consulta:', err);
    res.status(500).json({ erro: 'Erro interno ao consultar procedimento.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
