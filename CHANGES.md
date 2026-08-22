# SkyNetApi - atualização de segurança e interface

Este pacote contém somente os arquivos alterados/adicionados. Copie-os por cima do repositório atual.

## Backend
- remove a criação insegura de `admin/admin`;
- carrega `.env` local sem dependência extra;
- sessões persistentes em `data/sessions.json`, armazenando somente hash do token;
- rate limit para login, cadastro e geração de cards;
- CORS restrito por `CORS_ORIGINS`;
- headers básicos de segurança e remoção de `X-Powered-By`;
- API keys somente via header `x-api-key` e valor completo exibido uma única vez;
- limite de chaves por conta;
- validação de uploads por tipo real da imagem, tamanho e dimensões;
- metadados de uploads separados por conta e endpoint de exclusão;
- histórico de cards por conta e endpoint de exclusão;
- validação de URLs remotas e bloqueio de redes privadas para reduzir SSRF;
- limites para textos, cores, fontes e parâmetros do gerador;
- rotas admin de API keys implementadas;
- proteção contra excluir/desativar a própria conta admin ou remover o último admin;
- remoção em cascata de chaves, sessões, uploads e cards ao excluir uma conta;
- endpoint `/health` implementado;
- respostas da API padronizadas com `{ ok, ... }`.

## Interface
- mantém a paleta, tipografia, gradientes, cards e estilo roxo/escuro do projeto;
- padroniza a sessão por cookie protegido entre todas as páginas;
- painel com estatísticas, API keys, catálogo de rotas, editor e histórico;
- upload com drag-and-drop, busca, métricas e exclusão;
- admin com busca, filtros, estatísticas, controle de contas e chaves;
- login admin simplificado para usuário e senha, removendo o campo de código que não era validado pelo servidor;
- interface sem emojis.

## Atenção ao primeiro boot
Se `data/accounts.json` ainda não existir, defina `ADMIN_PASSWORD` com pelo menos 12 caracteres. Se a variável não for definida, o servidor gera uma senha aleatória e imprime apenas no primeiro boot.

Se você já possui `data/accounts.json`, as contas existentes continuam sendo usadas.
