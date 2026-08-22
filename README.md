# SkyNetApi

API de geração de cards com contas, API keys, uploads, painel de usuário e painel administrativo.

## Cards

Os cards são gerados automaticamente em **1080 × 1080**.

O gerador:

- mantém a proporção da imagem de fundo;
- preenche o quadro inteiro usando recorte proporcional (`cover`), sem esticar e sem barras pretas;
- usa avatar circular quando um avatar é informado;
- aplica uma borda neon no card e no avatar;
- escolhe aleatoriamente o neon entre vermelho, azul, verde e roxo;
- ajusta automaticamente tamanho e quebra dos textos;
- mantém apenas três textos: cima, principal e baixo.

## Instalação

```bash
npm install
cp .env.example .env
npm start
```

Em produção, defina `ADMIN_PASSWORD` com 12 a 128 caracteres antes do primeiro deploy. Se ela não for definida, a senha aleatória aparece apenas no log do primeiro boot. Ative `TRUST_PROXY=1` somente quando a aplicação estiver atrás de um proxy confiável, como no Railway.

## Páginas

- `/` - início e status do serviço
- `/painel` - conta, API keys, editor e histórico
- `/upload` - biblioteca de imagens
- `/admin` - administração

## Autenticação

O navegador usa cookie de sessão `HttpOnly` e `SameSite=Strict`.

Para chamadas da API, a forma recomendada é:

```text
x-api-key: skynet_...
```

Também é aceito:

```text
Authorization: Bearer skynet_...
```

Na rota GET de geração também é aceito `apikey` na query string para permitir geração direta por link. Como chaves em URL podem aparecer em histórico e logs, prefira headers quando possível.

## Gerar por link

A rota retorna a própria imagem PNG:

```text
GET /generate-card?avatar=LINK&fundo=LINK&textocima=TEXTO&textopr=TEXTO&textobaixo=TEXTO&apikey=skynet_...
```

Parâmetros:

- `fundo` - URL da imagem de fundo; obrigatório
- `avatar` - URL do avatar; opcional
- `textocima` - texto superior
- `textopr` - texto principal, no meio
- `textobaixo` - texto inferior
- `apikey` - API key

URLs e textos devem ser codificados normalmente como parâmetros de URL.

## Gerar por POST

`POST /generate-card` recebe `multipart/form-data` e continua aceitando autenticação pelo header `x-api-key`.

Campos principais:

- `fundo_url` ou `fundo_file`
- `avatar_url` ou `avatar_file`
- `texto_cima`
- `texto_principal`
- `texto_baixo`

O painel usa `POST /painel/gerar`, autenticado pela sessão.

## Segurança

- senhas são armazenadas com hash;
- API keys são armazenadas apenas como hash;
- sessões usam cookies `HttpOnly`;
- há rate limit para autenticação e geração;
- imagens remotas passam por validação e bloqueio de destinos de rede privada;
- uploads e cards são limitados por conta;
- CORS é fechado por padrão e configurável por `CORS_ORIGINS`.

## Dados persistentes

O servidor usa:

```text
data/accounts.json
data/apikeys.json
data/sessions.json
data/uploads.json
data/generations.json
public/uploads/
public/generated/
```

Em serviços com filesystem efêmero, monte volumes persistentes para `data/`, `public/uploads/` e `public/generated/`.

## Estrutura

A aplicação foi separada em módulos para facilitar manutenção:

```text
server.js
src/config.js
src/store.js
src/cards.js
src/app.js
public/
```
