# Notas do fork (Alcateia App)

Este repositório é um fork do openGym (AGPL-3.0-or-later). Este arquivo registra o que foi
removido do upstream, por quê, e onde nos afastamos do plano. Os documentos herdados do upstream
(README, CHANGELOG, CONTRIBUTING, CLAUDE.md, a maior parte de `docs/`) ainda falam do openGym;
o README foi reescrito na Task A4 e o resto só muda quando tocarmos no assunto.

## Regra principal: a mídia da Gym visual nunca volta

As imagens e animações dos exercícios são licenciadas da Gym visual só para o openGym. Elas não
podem entrar neste repositório, em CI, na imagem web nem no app.

Guarda: `node scripts/check-no-licensed-media.mjs` falha se `catalogue/media` existir, se algum
arquivo for rastreado em `catalogue/media/` ou em `exercise-media/` (fora de código e texto), ou
se `web/Dockerfile` voltar a copiar `catalogue/media`. Roda no CI no job `licensed-media`, que
não tem filtro de caminho (roda em todo PR), e deve rodar antes de cada release.

## Removido do upstream (Task A1 e A2)

| O que | Por quê |
|---|---|
| `catalogue/media/` (stills e clipes de 180 px) | Licença da Gym visual |
| `frontend/android`, `frontend/ios`, `frontend/garmin`, Wear OS, widgets, Apple Watch | O Alcateia é PWA, sem casca nativa por enquanto |
| `mcp/` | Servidor MCP opcional, fora do escopo |
| `website/`, `helm/`, `kubernetes/`, `contrib/nix/` | Site e formas de deploy do upstream; o deploy aqui é Railway |
| `COPY catalogue/media/ ...` no `web/Dockerfile` | A imagem web não carrega mais mídia licenciada |
| `scripts/catalogue/check-media.mjs`, `scripts/catalogue/stage-media.mjs` | Existiam para a mídia (limite de 180 px e cópia para o build). Trocados pelo guarda acima |
| `scripts/android/`, `scripts/ios/`, `scripts/media/` | Build/assinatura de APK, IPA e packs de animação, na máquina de release do upstream |
| `scripts/catalogue/drafts-from-pack.py`, `scripts/catalogue/import-drafts.mjs` | Liam o arquivo privado da Gym visual |
| `scripts/build-api-docs.mjs` | Gerava `website/api.html`, que não existe mais |
| `frontend/scripts/app-icons.mjs` | Gerava os ícones alternativos dentro de `android/` e `ios/`. Os SVGs em `frontend/resources/icons/` ficam |
| Script `build:mobile` em `frontend/package.json` | Dependia de `stage-media.mjs` e de `cap sync` nos projetos nativos |

## Alterado

- `web/Dockerfile`: sem a cópia de mídia; `LABEL maintainer="Alcateia"` e `title="alcateia-web"`.
  `org.opencontainers.image.source` e `url` continuam apontando para o openGym, porque o repositório
  público do fork ainda não existe. Trocar quando existir.
- `.github/workflows/test.yml`: removidos os jobs `mcp` e `android`, os filtros deles, o passo do
  Garmin, o passo de `build-api-docs --check` e o `npm ci` da raiz que só ele usava. O passo
  `check-media` virou o job `licensed-media` (diferença do plano: o plano trocava o passo dentro do
  job `catalogue`, que só roda quando o catálogo muda; um job próprio, sem filtro de caminho,
  cobre também um `COPY` voltando ao Dockerfile). `tests-ok` passou a depender dele.
- `.github/workflows/pages.yml`: sem o passo `stage-media` (a demo fica sem imagens de exercício).
- `.github/workflows/audit.yml`, `.github/dependabot.yml`: sem o diretório `mcp`.
- `.github/workflows/docker-publish.yml`: `paths-ignore` sem diretórios que não existem mais.
- `scripts/catalogue/build.mjs`: as páginas de `catalogue/browse/` não têm mais a coluna "picture"
  nem o aviso da Gym visual (eram links para `catalogue/media`). As páginas foram regeneradas.
