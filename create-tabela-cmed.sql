-- Preço-teto CMED (Câmara de Regulação do Mercado de Medicamentos), fonte oficial
-- ANVISA: dados.anvisa.gov.br/dados/TA_PRECO_MEDICAMENTO.csv (dado público, aberto,
-- licença Creative Commons Atribuição-SemDerivações). Não substitui Simpro/Brasíndice:
-- só o teto legal (PF/PMC) de medicamentos, sem materiais/OPME e sem os campos
-- comerciais (código TUSS, classificação) que aquelas tabelas agregam por cima.
CREATE TABLE cmed_medicamentos (
    codigo_ggrem VARCHAR(20) PRIMARY KEY,
    substancia TEXT,
    laboratorio TEXT,
    cnpj VARCHAR(20),
    registro VARCHAR(20),
    ean1 VARCHAR(20),
    ean2 VARCHAR(20),
    ean3 VARCHAR(20),
    produto TEXT NOT NULL,
    apresentacao TEXT NOT NULL,
    classe_terapeutica TEXT,
    tipo_produto VARCHAR(40),
    regime_preco VARCHAR(20),          -- Regulado ou Liberado
    pf_sem_impostos NUMERIC(14,2),
    pmc_sem_impostos NUMERIC(14,2),
    pf_faixas JSONB,                   -- PF por alíquota de ICMS: {"0":.., "12":.., "17":.., "18":.., ...}
    pmc_faixas JSONB,                  -- PMC por alíquota de ICMS, mesmo formato
    restricao_hospitalar BOOLEAN,
    tarja VARCHAR(60),
    comercializacao_2025 BOOLEAN,
    atualizado_em DATE
);

CREATE INDEX idx_cmed_busca ON cmed_medicamentos USING gin(to_tsvector('portuguese', produto || ' ' || COALESCE(substancia, '')));
CREATE INDEX idx_cmed_registro ON cmed_medicamentos (registro);
