-- Tabela CID-10 (Classificação Estatística Internacional de Doenças e
-- Problemas Relacionados à Saúde, 10ª revisão) — usada no campo <ans:cid>
-- das guias TISS e referenciada em várias mensagens de glosa (ex: "1808 -
-- PROCEDIMENTO NÃO CONFORME COM CID").
-- Fonte oficial: DATASUS (http://www2.datasus.gov.br/cid10/V2008/download.htm)

CREATE TABLE cid10_capitulo (
    numero INTEGER PRIMARY KEY,
    categoria_inicial VARCHAR(3) NOT NULL,
    categoria_final VARCHAR(3) NOT NULL,
    nome TEXT NOT NULL
);

CREATE TABLE cid10_categoria (
    codigo VARCHAR(3) PRIMARY KEY,
    nome TEXT NOT NULL
);

CREATE TABLE cid10_subcategoria (
    codigo VARCHAR(4) PRIMARY KEY,
    codigo_categoria VARCHAR(3) NOT NULL REFERENCES cid10_categoria(codigo),
    nome TEXT NOT NULL
);

CREATE INDEX idx_cid10_categoria_nome ON cid10_categoria USING gin(to_tsvector('portuguese', nome));
CREATE INDEX idx_cid10_subcategoria_nome ON cid10_subcategoria USING gin(to_tsvector('portuguese', nome));
