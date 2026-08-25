# Tarefa: adicionar página inicial (landing page) ao portal

## Objetivo
Adicionar uma página de apresentação/institucional em `/`, explicando o valor do
portal para o usuário, e mover a ferramenta atual (a que já está em `public/index.html`)
para ficar acessível a partir de um link "Entrar no portal" nessa nova página.

## Escopo — faça SÓ isto:

1. Copie o arquivo `home.html` (anexado) para `public/home.html`. Não altere o
   conteúdo dele — o texto e o design já foram revisados e aprovados.

2. No `server.js`, adicione uma rota explícita para servir essa página na raiz,
   ANTES do `app.use(express.static('public'))` (ou ajustando a ordem/config do
   static para não fazer `public/index.html` responder por `/` automaticamente):

   ```js
   app.get('/', (req, res) => {
     res.sendFile(path.join(__dirname, 'public', 'home.html'));
   });
   ```

   Lembre de `const path = require('path');` no topo do arquivo, se ainda não existir.

3. A ferramenta que já existe em `public/index.html` deve continuar acessível
   normalmente em `/index.html` (o link "Entrar no portal" dentro do `home.html`
   já aponta para esse caminho — não precisa renomear nem mover esse arquivo).

## NÃO faça:

- Não altere `public/index.html`, `public/app.js` ou `public/style.css`.
- Não altere nenhuma rota de API existente (`/api/...`).
- Não altere nenhum outro arquivo do projeto além do `server.js` (só a rota da
  home) e a criação do novo `public/home.html`.
- Não rode `git push` automaticamente — deixe o commit pra ser revisado antes.

## Como confirmar que funcionou

- Acessando `/` (raiz do site), deve aparecer a página institucional nova.
- Acessando `/index.html`, deve continuar aparecendo a ferramenta de consulta,
  funcionando exatamente como antes.
- Nenhuma rota de API deve ter sido alterada.

## Contexto (não é necessário fazer nada com isso, só pra entender o objetivo)

O portal cresceu bastante (consulta CBHPM, SUS/SIGTAP, validador de XML TISS,
CID-10, conversor de tabelas, etc.) e ainda não tinha uma página de entrada que
explicasse pra que ele serve. Essa página nova cumpre esse papel.
