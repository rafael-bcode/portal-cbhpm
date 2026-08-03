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
