-- Mapeamento TUSS (Tabela 22 - Procedimentos e Eventos em Saúde) x SIGTAP,
-- fonte: planilha oficial ANS "Mapeamento TUSS x SIGTAP" (compatibilização
-- publicada na página de Tabelas relacionadas do Padrão TISS). Usado no
-- conversor CBHPM ↔ TUSS ↔ SIGTAP (combinado com mapeamento_amb_tuss, que já
-- liga CBHPM a TUSS).
CREATE TABLE mapeamento_tuss_sigtap (
    id SERIAL PRIMARY KEY,
    codigo_tuss VARCHAR(8) NOT NULL,
    termo_tuss TEXT,
    codigo_sigtap VARCHAR(12) NOT NULL,
    procedimento_sigtap TEXT,
    grau_equivalencia SMALLINT
);
CREATE INDEX idx_mapeamento_tuss_sigtap_tuss ON mapeamento_tuss_sigtap(codigo_tuss);
CREATE INDEX idx_mapeamento_tuss_sigtap_sigtap ON mapeamento_tuss_sigtap(codigo_sigtap);
