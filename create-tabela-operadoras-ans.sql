-- Cadastro de Operadoras Ativas da ANS (Agência Nacional de Saúde
-- Suplementar) — fonte oficial e aberta: dadosabertos.ans.gov.br/FTP/PDA/
-- operadoras_de_plano_de_saude_ativas/Relatorio_cadop.csv. Dado
-- institucional público (CNPJ, endereço e contato da empresa registrada),
-- sem nenhum dado pessoal/sensível — não é dado de beneficiário.
CREATE TABLE operadoras_ans (
    registro_ans VARCHAR(10) PRIMARY KEY,
    cnpj VARCHAR(14),
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    modalidade VARCHAR(60),
    logradouro TEXT,
    numero VARCHAR(20),
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    uf VARCHAR(2),
    cep VARCHAR(8),
    ddd VARCHAR(3),
    telefone VARCHAR(20),
    fax VARCHAR(20),
    email TEXT,
    regiao_comercializacao VARCHAR(5),
    data_registro_ans DATE,
    atualizado_em DATE
);

CREATE INDEX idx_operadoras_busca ON operadoras_ans USING gin(to_tsvector('portuguese', razao_social || ' ' || COALESCE(nome_fantasia, '')));
CREATE INDEX idx_operadoras_cnpj ON operadoras_ans (cnpj);
