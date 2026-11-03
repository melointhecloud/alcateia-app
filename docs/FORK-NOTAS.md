# Notas do fork (Alcateia App)

Este repositório é um fork do openGym (AGPL-3.0-or-later). Este arquivo registra o que foi
removido do upstream, por quê, e onde nos afastamos do plano. Os documentos herdados do upstream
(README, CHANGELOG, CONTRIBUTING, CLAUDE.md, a maior parte de `docs/`) ainda falam do openGym;
o README será reescrito na Task A4 e o resto só muda quando tocarmos no assunto.

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
