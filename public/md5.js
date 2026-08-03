// Implementação de MD5 em JavaScript puro — necessária porque o navegador
// não expõe MD5 nativamente (SubtleCrypto só tem SHA-1/256/384/512), e o
// hash do Padrão TISS é definido pela ANS como MD5 (Componente Organizacional,
// item 115). Algoritmo público (RFC 1321); testado contra os vetores oficiais
// md5('') e md5('abc') antes de uso.
function md5Hex(bytes) {
  function rotl(x, c) {
    return (x << c) | (x >>> (32 - c));
  }
  function toHexLE(num) {
    let hex = '';
    for (let i = 0; i < 4; i++) {
      hex += ((num >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }
    return hex;
  }

  const K = new Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  }
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  const msgLenBits = bytes.length * 8;
  let padded = Array.from(bytes);
  padded.push(0x80);
  while (padded.length % 64 !== 56) padded.push(0);
  for (let i = 0; i < 8; i++) {
    padded.push(Number((BigInt(msgLenBits) >> BigInt(i * 8)) & 0xffn));
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    const M = new Array(16);
    for (let i = 0; i < 16; i++) {
      const o = chunkStart + i * 4;
      M[i] = (padded[o] | (padded[o + 1] << 8) | (padded[o + 2] << 16) | (padded[o + 3] << 24)) >>> 0;
    }

    let A = a0, B = b0, C = c0, D = d0;

    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[i])) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  return toHexLE(a0) + toHexLE(b0) + toHexLE(c0) + toHexLE(d0);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { md5Hex };
}
