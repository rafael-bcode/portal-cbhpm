# Tarefa: aplicar marca "Argus Fatura" e configuração de SEO

## Escopo — faça SÓ isto:

1. Substitua `public/home.html` pelo arquivo `home-argus.html` (anexado) —
   renomeando-o para `public/home.html` (é a mesma página de antes, só com a
   marca "Argus Fatura" e tags de SEO adicionadas no `<head>`).

2. Copie `robots.txt` (anexado) para `public/robots.txt`.

3. Copie `sitemap.xml` (anexado) para `public/sitemap.xml`. **Atenção:** esse
   arquivo tem um placeholder `SEU-DOMINIO-AQUI` que precisa ser trocado pelo
   domínio real assim que a outra equipe definir — pode deixar como está por
   enquanto, só avise que esse ajuste fica pendente.

4. Confirme que `server.js` já serve arquivos estáticos da pasta `public`
   (via `express.static`) — isso já deve fazer o `robots.txt` e o
   `sitemap.xml` ficarem acessíveis automaticamente em `/robots.txt` e
   `/sitemap.xml`. Não precisa criar rota nova pra isso.

## NÃO faça:
- Não altere `public/index.html`, `public/app.js`, `public/style.css` ou
  qualquer rota `/api/...`.
- Não altere nada relacionado ao domínio além do placeholder mencionado.
- Não rode `git push` automaticamente — deixe pra revisão antes.

## Como confirmar que funcionou
- `/` mostra a home com a marca "Argus Fatura" no lugar de "CBHPM+"
- `/robots.txt` e `/sitemap.xml` respondem com o conteúdo dos arquivos
- `/index.html` (a ferramenta) continua funcionando normalmente, sem mudanças
