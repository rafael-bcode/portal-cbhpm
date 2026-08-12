-- Competência (AAAAMM) da Base de Dados CNES atualmente carregada no
-- banco, e quando foi a última importação. Linha única (id sempre 1).
CREATE TABLE cnes_metadata (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    competencia VARCHAR(6),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_registros INTEGER
);
