-- Tabelas de domínio e relacionamento SIGTAP (grupo/sub-grupo/forma de
-- organização, instrumento de registro, modalidade de atendimento,
-- financiamento, sub tipo de financiamento e atributos complementares).
-- Fonte: Tabela Unificada de Procedimentos do SIGTAP/DATASUS.

CREATE TABLE sigtap_grupo (
    codigo VARCHAR(2) PRIMARY KEY,
    nome TEXT NOT NULL
);

CREATE TABLE sigtap_sub_grupo (
    codigo VARCHAR(4) PRIMARY KEY,  -- grupo(2)+subgrupo(2), ex: '0301'
    nome TEXT NOT NULL
);

CREATE TABLE sigtap_forma_organizacao (
    codigo VARCHAR(6) PRIMARY KEY,  -- grupo(2)+subgrupo(2)+forma(2), ex: '030101'
    nome TEXT NOT NULL
);

CREATE TABLE sigtap_modalidade (
    codigo VARCHAR(2) PRIMARY KEY,
    nome TEXT NOT NULL
);

CREATE TABLE sigtap_registro (
    codigo VARCHAR(2) PRIMARY KEY,
    nome TEXT NOT NULL
);

CREATE TABLE sigtap_financiamento (
    codigo VARCHAR(2) PRIMARY KEY,  -- casa com sigtap_procedimentos.financiamento
    nome TEXT NOT NULL
);

CREATE TABLE sigtap_rubrica (
    codigo VARCHAR(6) PRIMARY KEY,  -- casa com sigtap_procedimentos.rubrica ("Sub Tipo de Financiamento")
    nome TEXT NOT NULL
);

CREATE TABLE sigtap_detalhe (
    codigo VARCHAR(3) PRIMARY KEY,  -- "Atributos Complementares"
    nome TEXT NOT NULL
);

-- Relações N:N (um procedimento pode ter mais de um instrumento de
-- registro, modalidade de atendimento ou atributo complementar)
CREATE TABLE sigtap_procedimento_registro (
    codigo_procedimento VARCHAR(12) NOT NULL REFERENCES sigtap_procedimentos(codigo),
    codigo_registro VARCHAR(2) NOT NULL REFERENCES sigtap_registro(codigo),
    PRIMARY KEY (codigo_procedimento, codigo_registro)
);

CREATE TABLE sigtap_procedimento_modalidade (
    codigo_procedimento VARCHAR(12) NOT NULL REFERENCES sigtap_procedimentos(codigo),
    codigo_modalidade VARCHAR(2) NOT NULL REFERENCES sigtap_modalidade(codigo),
    PRIMARY KEY (codigo_procedimento, codigo_modalidade)
);

CREATE TABLE sigtap_procedimento_detalhe (
    codigo_procedimento VARCHAR(12) NOT NULL REFERENCES sigtap_procedimentos(codigo),
    codigo_detalhe VARCHAR(3) NOT NULL REFERENCES sigtap_detalhe(codigo),
    PRIMARY KEY (codigo_procedimento, codigo_detalhe)
);
