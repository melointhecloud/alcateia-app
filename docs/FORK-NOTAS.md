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

## D1: direitos de acesso (`api/entitlements.js`)

Módulo puro (sem I/O, sem dependência nova; só `normalizeEmail` do `password.js`). Testes em
`api/test/entitlements.test.js` (48). Onde nos afastamos do plano (a spec §7 manda):

- **`subscription_created` ativa**, como a spec §7.2 (o plano dizia que sozinho não ativava). Para não liberar quem não
  pagou, o pedido é recusado quando `data.status` é um estado conhecido de não pago (`waiting_payment`, `pending`,
  `refused`, `refunded`, `chargedback`, `canceled`...). O plano usava lista de permissão (`status !== 'paid'`); aqui é lista
  de negação, para que um valor de status diferente do esperado nunca tranque quem pagou. Mesmo critério para
  `offer_type` (só `orderbump`, `upsell`, `downsell` são ignorados; ausente ou `main` vale).
- **Nova assinatura de quem já teve outra** (compra aprovada com outro `subscription.id`) é adotada; o plano a descartava
  por causa da guarda "outra assinatura", e quem voltasse depois de cancelar nunca reativaria. A guarda continua para
  renovação/retomada/reembolso/pausa/cancelamento de assinatura antiga. `validUntil` nunca encurta.
- **`late` e `renewal_refused`: registro nenhum** (a spec diz "sem mudança"; o plano gravava `lastEvent`). `refund_requested`,
  `dispute_defense_requested` e demais eventos só registram `lastEvent`/`updatedAt`.
- **Plano**: `recurrence_period` fora de 30/90/180 vira mensal de 30 dias (spec); o plano usava o número como dias.
  `CAKTO_PLANS` só vale com `plan` em mensal/trimestral/semestral/manual e `days > 0`; entrada ruim cai na recorrência.
- **Sem `next_payment_date`**: parte de `paidAt`, ou de agora se não houver; em `subscription_resumed` e
  `subscription_late_recovered` parte de `max(paidAt, agora)` (o `paidAt` do pedido original ficaria no passado).
