# SkyNetApi

API de geração de cards com contas, API keys, uploads, painel de usuário e painel administrativo.

## Principais mudanças desta revisão

- remove a senha administrativa fixa `admin/admin`;
- cria a senha inicial do admin a partir de `ADMIN_PASSWORD` ou gera uma senha aleatória no primeiro boot;
- migra a autenticação do navegador para cookie de sessão `HttpOnly` e `SameSite=Strict`;
- persiste somente o hash dos tokens de sessão em `data/sessions.json`;
- adiciona rate limit para login, cadastro, tráfego geral e geração de cards;
- deixa o CORS fechado por padrão e configurável por `CORS_ORIGINS`;
- adiciona cabeçalhos de segurança e política de conteúdo;
- cria contas novas como pendentes por padrão, para ativação no painel admin;
- separa a listagem e o acesso de uploads por conta;
- valida e normaliza imagens antes de salvar;
- endurece o carregamento de imagens remotas contra SSRF e redirecionamentos para redes privadas;
- adiciona limites de chaves, uploads e histórico por conta;
- implementa as rotas administrativas de API keys que a interface já esperava;
- adiciona histórico de cards e exclusão de uploads/cards;
- corrige o formato das respostas de `/api/auth/me`, `/api/uploads` e rotas administrativas;
- mantém a identidade visual escura/violeta do projeto, sem emojis na interface.

## Instalação

```bash
npm install
cp .env.example .env
npm start
```

Em produção, defina `ADMIN_PASSWORD` com 12 a 128 caracteres antes do primeiro deploy. Se ela não for definida, a senha aleatória aparece apenas no log do primeiro boot. Ative `TRUST_PROXY=1` somente quando a aplicação estiver atrás de um proxy confiável, como no deploy via Railway.

## Páginas

- `/` - início e status do serviço
- `/painel` - conta, API keys, editor e histórico
- `/upload` - biblioteca de imagens
- `/admin` - administração

## Autenticação

O navegador usa um cookie de sessão `HttpOnly` e `SameSite=Strict`. A interface não grava tokens de sessão no `localStorage`.

Para a API de geração, envie a chave em:

```text
x-api-key: skynet_...
```

Também é aceito `Authorization: Bearer skynet_...`.

## Geração de card

`POST /generate-card` recebe `multipart/form-data` e aceita, entre outros campos:

- `fundo_url` ou `fundo_file`
- `avatar_url` ou `avatar_file`
- `texto_topo`
- `texto_extra`
- `texto_baixo`
- `fontSizeTop`, `fontSizeExtra`, `fontSizeBottom`
- `textColorTop`, `textColorExtra`, `textColorBottom`
- `glowColor`
- `darkness`

O painel usa `POST /painel/gerar`, autenticado pela sessão.

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

## Observação sobre uploads antigos

A versão anterior não armazenava o dono de cada upload. Por segurança, arquivos antigos que existirem em `public/uploads/` sem registro em `data/uploads.json` não aparecem para usuários e não são servidos pela rota autenticada. Eles podem ser removidos manualmente depois de confirmar que não são mais necessários.
