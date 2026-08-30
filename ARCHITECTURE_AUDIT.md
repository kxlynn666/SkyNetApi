# SkyNetApi — Auditoria de arquitetura e produto

Data da revisão: 2026-08-30

## Objetivo

Esta revisão trata o SkyNetApi como produto e plataforma, não como uma coleção de páginas. Os critérios usados foram: previsibilidade, desempenho, acessibilidade, consistência de API, facilidade de manutenção, segurança, mobile-first e personalização progressiva.

## Referências de produto

As decisões não copiam interfaces específicas. Foram usados princípios recorrentes em produtos maduros:

- personalização em camadas com preview antes de salvar;
- identidade pública opcional e controle explícito do que é exibido;
- defaults discretos, legíveis e profissionais;
- complexidade avançada disponível sob demanda, sem poluir o primeiro uso;
- navegação e contratos de API como fontes canônicas, não como efeitos colaterais de scripts.

## Principais achados

### 1. Runtime do frontend duplicado

O workspace cria `window.SkyNet` no boot mínimo e aplica timeout/retry de sessão. Depois, `common.js` recriava o mesmo objeto. Isso podia apagar o runtime estabilizado no meio da navegação.

**Ação:** `common.js` agora preserva a instância existente. O CI impede regressão.

### 2. Navegação fragmentada

O menu base, `workspace-menu-v2`, `youtube-menu-v1` e feature loaders adicionam itens em fases diferentes. Isso explica itens sumindo, grupos duplicados e estados ativos inconsistentes.

**Ação:** o canonicalizador reutiliza grupos existentes, remove duplicatas e inclui Profile Studio e Status. Um manifesto público (`GET /api/meta/routes`) passa a descrever as páginas canônicas.

### 3. Perfil extremamente configurável, porém fragmentado

Identidade, comunidade, tema, design, mídia e cosméticos estavam distribuídos em APIs e arquivos diferentes. Havia muitas opções, mas nenhuma camada única que descrevesse o visual final do perfil público.

**Ação:** criado o Profile Studio. Ele não remove as APIs existentes; atua como camada de composição segura e compatível.

### 4. Perfil público pesado e pouco fiel ao editor

A página `/u/:username` carregava `common.js`, que por sua vez injetava muitos módulos não relacionados. Além disso, o perfil público usava um layout praticamente fixo e ignorava várias preferências já existentes.

**Ação:** o perfil público usa apenas o núcleo mínimo e passa a consumir o contrato do Profile Studio.

### 5. Defaults visuais excessivamente opinativos

O padrão anterior favorecia violeta/glow e uma identidade visual forte mesmo para contas recém-criadas.

**Ação:** o novo padrão de fábrica é sóbrio: fundo escuro neutro, azul suave como acento, teal secundário, tipografia do sistema, movimento respeitando preferência do SO e componentes de baixa distração. Usuários antigos herdam configurações legadas quando ainda não possuem registro do Studio.

### 6. Ausência de um contrato público de capacidades

O frontend conhecia recursos por strings e scripts espalhados. Não havia um GET simples para descobrir versão, capacidades, páginas e endpoints principais.

**Ação:** adicionados `GET /api/meta` e `GET /api/meta/routes`, além da página `/painel/status`.

### 7. Dívida de armazenamento

Grande parte do estado usa arquivos JSON com I/O síncrono e escrita atômica. Para o tamanho atual isso é simples e previsível, porém cria um teto de concorrência e dificulta consultas/índices/transações.

**Recomendação futura:** migrar dados com alta cardinalidade (mensagens, sessões, histórico, atividade e social) para SQLite/PostgreSQL mantendo arquivos somente para configuração estática/cache.

### 8. Dupla camada de middleware no backend

`server.js` instala segurança global e depois monta `createApp()`, que também possui parte de seu próprio pipeline. A configuração funciona, mas aumenta o risco de limites/CORS/headers divergirem por rota.

**Recomendação futura:** convergir para uma única fábrica Express e registrar módulos por domínio nela. Essa mudança é maior e não deve ser feita junto de alterações de produto sem suíte de integração HTTP mais completa.

## Profile Studio

O Studio expõe um schema versionável em `GET /api/profile-studio/me`. O editor é gerado a partir desse schema, reduzindo divergência entre backend e UI.

Categorias atuais:

- layout e dimensões;
- superfície, blur, borda, sombra e glow;
- todas as principais cores;
- fundo/gradiente e tratamento do banner;
- tipografia;
- avatar, botões, badges, métricas e links;
- movimento;
- visibilidade individual de blocos;
- ordem das seções;
- pronomes, localização, website e links públicos;
- controles sociais/privacidade já existentes, reunidos no editor.

Não existe CSS arbitrário, HTML arbitrário ou URL fora de HTTP/HTTPS. A liberdade é alta, mas os valores são sanitizados e limitados para proteger layout, segurança e acessibilidade.

## Novos contratos

- `GET /api/meta`
- `GET /api/meta/routes`
- `GET /api/profile-studio/me`
- `PATCH /api/profile-studio/me`
- `POST /api/profile-studio/me/reset`
- `GET /api/profile-studio/:username`
- `/painel/perfil/studio`
- `/painel/status`

O `GET /api/profile-v3/profile/:username` também passa a incluir `studio`, `pronouns`, `location`, `website` e `links` sem remover campos antigos.

## Guardrails adicionados

O CI verifica:

- que `common.js` não substitua novamente a runtime do boot;
- que o perfil público não volte a carregar o bundle global;
- que links do Studio sejam HTTP/HTTPS e sem credenciais;
- que números, enums, cores e ordem de seções sejam limitados;
- que as páginas/rotas novas estejam publicadas;
- que o Studio seja registrado antes do GET de perfil público;
- que páginas isoladas continuem em runtime leve;
- que o downloader legado do YouTube não volte;
- que o manifesto, menu e servidor permaneçam coerentes.

## Próximas prioridades técnicas

1. testes HTTP de integração com aplicação real e storage temporário;
2. consolidar o roteador/menu em um manifesto único consumido pelo frontend;
3. reduzir a quantidade de scripts versionados/hotfixes, substituindo-os por módulos canônicos;
4. migrar mensagens e estados de alta frequência para banco de dados;
5. remover middleware duplicado depois de cobertura de integração adequada;
6. adicionar telemetria first-party de erros agregados, sem conteúdo privado de usuários.
