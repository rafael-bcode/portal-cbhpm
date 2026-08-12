-- Data de publicação do arquivo oficial da CMED (header Last-Modified de
-- dados.anvisa.gov.br/dados/TA_PRECO_MEDICAMENTO.csv) e quando o portal
-- importou essa versão pela última vez. Linha única (id sempre 1).
CREATE TABLE cmed_metadata (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    publicado_em TIMESTAMPTZ,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_registros INTEGER
);