- `scripts/README.md`: tabelas ajustadas ao que sobrou.

## Testes apagados ou alterados

Apagados por existirem só para algo removido (leem fonte Java/Swift/Kotlin, projetos nativos ou
scripts apagados):

- `frontend/src/lib/android-asset-packs.test.js`, `frontend/src/lib/pack-manifests.test.js`
  (scripts de packs de animação)
- `frontend/src/lib/android-backup.test.js`, `frontend/src/lib/android-system-bars.test.js`,
  `frontend/src/lib/rest-sounds.test.js` (comparavam o JS com `RestTone.java`, o manifesto etc.),
  `frontend/src/lib/voice-strings.test.js` (Siri, `ios/`)
- `frontend/scripts/app-icons.test.mjs`

Alterados (a parte de comportamento fica; só saíram as checagens contra código nativo ausente):

- `frontend/src/lib/channel.test.js`: saíram os testes dos flavors Play e F-Droid (liam `build.gradle`)
- `frontend/src/lib/health-connect.test.js`: saiu o bloco "the native tables" (liam Swift e Java)
- `frontend/src/lib/native-keyboard.test.js`: saiu a checagem de `MainActivity.java`; ficam as do CSS
- `frontend/src/lib/system-bars.test.js`: sai a leitura de `MainActivity.java`/`BarIconsPlugin.java`;
  fica a checagem de que o `App.jsx` envia o tema resolvido
- `frontend/src/lib/rest-alert.native.test.js`: saíram os blocos que liam Java/Swift
  (Vibrate off, alarm buzz, sessão de áudio do iPhone, fala no Android/iPhone)
- `frontend/src/lib/watch-sync.wear.test.js`: saíram os testes contra `events.json` e `snapshot.json`
  do Wear OS; ficam streak e o link do relógio por plataforma
- `frontend/src/lib/garmin-snapshot.test.js`: o snapshot do Wear OS que servia de base agora está
  embutido no teste; saiu só o teste contra a fixture do app Garmin
- `frontend/src/lib/workout-at.test.js`: a varredura não olha mais `mcp/src`
- `frontend/src/lib/catalogue-browse.test.js`: agora exige que a linha NÃO tenha link de imagem
- `api/test/k8s-web-port.test.js`: ficam só o teste da porta 80 do Dockerfile; saíram os de
  `kubernetes/` e `helm/`
- `api/test/openapi-routes.test.js`: o teste de tags continua, sem a parte do gerador de docs;
  saiu o teste do `?v=` do site

## App sem mídia nativa (Task A3)

Nenhum caminho `exercise-media/` é requisitado pelo app: nem `<img>`, `<video>`, `<source>`, nem
`fetch` de clipe ou pack. Um exercício do catálogo não mostra animação nem figura; as listas
mostram o bloco neutro com o halter. A mídia de exercício personalizado (foto, vídeo, link do
próprio usuário) não mudou.

Removido ou alterado no código:

