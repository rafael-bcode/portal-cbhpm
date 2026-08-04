-- Guarda a competência (período, AAAAMM) da Tabela Unificada SIGTAP
-- atualmente carregada no banco, e quando foi a última atualização.
-- Linha única (id sempre 1).
CREATE TABLE sigtap_metadata (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    competencia VARCHAR(6) NOT NULL,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sigtap_metadata (id, competencia) VALUES (1, '202607');
