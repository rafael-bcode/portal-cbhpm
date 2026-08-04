// Gera public/cbo-medicos.json a partir da Tabela de Domínio 24 (CBO) do
// próprio Padrão TISS/ANS — usado pelo Validador de XML TISS para mostrar a
// ocupação/especialidade a partir do código CBO (<ans:CBOS>).
// Antes esse arquivo vinha do CBO completo do MTE filtrado só pela família
// 225 (médicos), o que deixava de fora dentistas, fisioterapeutas, técnicos
// de enfermagem etc. que também aparecem no campo CBOS das guias. A Tabela
// 24 do TISS já é a lista curada pela ANS de todos os CBOs válidos nesse
// campo, então passa a ser a fonte única (sem depender de rede).
const fs = require('fs');

const ORIGEM = 'public/tiss-tabelas-dominio.json';
const DESTINO = 'public/cbo-medicos.json';

function main() {
  const dados = JSON.parse(fs.readFileSync(ORIGEM, 'utf-8'));
  const tabela24 = dados.tabelas.find((t) => t.numero === 24);
  if (!tabela24) throw new Error('Tabela 24 (CBO) não encontrada em ' + ORIGEM);

  const mapa = {};
  tabela24.linhas.forEach(([codigo, titulo]) => {
    mapa[codigo] = titulo;
  });

  fs.writeFileSync(DESTINO, JSON.stringify(mapa));
  console.log(`OK: ${Object.keys(mapa).length} ocupações (Tabela 24 do TISS) gravadas em ${DESTINO}`);
}

main();