- **Nunca lança**: payload/lista/db/opções malformados, datas fora do limite da `Date` e até getter que lança voltam sem
  mudança com `reason` (`payload-invalid`, `event-missing`, `data-missing`, `data-invalid`, `email-invalid`, `not-paid`,
  `not-main-offer`, `other-subscription`, `no-entitlement`, `no-effect`, `invalid-date`, `no-id`, `duplicate`,
  `internal-error`). `grant` é a exceção: entrada do admin, lança `Error` ('e-mail inválido', 'validade inválida', 'plano
  inválido', 'status inválido'); a rota deve capturar.
- **API além do plano**: `processEvent` (devolve também `changed`, `results`, `reason`), `linkUser` (vincula `userId` ao
  direito livre), `isActive` (o plano chamava `hasAccess`, que fica como apelido), `grant` aceita `status`
  (`active`/`inactive`, padrão `active`) e mantém `userId`, `createdAt` e `subscriptionId` do registro existente.
  `ingest` devolve `changed: true` também quando só `caktoSeen` mudou (quem chama precisa salvar).
- Campo extra no direito: `canceled` (boolean; `subscription_canceled` marca, renovação limpa).
- `now` é injetável e os testes sempre o injetam; se faltar, cai em `Date.now()` (para o `server.js` não precisar passá-lo).

Pendências para a D7 (evento de teste real da Cakto): confirmar os nomes `data.paidAt`, `data.offer_type`, `data.status`,
`data.subscription.next_payment_date`/`recurrence_period`, o formato de `data.id` nos eventos de assinatura, e se a
Cakto entrega eventos fora de ordem (um `purchase_approved` atrasado depois de um `refund` do mesmo pedido reativaria o
acesso; só `data.status` do próprio pedido protege hoje).

## D2: verificação do webhook (`api/cakto-webhook.js`)

Função pura `verifyCakto({ rawBody, headers, secret, nowSec })` (só `node:crypto`, sem dependência nova). Testes em
`api/test/cakto-webhook.test.js` (24). Devolve `{ ok: true, via: 'hmac' | 'secret' }` ou `{ ok: false, why }`; `ok: false`
significa responder **401** (spec §7.2) e `why` (`no-secret`, `bad-body`, `bad-headers`, `bad-timestamp`, `stale`,
`bad-signature`, `bad-json`, `bad-secret`, `internal-error`) é só para log. `rawBody` é o corpo BRUTO (Buffer, Uint8Array ou
string); a rota D3 tem de capturá-lo antes do `JSON.parse`. `nowSec` (segundos, injetável) é o nome do plano.
Onde nos afastamos do plano:

- **Qualquer cabeçalho `X-Cakto-*` presente exige o HMAC inteiro.** O plano só olhava o HMAC com os dois cabeçalhos e,
  com um só (ou vazio), caía para o `secret` do corpo. Aqui, existindo um deles (mesmo vazio ou sozinho), a verificação é
  só por HMAC e falha com `bad-headers`; o `secret` do corpo só vale sem nenhum dos dois.
- **Chave ausente, vazia ou só espaços rejeita sempre** (`no-secret`), nos dois caminhos; a chave do HMAC não é aparada.
- **Timestamp estrito**: só dígitos (`bad-timestamp`); `""`, `"1e9"`, `"0x10"`, `"-5"`, `"12.5"` não valem. Passado ou
  futuro além de 300 s é `stale` (300 s exatos ainda vale).
- **Assinatura em hex validada antes de comparar** (64 dígitos, maiúsculas aceitas) e comparada como bytes com
  `timingSafeEqual`; tamanho errado ou não hex apenas não casa, sem lançar. Com várias assinaturas separadas por vírgula,
  vale se alguma `v1=` casar; outras versões (`v2=`) são ignoradas.
- **`secret` do corpo comparado por resumo SHA-256** de ambos os lados (tamanho fixo), então tamanhos diferentes não lançam
  nem vazam o comprimento. Só vale `secret` string.
- **Nunca lança**: corpo que não é Buffer/string, `headers` ausente ou de tipo estranho, JSON inválido: `ok: false`.
  Nomes de cabeçalho em qualquer caixa e valor em lista (usa o primeiro) são aceitos.

Pendência para a D7: confirmar o formato da assinatura com um evento real da conta (nomes e valores de `X-Cakto-Timestamp` e
`X-Cakto-Signature`, prefixo `v1=`, se vem em segundos, se o corpo assinado é exatamente o recebido, e se algum modo envia só
um dos cabeçalhos, caso em que a regra acima o recusaria). Sem essa confirmação, o `secret` no corpo continua sendo o caminho
que a documentação garante.

## D3: webhook, cadastro por e-mail, bloqueio 402 e `access` (`api/server.js`)

Tudo atrás de `ACCESS_MODE=subscription` (só esse valor exato liga; `1`/`true` não ligam). Desligado, o servidor é o do
upstream: a suíte antiga passou sem mudar nenhuma expectativa. Testes: `api/test/server-access.test.js` (36, servidor real
em processo filho). Suíte da API inteira: 908 verdes. Onde nos afastamos do plano:

- **`POST /api/hooks/cakto`** (CSRF-exempta, só ela): sem cookie, sem Origin, a credencial é a assinatura (HMAC ou `secret`
  do corpo). O plano respondia **404** sem `CAKTO_WEBHOOK_SECRET`; aqui é **401** sempre (nunca aceita). Com `ACCESS_MODE`
  desligado a rota é **404** (como se não existisse). O corpo é lido por `readRaw` (bytes exatos, limite de 1 MiB, 413 acima;
  `readBody` passou a usar o mesmo `readRaw`, comportamento idêntico). O plano punha `req.rawBody` dentro de `readBody`, o que
  faria JSON malformado ou `Content-Type` diferente virar 400/415 **antes** da conferência; aqui a rota não usa `readBody`:
  confere a assinatura primeiro e só então faz `JSON.parse` (malformado com assinatura válida = 200). Erro interno ao
  processar é registrado e ainda responde 200. Se o `saveDb` falhar, o estado já está em memória e o próximo save o leva
  (a Cakto não reenvia). Log: só `cakto <evento> <id>=<resultado>`; recusas viram no máximo 5 linhas/min no log e uma linha
  de auditoria limitada (`hook.cakto.denied`, motivo curto de `verifyCakto`). Nunca corpo, e-mail ou segredo.
- **CSRF**: a rota entrou em `CSRF_EXEMPT` por precisão, não por necessidade (sem `Origin` o `csrfOk` já passava). Se a Cakto
  um dia mandar `Origin`, não perdemos a venda. Um navegador hostil não ganha nada: sem a assinatura é 401, e a rota não usa
  sessão nem põe cookie.
- **Cadastro** (`POST /api/register/password`): com `ACCESS_MODE`, `email` é obrigatório (`400 code:'email'`). Erro único
  `403 {error:'não encontramos uma assinatura ativa para este e-mail', code:'no-subscription'}` para e-mail sem compra,
  vencido, reembolsado, já usado e convite errado; cada recusa conta no limitador (`strikeAddress(..., 'signup')`).
  `INVITE_ONLY` do ambiente deixa de decidir esta rota (pode continuar `1` da Fase 0); o convite vira só a via manual e só é
  queimado se for ele que dá a entrada (o direito vence quando os dois valem). **Corrida**: há um `await` (o hash) entre a
  checagem inicial e a gravação, então o direito é procurado **de novo depois do hash** e o `push` do perfil + `linkUser` ficam
  no mesmo tick, sem `await` no meio (teste com 3 cadastros simultâneos: um 200, dois 403). `e-mail já em uso` por outro
  perfil também responde o erro neutro (não o 409 `email-taken`) quando há compra.
- **Cadastro por passkey** (`/api/register/options` e `/verify`) exige convite com `ACCESS_MODE` ligado (plano não tratava):
  senão qualquer um criaria perfil sem e-mail e sem passar pelo funil; o perfil novo ficaria sem direito de qualquer forma.
- **Acesso** (`accessOf`/`publicUser`): `access: { active, plan, validUntil }` só com `ACCESS_MODE` (admin: ativo, plan e
  validUntil nulos). O direito do perfil é achado **só por `entitlement.userId`**. O plano tinha um fallback por `user.email`;
  foi cortado porque o e-mail de Configurações não é verificado e qualquer um poderia "pegar" uma compra digitando o e-mail do
  comprador. `renewUrl` não vai em `access` (vai em `/api/config` e no corpo do 402).
- **402 em `PUT /api/data`**: `{ error:'subscription inactive', code:'subscription-inactive', renewUrl }`; é a única rota que
  grava o estado (verificado: `atomicWrite(stateFile...)` só ali). `GET /api/data` segue. **Sem direito = inativo**: perfis
  criados antes de ligar o modo ficam em 402 até ganharem um direito; **não há migração automática**. A D7 tem de criar o direito
  manual de cada perfil existente (`PUT /api/admin/entitlements`) **antes** de ligar `ACCESS_MODE`.
- **Rotas de admin** (sem `/grant`, como pediu o enunciado): `GET /api/admin/entitlements` →
  `{ entitlements:[...com userName], access_mode, grace_days }`; `PUT /api/admin/entitlements` com
  `{ email, validUntil, plan?, status?, userId? }` → `{ entitlements }`. Erro do `grant` vira 400 com a mensagem; `userId`
  inexistente 400; perfil que já tem outro direito, ou direito de outro perfil, 409. Sem `userId`, vincula ao perfil cujo
  `user.email` é igual (ação do admin, por isso é segura) e é assim que a D7 liga perfis antigos. Funcionam com `ACCESS_MODE`
  desligado, de propósito, para a migração poder ser feita antes de ligar. Auditoria `admin.entitlement.set`, e-mail mascarado.
- **`GET /api/config`** ganha `access_mode: 'subscription'` e `renew_url` (só se for http/https; outro esquema é ignorado
  com aviso) apenas com o modo ligado.
- **Env**: `ACCESS_GRACE_DAYS` vazio ou inválido vale 3; `CAKTO_PLANS` inválido (não JSON ou não objeto) é ignorado com um
  aviso no boot. Documentadas em `.env.example`, `docs/SELF_HOSTING.md` e `CLAUDE.md`. O compose passa o `.env` inteiro
  (`env_file`), nada a mudar. `api/Dockerfile` ganhou `entitlements.js` e `cakto-webhook.js` na linha do `COPY` (o
  `dockerfile-copy.test.js` pega o esquecimento).
- **`db.json`**: `entitlements` e `caktoSeen` ganham `[]` na carga se faltarem ou tiverem tipo errado; entram no disco no
  primeiro `saveDb` (e no `.bak`, que é escrito do mesmo texto). Um db antigo só é reescrito ao primeiro evento ou cadastro.
- **OpenAPI** (a D4 já está feita aqui, porque `openapi-routes.test.js` compara): `/api/hooks/cakto`, `/api/admin/entitlements`
  (get/put), `access` em `SessionUser`, 402 em `PUT /api/data`, `access_mode`/`renew_url` em `/api/config`, o cadastro por
  senha, tag `access`, schema `Entitlement`. A D4 só precisa conferir/ajustar.

Pontos para revisão humana:
- **Pré-cadastro com o e-mail de outra pessoa**: o e-mail não é verificado (não há envio de e-mail na spec §10). Quem souber o
  e-mail de uma compradora pode se cadastrar antes dela e ficar com o acesso. O erro neutro e o limitador só atrapalham a
  enumeração, não impedem isso. Mitigações possíveis (fora desta task): código enviado ao e-mail, ou link único na página
  pós-compra.
- A recusa neutra volta antes do hash, e a aceitação depois dele: há diferença de tempo entre "tem compra" e "não tem", mas
  quem testa um e-mail com senha válida e acerta já consumiu o direito, então o canal de tempo não revela nada além disso.
- Admin lista e-mails dos direitos por inteiro (como já via `email` dos perfis); só admin.
- Um perfil sem acesso ainda pode usar outras rotas autenticadas que não gravam o estado (mídia, integrações, relógio, pareamento,
  Coach). Só `PUT /api/data` bloqueia, como a spec §7.3.
- Eventos de auditoria novos para o painel D5/Admin rotular: `hook.cakto.denied`, `admin.entitlement.set`, e `auth.register.denied`
  com `msg: 'no-subscription'`.
- Ordem na D7: webhook só responde com `ACCESS_MODE` ligado, então compras anteriores à virada não entram; ligue o modo
  antes de apontar a Cakto para a URL.

## D5: seção "Acessos" no painel admin (`frontend/src/views/Admin.jsx`)

Card "Access" entre o Coach e os convites. Lista cada direito (e-mail, plano, situação, validade, perfil vinculado) e tem um
formulário para criar ou ajustar. Testes: `Admin.access.test.jsx` (8) e 1 caso novo em `audit.test.js`. Onde nos afastamos do plano:

- **Admin segue só em inglês.** O cabeçalho de `Admin.jsx` e de `lib/audit.js` diz que o painel do operador fica de propósito
  fora dos packs de idioma. Por isso os textos novos do painel são literais em inglês, sem `t()`, e nenhuma chave nova entrou
  nos 19 packs nesta task. Se o dono quiser o painel em pt-BR, é uma decisão para o painel inteiro, não só para esta seção.
- **Sem `adminEntitlements()` / `adminGrantEntitlement()` em `lib/api.js`.** O resto do `Admin.jsx` chama `api('/api/admin/...')`
  direto (convites, usuários, auditoria) e os testes do painel simulam só `api`; seguimos o padrão do arquivo. A rota é a que
  a D3 expôs, `PUT /api/admin/entitlements` (não `POST .../grant`, que o plano previa).
- **Validade = fim do dia escolhido, no fuso do navegador.** O campo é uma data; enviamos `23:59:59` local em ISO. Mandar só
  `YYYY-MM-DD` viraria meia-noite UTC (21h do dia anterior no Brasil) e cortaria o último dia. Ao tocar numa linha o formulário
  é preenchido com ela ("Adjust a right"); gravar de novo para o mesmo e-mail ajusta o direito (a rota já faz isso).
- **Status no formulário** (`active` ou `switched off`): é o jeito de desligar um acesso à mão. A situação da lista é
  `active`, `expired` (validade passada) ou `off`; "canceled" aparece à parte (período pago mantido).
- Erros: falha de carga mostra a mensagem no card com "Try again"; erro do servidor ao gravar aparece no formulário (mensagens
  do `grant` vêm em português do servidor, como estão). Estado vazio explica que as compras aparecem sozinhas.
- O card avisa quando `ACCESS_MODE` está desligado (a rota funciona assim de propósito, para migrar perfis antigos antes de ligar).
- `lib/audit.js`: rótulos para `admin.entitlement.set` e `hook.cakto.denied`, e motivos para `no-subscription` e os códigos de
  recusa do webhook. Dois testes de `audit.test.js` já estavam vermelhos desde a D3 (a lista de eventos do servidor ganhou
  eventos sem rótulo); ficam verdes aqui.

## D6: cadastro com o e-mail da compra e tela de assinatura inativa

Testes novos: `Blocked.test.jsx` (8), `useStore.access.test.jsx` (9), 9 casos em `Login.password.test.jsx`, 2 em `api.test.js`.
Suíte do frontend inteira verde (8239), API 908. 11 chaves novas nos 19 packs (no pt-BR entram em `PT_BR_OVERRIDES`; o fingerprint de
herança do pt muda só porque o pt ganhou as 11). Onde nos afastamos do plano:

- **Cadastro** (`PasswordRegisterForm`, `Login.jsx`): com `config.access_mode === 'subscription'` o e-mail vira obrigatório
  ("E-mail da compra", texto de apoio, erro "Informe o e-mail usado na compra."). O `403 no-subscription` mostra a mensagem
  amigável do enunciado (`passwordError`) e, só nesse caso, a linha "Precisa de ajuda? Escreva para suporte@..." (`SupportLine.jsx`).
  O botão "Criar novo perfil" vira "Já comprei, criar minha conta" no modo. Fora do modo, nada muda (e-mail opcional).
- **Passkey no modo ligado**: com `password_login` ligado, só a senha é oferecida (sem o seletor Chave de acesso/Senha), porque
  a passkey precisa de convite no servidor e não recolhe o e-mail da compra; a pessoa pode cadastrar uma passkey depois, em
  Configurações. Se o servidor não tem senha, o caminho da passkey continua e **sempre pede o código de convite** (mesmo com
  `INVITE_ONLY=0`), já que o servidor o exige.
- **`/#/login?cadastro=1`**: lido direto de `window.location` (o Login não usa router, e os testes dele montam sem um). Abre o
  cadastro por senha sozinho quando a config chega; uma vez só por montagem.
- **Bloqueio** (`views/Blocked.jsx`, `App.jsx`): `store.blocked` liga com `access.active === false` na sessão (`setUser`, e o
  valor salvo em `gym_user` no começo) ou com um 402 `subscription-inactive` no `PUT /api/data` (`api.js` põe `code` e `renewUrl`
  no erro; `isSubscriptionInactive`). A tela substitui as rotas, e some a barra de abas, o banner de sincronização, o quiz, o
  tour e a camada sazonal. Botão "Renovar" só com `config.renew_url` http(s) (o plano dizia `access.renewUrl`, que o servidor
  não manda); sem ele, o e-mail de suporte. A tela acrescenta "Já renovei, verificar de novo" (não estava no plano).
- **Sem laço de requisições e sem perder estado**: com `blocked`, `pushState` não faz mais PUT (um 402 só). O estado local e o
  "devido ao servidor" ficam como estavam (nada é apagado). A cada rodada do poll (`checkRev`), em vez de buscar o documento, só
  pergunta `GET /api/me` (`recheckAccess`): se voltou ativo, desbloqueia e sincroniza o que estava pendente. Verificado no
  navegador: 1 PUT com 402, depois só `/api/me`; renovação → `/api/me` + `/api/data` + 1 PUT 200 com a edição feita durante o bloqueio.
- **Sair** na tela bloqueada usa `signOut({ force: true })`: o push não pode ir, então a cópia pendente fica guardada neste
  aparelho (stash) e volta quando a mesma conta entrar de novo, em vez de a saída recusar.
- O 402 em outra rota não bloqueia (hoje só o `PUT /api/data` responde 402).
- `Admin.jsx` (D5): a validade na lista agora mostra o ano (`fmtDate(..., true)`).

Achados da verificação no navegador (ACCESS_MODE ligado, RENEW_URL definido):
- **O primeiro admin não pode ser criado com `ACCESS_MODE` ligado**: o cadastro sem direito dá 403, mesmo com `FIRST_USER_ADMIN=1`.
  Para um servidor novo, crie o dono com o modo desligado e ligue depois (a D7 já precisa disso para os perfis antigos).
- `node scripts/build-api-docs.mjs` (citado no plano) não existe neste fork; a conferência do OpenAPI é o
  `openapi-routes.test.js` dentro de `api npm test`, que passa.

## C3: curadoria de vídeos dos exercícios dos templates

- **49 dos 54 exercícios dos pools** (`plan-generator.js`, home e academia) têm vídeo em `EXERCISE_VIDEOS`
  (`lib/exercise-videos.js`); o resto cai no botão "Ver como fazer" (busca no YouTube em português). A planilha
  `docs/curadoria-videos.csv` tem uma linha por exercício, com a busca sugerida, a URL escolhida, o status e uma coluna
  extra `titulo_canal` (título e canal lidos no oEmbed na hora da curadoria) para o dono revisar.
- **Desvio do plano:** o plano mandava entregar a planilha ao dono para aprovar antes de commitar. O dono autorizou
  enviar para produção todos os vídeos propostos que fossem confiáveis, então a aprovação foi essa autorização geral e o status
  ficou `proposto-verificado-oembed` (não `aprovado`). Critério: título compatível com a mesma variação do exercício, canal
  brasileiro de treino/fisioterapia, embed permitido (`playableInEmbed`), formato horizontal e duração de 13 s a 8,5 min
  (o plano pedia < 3 min; não deu para cobrir tudo com isso, vários bons demos têm de 3 a 8 min). Os ids vieram dos
  resultados de busca, nunca de memória, e cada um foi conferido no oEmbed (200). Não é uma revisão humana de conteúdo.
- **Sem vídeo (5):** `0781` afundo estático sem carga, `1039` agachamento na máquina de alavanca, `1206` pull through na
  polia, `1241` bird dog e `6435` ponte com apoio nos calcanhares. Só achei demonstrações em outro idioma ou de uma variação
  diferente; melhor sem vídeo do que com o errado.
- **Aproximações aceitas** (conferir se quiser algo mais exato): `4604` (PVC good morning) usa um "Good Morning - Bom dia" só
  com o peso do corpo; `0612` usa um vídeo de afundo; `2398` (flexão fechada de joelhos) usa a flexão "diamante" de joelhos;
  `1459` (terra romeno com halteres) usa um "Stiff com halteres"; `0871` (tuck crunch) usa "supra abdominal com joelhos no peito".
- Troca de um vídeo: mude o id em `exercise-videos.js` **e** a linha do CSV; `exercise-videos.test.js` falha se os dois
  divergirem. `node scripts/videos/verify.mjs` confere na rede se os 49 ainda respondem 200 (rodar de tempos em tempos:
  vídeos somem ou perdem o embed).
