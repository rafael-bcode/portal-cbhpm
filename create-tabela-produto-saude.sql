-- Produtos para Saúde regularizados na ANVISA (Registro/Cadastro) — cobre
-- OPME (órteses, próteses e materiais especiais) junto com os demais
-- produtos para saúde (correlatos, diagnóstico in vitro etc.), já que a
-- ANVISA regula todos sob a mesma base. Fonte oficial e aberta:
-- dados.anvisa.gov.br/dados/TA_PRODUTO_SAUDE_SITE.csv — atualizada
-- diariamente (D-1) pela própria ANVISA. Dado institucional/regulatório do
-- fabricante e do produto, sem nenhum dado de paciente.
--
-- numero_registro_cadastro NÃO é chave única: um mesmo registro pode ter
-- mais de uma linha (um por fabricante/planta habilitada naquele registro)
-- — por isso o id é a chave primária, com índice (não único) no registro.
CREATE TABLE produtos_saude_anvisa (
    id BIGSERIAL PRIMARY KEY,
    numero_registro_cadastro TEXT NOT NULL,
    numero_processo TEXT,
    nome_tecnico TEXT,
    classe_risco TEXT,
    nome_comercial TEXT,
    cnpj_detentor TEXT,
    detentor_registro_cadastro TEXT,
    nome_fabricante TEXT,
    pais_fabricante TEXT,
    data_publicacao DATE,
    -- Valor bruto da ANVISA: ou o literal "VIGENTE" (sem prazo definido) ou
    -- uma data DD/MM/AAAA. validade_data guarda essa data já convertida
    -- (null quando o bruto é "VIGENTE") — é o que permite sinalizar registro
    -- vencido sem re-parsear texto na hora da busca.
    validade_bruta TEXT,
    validade_data DATE,
    atualizado_em_anvisa TIMESTAMPTZ,
    atualizado_em DATE
);

-- Busca é por ILIKE '%termo%' (nome comercial, nome técnico, detentor) —
-- mesmo padrão de índice trigram já usado no CMED/CNES/Operadoras, já que
-- índice de texto completo não acelera esse tipo de busca por substring.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_produto_saude_comercial_trgm ON produtos_saude_anvisa USING gin (nome_comercial gin_trgm_ops);
CREATE INDEX idx_produto_saude_tecnico_trgm ON produtos_saude_anvisa USING gin (nome_tecnico gin_trgm_ops);
CREATE INDEX idx_produto_saude_detentor_trgm ON produtos_saude_anvisa USING gin (detentor_registro_cadastro gin_trgm_ops);
CREATE INDEX idx_produto_saude_registro ON produtos_saude_anvisa (numero_registro_cadastro);
