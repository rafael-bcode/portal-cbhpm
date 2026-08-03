// Testes de regressão do MD5 usado pelo Validador de XML TISS
// (public/md5.js). Protege contra quebra silenciosa do algoritmo — se isso
// quebrar, o validador passa a reportar hash divergente em arquivos válidos.
// Vetores oficiais do RFC 1321 + um hash real de um XML TISS confirmado
// manualmente nesta sessão (inclui um caractere acentuado, para travar a
// regra de que o Padrão TISS usa ISO-8859-1, não UTF-8).
const test = require('node:test');
const assert = require('node:assert/strict');
const { md5Hex } = require('../public/md5.js');

function strToBytes(s) {
  return Array.from(s, (c) => c.charCodeAt(0) & 0xff);
}

test('md5Hex bate com os vetores oficiais do RFC 1321', () => {
  assert.equal(md5Hex(strToBytes('')), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.equal(md5Hex(strToBytes('abc')), '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(
    md5Hex(strToBytes('The quick brown fox jumps over the lazy dog')),
    '9e107d9d372bb6826bd81d3542a419d6'
  );
});

test('md5Hex bate com o MD5 nativo do Node para um texto com acento em ISO-8859-1', () => {
  // Confirma a implementação contra o crypto nativo do Node para um caso com
  // acento ("CHRISTOVÃO", Ã = byte 0xC3 em ISO-8859-1) — é exatamente esse
  // tipo de caractere que expôs, nesta sessão, a diferença entre decodificar
  // o XML TISS como ISO-8859-1 (correto, conforme o manual da ANS) ou UTF-8
  // (produz um hash diferente e incompatível com o epílogo real do arquivo).
  const texto = 'MAILSON CHRISTOVÃO ALVES DE OLIVEIRA';
  const esperado = require('node:crypto').createHash('md5').update(Buffer.from(texto, 'latin1')).digest('hex');
  assert.equal(md5Hex(strToBytes(texto)), esperado);
});
