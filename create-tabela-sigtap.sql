CREATE TABLE sigtap_procedimentos (
    codigo VARCHAR(12) PRIMARY KEY,
    nome TEXT NOT NULL,
    complexidade VARCHAR(2),        -- 1=Atenção Básica, 2=Média, 3=Alta Complexidade
    sexo VARCHAR(2),                -- M, F, I (indiferente), N (não se aplica)
    qt_maxima_execucao INTEGER,
    qt_dias_permanencia INTEGER,    -- permanência máxima em dias
    qt_pontos INTEGER,
    idade_minima_meses INTEGER,
    idade_maxima_meses INTEGER,
    idade_minima_legivel VARCHAR(20),
    idade_maxima_legivel VARCHAR(20),
    vl_sh NUMERIC(12,2),            -- Serviço Hospitalar
    vl_sa NUMERIC(12,2),            -- Serviço Ambulatorial (SADT)
    vl_sp NUMERIC(12,2),            -- Serviço Profissional (repasse médico)
    financiamento VARCHAR(5),
    rubrica VARCHAR(10),
    tempo_permanencia INTEGER
);

CREATE INDEX idx_sigtap_nome ON sigtap_procedimentos USING gin(to_tsvector('portuguese', nome));
