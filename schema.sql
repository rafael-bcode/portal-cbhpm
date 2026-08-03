-- ============================================
-- Schema do Portal de Consulta CBHPM
-- ============================================

-- 1. Edições da CBHPM
CREATE TABLE edicoes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE,       -- ex: '9ª EDIÇÃO - 2017'
    ano_inicio INTEGER NOT NULL,
    ano_fim INTEGER
);

-- 2. Procedimentos (dados fixos, não repetem por edição)
CREATE TABLE procedimentos (
    codigo BIGINT PRIMARY KEY,
    descricao TEXT NOT NULL
);

-- 3. Tabela de referência: Porte -> Valor (varia por edição)
CREATE TABLE tabela_porte (
    id SERIAL PRIMARY KEY,
    edicao_id INTEGER NOT NULL REFERENCES edicoes(id),
    porte VARCHAR(5) NOT NULL,              -- ex: '10A', 'UCO'
    valor NUMERIC(12,2) NOT NULL,
    UNIQUE(edicao_id, porte)
);

-- 4. Tabela de referência: Porte Anestésico -> Valor (varia por edição)
CREATE TABLE tabela_porte_anestesico (
    id SERIAL PRIMARY KEY,
    edicao_id INTEGER NOT NULL REFERENCES edicoes(id),
    porte_an VARCHAR(5) NOT NULL,           -- ex: '0' a '8'
    valor NUMERIC(12,2) NOT NULL,
    UNIQUE(edicao_id, porte_an)
);

-- 5. Valores do procedimento por edição (tabela principal, a "fato")
CREATE TABLE valores_procedimento (
    id SERIAL PRIMARY KEY,
    codigo BIGINT NOT NULL REFERENCES procedimentos(codigo),
    edicao_id INTEGER NOT NULL REFERENCES edicoes(id),
    porte VARCHAR(5),
    fracao_porte NUMERIC(6,2),
    valor_porte NUMERIC(12,2),
    total_porte NUMERIC(14,3),
    incidencias NUMERIC(10,4),
    filme NUMERIC(10,4),
    total_filme NUMERIC(14,4),
    uco NUMERIC(10,3),
    total_uco NUMERIC(14,4),
    porte_anestesico VARCHAR(5),
    valor_porte_anestesico NUMERIC(12,2),
    total_porte_anestesico NUMERIC(14,2),
    numero_auxiliares INTEGER,
    total_auxiliares NUMERIC(12,2),
    total_1_auxiliar NUMERIC(12,2),
    total_2_auxiliar NUMERIC(12,2),
    total_3_auxiliar NUMERIC(12,2),
    total_4_auxiliar NUMERIC(12,2),
    subtotal NUMERIC(14,5) NOT NULL,
    UNIQUE(codigo, edicao_id)
);

-- Índices para consulta rápida (o principal uso do portal)
CREATE INDEX idx_valores_codigo ON valores_procedimento(codigo);
CREATE INDEX idx_valores_edicao ON valores_procedimento(edicao_id);
CREATE INDEX idx_procedimentos_descricao ON procedimentos USING gin(to_tsvector('portuguese', descricao));

-- 6. Mapeamento CBHPM <-> AMB (90/92/96/99) <-> TUSS/ANS.
-- Sem FK para procedimentos(codigo): a fonte de dados atual (amb_tuss_dados.json)
-- tem ~600 códigos CBHPM sem correspondência em procedimentos e ~180 linhas com
-- codigo_cbhpm nulo (mapeamento só por TUSS/AMB). Adicionar a FK quebraria a
-- importação até que a fonte de dados seja revisada.
CREATE TABLE mapeamento_amb_tuss (
    id SERIAL PRIMARY KEY,
    codigo_cbhpm BIGINT,
    codigo_amb90 VARCHAR(10),
    codigo_amb92 VARCHAR(10),
    codigo_amb96 VARCHAR(10),
    codigo_amb99 VARCHAR(10),
    codigo_tuss VARCHAR(10),
    procedimento TEXT,
    procedimento_tuss TEXT
);

CREATE INDEX idx_mapeamento_codigo_cbhpm ON mapeamento_amb_tuss(codigo_cbhpm);
CREATE INDEX idx_mapeamento_codigo_tuss ON mapeamento_amb_tuss(codigo_tuss);
