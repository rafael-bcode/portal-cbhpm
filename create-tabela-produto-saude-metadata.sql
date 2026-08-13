-- Data de publicação do arquivo oficial de Produtos para Saúde (header
-- Last-Modified de dados.anvisa.gov.br/dados/TA_PRODUTO_SAUDE_SITE.csv) e
-- quando o portal importou essa versão pela última vez. Linha única (id
-- sempre 1) — mesmo padrão do cmed_metadata/cnes_metadata.
CREATE TABLE produto_saude_metadata (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    publicado_em TIMESTAMPTZ,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_registros INTEGER
);