| O que | Por quê |
|---|---|
| `lib/exercises.js`: `imgSrc` e `gifSrc` agora devolvem `null` (sem `IMG_BASE`, `GIF_BASE`, `CLIP_EXT`, `VITE_IMG_BASE`, `VITE_GIF_BASE`, `VITE_CLIP_EXT`) | Era aqui que a URL `exercise-media/...` era montada. As funções continuam exportadas: quem as usa decide se há o que mostrar |
| `components/Media.jsx`: `BuiltinMedia` devolve `null`; `Thumb` de catálogo é só o bloco neutro `thumb thumb-x` com ícone (o ramo `CustomThumb` fica) | Plano da Task A3 |
| `components/Media.jsx`: saíram `useClipInMemory`, `autoplayClip`, `autoplayMuted` e o botão minimizar/expandir | Só serviam ao clipe embutido (o `useClipInMemory` fazia `fetch` do clipe). A mídia personalizada tem os seus próprios hooks em `CustomMedia.jsx`. Voltam do histórico do git se a Fase 2 precisar |
| `lib/print-pictures.js`: exercício do catálogo não tem figura (a `printPictureSource` devolve `null`) | O plano impresso sai só com texto para eles; fotos de exercícios personalizados continuam |
| `lib/watch-sync.js`: `clipsFor` ignora exercício sem caminho de clipe | `gifSrc` é `null` |
| `public/sw.js`: `isMediaPath` não inclui mais `/exercise-media/` (ficam `/img/` e `/gif/` herdados) | O service worker não guarda mídia nativa |
| `frontend/vite.config.js`: saíram o plugin de dev `catalogueMedia` (servia `/exercise-media/` a partir de `catalogue/media`) e o proxy `MEDIA_TARGET` | Não há o que servir |

`lib/media-prefetch.js` (cache offline da mídia do plano) continua no código mas nunca tem URL para
buscar; `lib/anim-packs.js`, `lib/anim-quality.js` e a tela de qualidade de animação (só
aparecem no app nativo, que o fork não tem) ficam como estão até alguém limpar o código nativo.

Guarda de regressão: `frontend/src/lib/no-exercise-media.test.js` varre o código-fonte (sem os
testes, sem comentários), `public/`, `index.html` e `vite.config.js` e falha se alguma coisa citar
`exercise-media`.

Testes novos:

- `frontend/src/components/Media.nomedia.test.jsx` (do plano, com mais um caso)
- `frontend/src/lib/no-exercise-media.test.js`

Testes apagados (só testavam o caminho removido):

- `frontend/src/components/Media.autoplay.test.jsx` e `Media.clip-memory.test.jsx` (helpers de
  clipe que saíram do `Media.jsx`)
- `frontend/src/lib/exercises.clip-ext.test.js` (nome dos arquivos de clipe e `VITE_CLIP_EXT`)

Testes reescritos para o novo comportamento:

