# Como aplicar

Este pacote contém somente arquivos revisados ou adicionados. Extraia/copiei o conteúdo sobre a raiz do repositório.

Substitua:

- `server.js`
- `.env.example`
- `README.md`
- `public/index.html`
- `public/painel.html`
- `public/upload.html`
- `public/admin.html`

Adicione:

- `public/app.css`
- `public/common.js`

O `package.json` e o `package-lock.json` não precisam mudar, porque esta revisão usa somente dependências que já existem no projeto.

Antes do primeiro deploy, configure `ADMIN_PASSWORD` com 12 a 128 caracteres. Se ficar vazia, o servidor gera uma senha aleatória e mostra no log do primeiro boot.

Use `TRUST_PROXY=1` apenas quando o app estiver atrás de um proxy confiável, como no Railway. Em execução direta/local, deixe `false`.

Validação básica:

```bash
node --check server.js
npm start
```
