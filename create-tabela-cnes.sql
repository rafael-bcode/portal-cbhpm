-- Cadastro Nacional de Estabelecimentos de Saúde (CNES) — fonte oficial e
-- aberta do DATASUS: cnes.datasus.gov.br/EstatisticasServlet?path=
-- BASE_DE_DADOS_CNES_AAAAMM.ZIP (tabela tbEstabelecimento, com nome de
-- município/natureza jurídica/tipo de estabelecimento já resolvidos a
-- partir das tabelas de domínio correspondentes). Dado institucional
-- público do estabelecimento — sem nenhuma informação de paciente.
-- Habilitações (UTI, oncologia etc.) ficam fora por enquanto — exigem join
-- com tabelas relacionadas adicionais (rlEstabServClass/tbServicoEspecializado).
-- Todas as colunas de texto/código usam TEXT sem limite — o arquivo real
-- (632 mil linhas) tem variações de formatação que estouraram mais de um
-- VARCHAR com limite "nominal" do layout oficial durante a importação; mais
-- seguro não impor limite do que a importação inteira falhar por causa de
-- uma linha fora do padrão.
CREATE TABLE cnes_estabelecimentos (
    codigo_cnes TEXT PRIMARY KEY,
    codigo_unidade TEXT,
    cnpj TEXT,
    cnpj_mantenedora TEXT,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cep TEXT,
    cidade TEXT,
    uf TEXT,
    codigo_municipio_ibge TEXT,
    telefone TEXT,
    fax TEXT,
    email TEXT,
    site TEXT,
    tipo_estabelecimento TEXT,
    natureza_juridica TEXT,
    latitude NUMERIC(11,7),
    longitude NUMERIC(11,7),
    atualizado_em DATE
);

-- Busca é por ILIKE '%termo%' (substring, não prefixo/palavra completa) —
-- índice de texto completo (to_tsvector) não acelera esse padrão; trigram
-- (pg_trgm) é o índice certo pra isso em uma tabela de 632 mil linhas.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_cnes_razao_trgm ON cnes_estabelecimentos USING gin (razao_social gin_trgm_ops);
CREATE INDEX idx_cnes_fantasia_trgm ON cnes_estabelecimentos USING gin (nome_fantasia gin_trgm_ops);
CREATE INDEX idx_cnes_cnpj ON cnes_estabelecimentos (cnpj);
CREATE INDEX idx_cnes_cidade_uf ON cnes_estabelecimentos (uf, cidade);
