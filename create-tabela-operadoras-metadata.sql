-- Data de publicação do arquivo oficial de operadoras (header Last-Modified
-- de dadosabertos.ans.gov.br) e quando o portal importou essa versão pela
-- última vez. Linha única (id sempre 1).
CREATE TABLE operadoras_metadata (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    publicado_em TIMESTAMPTZ,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_registros INTEGER
);
