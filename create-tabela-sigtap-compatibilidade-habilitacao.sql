-- Compatibilidade entre procedimentos e exigência de habilitação do
-- prestador — dados oficiais da Tabela Unificada SIGTAP/DATASUS. Usados
-- pelos verificadores de compatibilidade e de habilitação exigida.

-- Pares de procedimentos com compatibilidade registrada (podem ser
-- faturados juntos). Ausência de um par aqui não significa necessariamente
-- incompatibilidade — só que não há registro explícito de compatibilidade.
CREATE TABLE sigtap_procedimento_compativel (
    codigo_principal VARCHAR(12) NOT NULL,
    codigo_registro_principal VARCHAR(2),
    codigo_compativel VARCHAR(12) NOT NULL,
    codigo_registro_compativel VARCHAR(2),
    tipo_compatibilidade VARCHAR(1),
    quantidade_permitida INTEGER,
    PRIMARY KEY (codigo_principal, codigo_compativel, codigo_registro_principal, codigo_registro_compativel)
);
CREATE INDEX idx_sigtap_compativel_reverso ON sigtap_procedimento_compativel (codigo_compativel);

-- Exceções: quando um terceiro procedimento (codigo_restricao) já está na
-- conta, a compatibilidade entre principal/compatível deixa de valer.
CREATE TABLE sigtap_excecao_compatibilidade (
    codigo_restricao VARCHAR(12) NOT NULL,
    codigo_principal VARCHAR(12) NOT NULL,
    codigo_registro_principal VARCHAR(2),
    codigo_compativel VARCHAR(12) NOT NULL,
    codigo_registro_compativel VARCHAR(2),
    tipo_compatibilidade VARCHAR(1)
);
CREATE INDEX idx_sigtap_excecao_par ON sigtap_excecao_compatibilidade (codigo_principal, codigo_compativel);

CREATE TABLE sigtap_habilitacao (
    codigo VARCHAR(4) PRIMARY KEY,
    nome TEXT NOT NULL
);

CREATE TABLE sigtap_grupo_habilitacao (
    codigo VARCHAR(4) PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT
);

-- Um procedimento pode exigir várias habilitações; quando exige um GRUPO,
-- as habilitações desse grupo normalmente precisam valer em conjunto (ver
-- sigtap_grupo_habilitacao.descricao para o texto oficial da regra).
CREATE TABLE sigtap_procedimento_habilitacao (
    codigo_procedimento VARCHAR(12) NOT NULL REFERENCES sigtap_procedimentos(codigo),
    codigo_habilitacao VARCHAR(4) NOT NULL REFERENCES sigtap_habilitacao(codigo),
    codigo_grupo_habilitacao VARCHAR(4),
    PRIMARY KEY (codigo_procedimento, codigo_habilitacao)
);