- `Media.test.jsx` (bloco `gifSize`: agora exige que nada seja renderizado), `Media.thumb.test.jsx`
  (catálogo sempre bloco neutro, sem `<img>`), `Animations.test.jsx` (bloco "what the animation
  shows": nada para exercício do catálogo, com qualquer pack)
- `exercise-figure.test.js` (sem figura para trocar), `anim-quality.test.js` (saiu a comparação
  com `gifSrc`), `anim-data-safety.test.js` (catálogo: sem figura, só packs instalados)
- `print-pictures.test.js`, `media-prefetch.test.js`, `watch-sync.test.js` (nada a buscar/enviar
  para o catálogo), `sw-media.test.js` (os testes de Range passam a usar `/gif/`)

## Sobras conhecidas (ficam para as próximas tasks)

- `frontend/package.json` ainda lista dependências Capacitor; `frontend/capacitor.config.json` e
  `check-mobile-bundle.mjs` (com o teste) seguem no repositório. Nada novo foi instalado.
- `package.json` da raiz ainda tem `js-yaml`, que só o gerador de docs usava.
- `scripts/ci/release-check.mjs` e `.github/workflows/release-check.yml` ainda leem versões de
  Android/iOS/Garmin; lidam com arquivo ausente (mostram "-"), então não quebram.
- `scripts/ci/fork-mr-pipelines.py` (espelho GitLab do upstream) não é usado aqui.
- `web/nginx.conf.template` ainda tem o bloco `location ^~ .../exercise-media/` (com cabeçalhos da
  licença) e `api-base.test.js` o confere. Não serve nada sem a pasta e o app não o usa; sai quando
  mexermos no nginx.
- `.gitignore` mantém `catalogue/media/` de propósito.

## Estado de verificação (fim da Task A2)

- `node scripts/check-no-licensed-media.mjs`: ok
- `node scripts/catalogue/validate.mjs`: catalogue OK, 6554 entradas (não exige mídia por exercício)
- `node scripts/catalogue/build.mjs --check`: em dia
- `cd frontend && npm test`: 644 arquivos, 7761 testes passando
- `cd api && npm test`: 797 testes passando

## Marca e remoções do upstream (Task A4)

Marca em `frontend/src/lib/brand.js` (`BRAND`): nome "Alcateia", curto "Alcateia App", repositório,
upstream e e-mail de suporte (o `support_email` do quiz, `suporte@alcateiademonstros.com.br`).

Texto visível: todo "openGym" em `t()`, JSX e nos 19 packs de `locales/` virou "Alcateia" (chave e
tradução juntas; em pt e pt-BR com o artigo no feminino). Comentários e cabeçalhos de arquivo, `LICENSE`
e `NOTICE.md` não foram tocados. Chaves técnicas ficam como estão (`gym_state_v1`, cookies, nomes de
arquivo `opengym-*.json`, o formato `opengym_plan`, o esquema `opengym://`). `RP_NAME` padrão da API é
`Alcateia`; os títulos de push e algumas mensagens da API também.

Configurações, Sobre e atualizações: nome e versão, "Código-fonte" (`BRAND.repoUrl`), "Baseado no
openGym" (`BRAND.upstreamUrl`) e o e-mail de suporte. AGPL §13: não retirar. Strings novas: `Based on {0}`
e `Support` (nos 19 packs).

| Removido ou alterado | Por quê |
|---|---|
| Seção "Apoie" (Buy me a coffee, Ko-fi, GitHub Sponsors, avaliar nas lojas) | Doação do upstream |
| `lib/update.js` e testes; linhas "Verificar atualizações" e "Baixar o app Android (opengym.ch)" | Consultava o GitHub do upstream e instalava o APK dele |
| Créditos da mídia Gym visual no rodapé do Sobre | Não há mídia (`MEDIA_CREDIT` em `print-pictures.js` ficou só como texto da licença, sem uso) |
| Link "Sugerir correção deste exercício" (issues do upstream) | Apontava para o GitHub do upstream |
| Links "Self-host" do demo (Login e Configurações) | Promoção do upstream |
| Rodapé `opengym.ch` na impressão e no cartão de compartilhar | Sem site; o cartão mostra só a marca |
| Links de rotina: agora `<este app>/#/r/<payload>` (antes `opengym.ch/r#...`); a leitura do domínio do upstream saiu | O site do upstream não é nosso |
| Adesivos NFC: o link usa o endereço do próprio app (antes `opengym.ch/nfc`) | Idem. Com o app fechado o toque só abre o endereço (nada lê a query); com o app aberto funciona |
| Ícones 180/512 gerados do logo do quiz; novo `icon-512-maskable.png` (logo a 70 % sobre fundo preto/laranja); manifest com `lang: pt-BR` e cores `#000000` | Marca |
| `index.html`: título, descrição, textos de falha de boot; `theme-color` e fundo do boot em `#000`; hash da CSP em `web/Dockerfile` recalculado | Marca (o `csp.test.js` confere) |
| `api/wrapped-copy.js` regenerado (`node scripts/build-wrapped-copy.mjs`) | Gerado a partir dos textos do frontend |
| `README.md` reescrito | Sem badges nem imagens do upstream |

Idioma: o padrão vem do servidor, `DEFAULT_LANG=pt-BR` (GET /api/config `default_lang`, lido em
`lib/default-lang.js`). Não há como definir isso só no frontend. Verificado no navegador com idioma
`en-US`: a UI abre em português para visitante novo.

### Pendências da A4

- `BRAND.repoUrl` é placeholder (`https://github.com/SEU-USUARIO/alcateia-app`); trocar na Task A6. O
  `Source code` do Sobre e `INTEGRATIONS_DOCS` dependem dele. Não pode ir a produção com o placeholder (AGPL §13).
- Paleta: fundo e `theme-color` em preto como o quiz. O acento do app continua o verde padrão (`lime`,
  `#30d158`). O quiz mistura laranja (`#F88E28` no `quiz.css`, e o logo) e magenta (`#FF0DFF`, o tema da
  página do quiz). Escolher o acento e então mudar `DEFAULT_ACCENT` (`lib/accent.js`), `accent` em
  `store/useStore.js` e a cor do boot em `index.html` (e o hash da CSP, se o script mudar), mais os testes de acento.
- Fonte do quiz (Plus Jakarta Sans) não foi trazida (precisa copiar os woff2).
- `frontend/public/app-icons/*` (112 px, ícones alternativos do app nativo) seguem os do upstream; só
  aparecem no app nativo, que o fork não tem.
- O título da página "About & updates" (Sobre e atualizações) ainda diz "atualizações"; renomear exige
  mexer em mais strings nos 19 packs.
- Ainda dizem "app do celular" textos de recursos nativos (parear app móvel, Apple Watch, Health Connect);
  só aparecem quando há um servidor ou o app nativo, que o fork não tem.
- Demo (`pages.yml`) e as imagens do `.github` do upstream seguem como vieram.

## A5: padrões de produção e imagens locais

- `.env.example`: valores do produto (`RP_NAME=Alcateia`, `DEFAULT_LANG=pt-BR`, `PASSWORD_LOGIN=1`, `INVITE_ONLY=1`,
  `ALLOW_GUEST=0`, `FIRST_USER_ADMIN=1`, `COACH_DISABLED=1`, `AUDIT_IP=off`) e comentários do upstream mantidos.
  Todos os nomes existem em `api/server.js` (`COACH_DISABLED` em `api/coach/config.js`).
- `docker-compose.yml`: `image: alcateia-api:local` e `alcateia-web:local`, ambos com `build:` (api em `./api`,
  web na raiz com `web/Dockerfile`). Nunca puxar `ghcr.io/duartesantos8/*` (contém a mídia). `name:` virou `alcateia`
  (evita colidir com a stack `opengym` de quem tem o upstream rodando).
- `.gitignore`: `coach-auth/` (volume do compose, credenciais do Codex).
- **Primeira subida e `INVITE_ONLY=1`**: o primeiro cadastro também exige convite (`/api/register/*` checa o
  convite antes de `claimFirstAdmin`), e sem admin ninguém gera convite. Fluxo: subir com `INVITE_ONLY=0`, criar o
  perfil (vira admin/owner), depois ligar `INVITE_ONLY=1` e recriar a api (`docker compose up -d --force-recreate api`).
  Alternativa: `ADMIN_UIDS`. Isso está documentado no próprio `.env.example`. Verificado: com `INVITE_ONLY=1`,
  cadastro sem código responde 403 `invite`.
- Verificado local (build sem mudar Dockerfile): `/api/health` ok, `/exercise-media/...` 404, `SEM_MIDIA` no web,
  nenhuma requisição `exercise-media` no navegador (biblioteca com 5632 exercícios e treino rodando, miniatura neutra).
- Observações para depois: (o subtítulo da biblioteca que dizia "com animações" foi corrigido na B3);
  a descrição dos exercícios vem em inglês (catálogo).

## B1: gerador de plano (`frontend/src/lib/plan-generator.js`)

- Código e testes do plano aplicados quase literais; todos os ids de `POOLS` existem em `EXIDX` e os do pool `home`
  passam em `eqAvailable(HOME_EQUIPMENT, ...)`. Não precisou trocar nenhum id por falha de teste.
- Dois ids trocados no pool `home` por qualidade (não por falha): `press` tinha `0334` (elevação lateral, que também
  está no slot `lateral`) e virou `0426` (desenvolvimento em pé com halter); `push` tinha `0659` (flexão na parede,
  fácil demais e escolhida em qualquer sessão de índice ímpar) e virou `2398` (flexão com joelhos apoiados).
- Duração: com o descanso padrão do app (`restSec` 90 s) e ~40 s por série, as séries do plano original davam até 63 min
  para `minutes: 45` e 35 min para `minutes: 15`. Acrescentado orçamento de séries por sessão
  (`floor(minutes * 1.2 * 60 / 130)` = 8 / 16 / 24 séries para 15 / 30 / 45 min): se passa, tira uma série por vez do
  fim da lista (do exercício com mais séries), nunca abaixo de 2. Efeito colateral: em 30 e 45 min, intermediário e
  avançado convergem em volume (a diferença de nível some, só 15 min já era igual). Para manter a diferença seria preciso
  gravar `restSec: 60` por exercício (campo já suportado em `Workout.jsx`/`ownExerciseRest`); fica como opção.
- Exportados também `estimateMinutes`, `SLACK` (1.2), `SET_SEC`, `REST_SEC`. Testes novos: duração estimada <= `minutes`
  x 1.2 e nenhuma rotina do mesmo plano com a mesma lista de exercícios (as 432 combinações).
- Formato conferido com `buildStarterPlan`/`loadStarterPlan`: rotinas `{id,name,emoji,ex:[{id,sets,reps,weight}]}` e
  `schedule [{day,routineId}]` (day 1 = segunda). Ícones `figureStrength` e `legs` existem em `components/Icon.jsx`.
  Rotinas geradas são dados do usuário (nome literal pt-BR, como as rotinas do `starter.js`, que ficam em inglês).
- `fitRoutines`/`substituteFor` do `starter.js` não são usados: os pools já são curados por local.

## B2: aplicar o plano gerado (`frontend/src/lib/alcateia-plan.js`)

- Implementação e testes do plano aplicados quase literais. Único ajuste no teste: `// @vitest-environment happy-dom`
  na primeira linha (importar `useStore` precisa de `window`). Formato real de `S.week`: `{ [dia]: [routineId] }`
  (lista de ids; `DEF.week = {}`), como o teste de `sheets.starter.test.jsx` já assume; o teste e o `beforeEach` do plano
  já estavam nesse formato.
- **`alcateia` NÃO foi posto em `DEF`** (o plano listava isso em "Modify"). Não é preciso: o estado é carregado com
  `Object.assign(clone(DEF), salvo)`, que mantém chaves desconhecidas, e o teste de entrada inválida exige
  `S().alcateia === undefined`; um `alcateia: null` em `DEF` quebraria isso. Quem lê `S.alcateia` deve tratar ausente.
- Refazer o quiz mantém as rotinas antigas geradas (decisão do plano). Elas não são marcadas de nenhuma forma (sem campo
  novo nas rotinas): se a UI quiser distingui-las depois, é decisão a tomar então.
- **Sync de `alcateia` (nenhuma mudança em `sync-merge.js`/`api/sync-stamps.js`)**: chave nova de nível raiz fora de
  `OWN_MERGE`/`PER_KEY` é tratada como configuração comum. `update()` → `stampEdits` grava `edited.alcateia` quando o
  valor muda; no 409 `mergeStates` → `applyEdits` pega o campo da cópia que o mudou por último (pelo carimbo, não pelo
  `_ts` geral) e, se só um lado tem carimbo, esse lado vence, inclusive contra uma cópia mais nova sem o campo (então
  `quizDone: true` não se perde). Sem carimbo nos dois lados, vale a cópia de `_ts` maior. O objeto é substituído
  inteiro (não mescla `answers` campo a campo, o que é desejável: as respostas são um conjunto).
  Testes: `describe('alcateia (mini-quiz) across devices')` em `sync-merge.test.js`.
- **API**: `PUT /api/data` não tem allowlist de chaves (só valida `workouts`/`routines` como listas e exige alguma chave
  além de `_rev`/`_ts`); `stampPut` carimba como configuração e `keepUnknown` devolve a chave a um app antigo que não a
  conhece. Teste novo: `api/test/alcateia-state.test.js`.

## B3: mini-quiz (`frontend/src/views/AlcateiaQuiz.jsx`)

- Chaves do `t()` em inglês, como no resto do app; os rótulos exatos do plano (`Tonificar o corpo`, `Em casa`...)
  vêm do pack pt-BR, que herda de pt. O teste fixa o idioma com `setLang('pt-BR')`. As 21 chaves novas estão em
  todos os 19 packs; no pt-BR são `PT_BR_OVERRIDES` (o fingerprint de herança só mudou por sair uma chave).
  Reaproveitadas: `Lose fat`, `At the gym`, `{0} days`, `{0} minutes`, `Back`, `Start`, `Cancel`, `How many days a week?`.
  `Advanced` não serve como nível (em de/it/ru etc. significa "avançado" de configurações): usa `Experienced`.
- Porta de entrada (App.jsx + `lib/quiz-gate.js`, testada): só conta logada (nunca visitante nem demo), depois do
  setup, e só depois do primeiro pull (`sync.status === 'ok' && lastSynced > 0`, travado por conta na sessão), para
  não perguntar de novo a quem fez em outro aparelho. "Pular por agora" fica em `sessionStorage` (por conta) e não
  grava `quizDone`. O convite do tour espera o quiz acabar.
- "Refazer meu plano" (Configurações, Plano e agenda, só com conta): flag `quizRedo` na `useUI` (não sincroniza,
  não mexe em `quizDone`), com "Cancelar". Ao concluir, vai para `#/home`. As rotinas antigas continuam; só os dias
  da semana são trocados (regra de `applyAlcateiaPlan`).
- Cabeçalho da biblioteca: "5632 exercícios" (sem "animações", em todos os idiomas); chaves antigas removidas dos packs.

## C1: mapa de vídeos curados (`frontend/src/lib/exercise-videos.js`)

- **Mapa vazio de propósito.** `EXERCISE_VIDEOS = {}` até a C3 (curadoria aprovada pela dona do produto); nenhum id foi
  inventado. Enquanto estiver vazio, `BuiltinMedia` continua devolvendo `null` (o botão "Ver como fazer" é a C2).
- **Nome do helper: `videoFor(ex)`** (o plano dizia `videoIdFor`; a tarefa pediu `videoFor`). Devolve o id ou `null`.
  Divergências do plano: valida o formato `^[A-Za-z0-9_-]{11}$` (id mal formado no mapa = sem vídeo, nunca um iframe
  quebrado), ignora propriedades herdadas (`constructor`, `__proto__`) e devolve `null` para exercício próprio
  (`custom === true`), que tem a mídia dele em `CustomMedia.jsx`. O módulo não importa nada, para o script de
  verificação poder lê-lo direto no Node. A C3 deve usar `videoFor` ao reaproveitar o teste de cobertura dos pools.
- **Teste de cobertura total (pools do gerador com vídeo) NÃO foi adicionado na C1.** O plano o adicionava e o deixava
  vermelho até a C3; aqui a suíte fica verde e o teste entra na C3, quando o mapa for preenchido.
- **`BuiltinMedia`** renderiza `YouTubeVideo` (cartão; iframe `youtube-nocookie.com` só após o toque) respeitando
  `gifSize` (`off` esconde, `mini` usa o cartão compacto). CSP já permite só `frame-src https://www.youtube-nocookie.com`
  (`web/Dockerfile`, `csp.test.js`). Teste em `Media.video.test.jsx` com `vi.mock` do módulo e id de TESTE só ali; o
  `Media.nomedia.test.jsx` e o `no-exercise-media.test.js` seguem como estavam (nenhum caminho `exercise-media/` volta).
- **`scripts/videos/verify.mjs`** (Node puro): consulta o oEmbed de cada id do mapa. Saída 0 (tudo certo, ou mapa vazio com
  "nenhum vídeo curado"), 1 (algum não-200), 2 (sem rede: nenhuma resposta); `--offline-ok` converte o 2 em 0 com aviso.
  Falha de vídeo vence falta de rede. `verifyAll(ids, fetchImpl)` e `summarize` são exportados; o teste fica em
  `frontend/scripts/verify-videos.test.mjs` (o vitest já pega `*.test.mjs` ali; o repo não tem convenção de teste na raiz
  `scripts/`). O script ainda não está ligado a nenhum workflow de CI: decisão para a C3 (rodar com `--offline-ok`).
- `docs/curadoria-videos.csv` criado só com o cabeçalho `id,nome,busca_sugerida,url_escolhida,status`.
- Nenhuma string nova em `t()` (o cartão reaproveita "Watch video" e o texto de privacidade já traduzidos); os packs
  de idioma não mudaram.

## C2: "Ver como fazer" e card "Alimentação em breve"

- **Onde o botão aparece.** Em `BuiltinMedia` (`components/Media.jsx`), no lugar onde a mídia do exercício aparecia, quando
  `videoFor(ex)` é nulo: detalhe do exercício (`sheets.jsx`), cartão do exercício no treino (`Workout.jsx`, respeita
  `gifSize` `off`/`mini`) e a sheet de configuração do exercício na rotina (`Media` com notas). Com vídeo curado aparece o
  cartão do vídeo, nunca o botão. Exercício próprio (`custom`) não ganha: tem a mídia dele em `CustomMedia`. É um `<a>` real
  (`class="exlink-card how-to-link"`), `target="_blank"` e `rel="noopener noreferrer"`; o href é só texto até o toque.
- **Divergência do plano:** o plano falava em trocar o texto do botão "Watch on YouTube". Esse botão já existia em três menus
  (detalhe, menu "mais" do treino, FocusView), como item de menu e não como mídia. Mantive os três, mas agora usam o mesmo
  endereço (`lib/how-to.js`), e no detalhe ele só continua visível sob um vídeo curado ou em exercício próprio (sem vídeo o
  "Ver como fazer" logo acima já faz a mesma busca; dois botões iguais seriam ruído). Chave nova `See how to do it`
  ("Ver como fazer"); o subtítulo reaproveita `Opens a search for good form`.
- **`youtubeSearchUrl(ex, localName)`**: com `localName` busca `<nome> exercício execução correta`; sem ele, o comportamento
  antigo (nome em inglês + `form`). O nome com o original em inglês entre parênteses (`supino (barbell bench press)`) perde
  o parêntese final quando ele é exatamente o `ex.n`; parênteses que fazem parte do nome ficam.
- **Idioma.** `lib/how-to.js` (`howToUrl`) passa o nome traduzido (`exerciseNameFor`) só quando o idioma é `pt`/`pt-BR`; nos
  demais idiomas a busca continua em inglês + `form` (as palavras "exercício execução correta" são portuguesas, então não
  servem para os outros). O botão em si vem de `t()` em todos os idiomas.
- **Card "Alimentação" na Home.** Título `Alimentação` (chave `Nutrition`), subtítulo `Plano alimentar e receitas`
  (`Meal plan and recipes`) e selo `Em breve` (`Coming soon`), sem travessão. `div.card.soon-card` com `aria-disabled`,
  sem botão nem link. Segue o módulo existente **Corpo** (`isOn(S, 'body')`): some em "Só treino" e quando Corpo está
  desligado em Configurações, Módulos. Não criei módulo nem mecanismo novo; se um dia houver um módulo de alimentação, é
  trocar a condição. Ícone `heart` (o app não tem ícone de comida e o plano mandava não acrescentar dependências). O selo
  usa `text-transform:none` para não virar "Em Breve" (`.tag` capitaliza).
- 4 chaves novas nos 19 packs; no pt-BR entram como `PT_BR_OVERRIDES` (o fingerprint de herança não muda).
