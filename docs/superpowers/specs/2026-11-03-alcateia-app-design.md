# Alcateia App — design (fork do openGym)

Data: 2026-11-03 · Status: aprovado pelo dono do produto · Escopo: MVP de treino (sem nutrição)

## 1. Objetivo

Entregar às compradoras da oferta "Alcateia de Monstros" (quiz em `PROJETOS/alcateiaDeMonstros/site`,
checkout na Cakto) um app de treino próprio, em pt-BR, com plano gerado a partir de um mini-quiz,
demonstração em vídeo e acesso liberado automaticamente pela compra. Modelo de negócio: B2C,
assinatura recorrente (mensal R$ 19,90 · trimestral R$ 39,90 · semestral R$ 64,90, garantia de 30 dias).

Base de código: fork do openGym (github.com/DuarteSantos8/openGym, AGPL-3.0-or-later), rodando como
**um servidor, vários perfis isolados** (`state-<uid>.json` por perfil), sem multi-tenancy B2B.

## 2. Decisões já tomadas

| Tema | Decisão |
|---|---|
| Licença | **Caminho B**: cumprir a AGPL. O fork é **público**; link visível "Código-fonte" no app (AGPL §13). Avisos de copyright e `LICENSE` do upstream permanecem. |
| Mídia | A mídia da Gym visual (`catalogue/media`) **não pode** estar no fork, nem no histórico, nem na imagem Docker. Repo novo, histórico novo. |
| Vídeos | YouTube embed curado (componente `YouTubeVideo` já existe) agora; vídeos próprios depois. Exercício sem vídeo curado: botão "Ver como fazer" (`youtubeSearchUrl`, já existe). **Não** usar as imagens do `free-exercise-db`: são fotografias profissionais de origem não comprovada. |
| Hospedagem | Railway, 2 serviços (`web` público, `api` em rede privada com volume em `/data`), 1 réplica. |
| Pagamento | Cakto. Webhook dentro do `api` (rota nova), sem serviço extra. |
| Quiz → plano | Mini-quiz **dentro do app** (5 perguntas). O quiz de vendas não é alterado. |
| Nutrição | Fora do MVP. Aparece no app como card "em breve". A copy da oferta deve refletir isso até existir. |
| Login | Por senha (`PASSWORD_LOGIN=1`). Passkey continua disponível, não é o caminho principal. |

## 3. Fases e critérios de aceite

| Fase | Entrega | Aceite |
|---|---|---|
| 0 | Repo novo limpo; marca Alcateia; pt-BR; deploy Railway; contas das compradoras criadas por convite | App em HTTPS no domínio; login por senha funciona; `git log --all -- catalogue/media` vazio; imagem web sem `exercise-media`; testes passam |
| 1 | Mini-quiz + gerador de plano | Conta nova responde o quiz e recebe plano válido; testes unitários cobrem todas as combinações de entrada |
| 2 | Vídeos curados + "Ver como fazer" + card "em breve" | Todo exercício dos templates tem vídeo verificado (oEmbed 200); demais mostram o botão |
| 3 | Webhook Cakto + direitos de acesso + cadastro pelo e-mail da compra + bloqueio | Evento de teste da Cakto cria direito; reembolso bloqueia; renovação estende; compradora sem direito não cadastra |

Ordem importa: a Fase 0 já atende quem espera. A Fase 3 é a última porque o acesso manual cobre o início.

## 4. Fase 0 — base limpa, marca e deploy

**Repo novo.** `git init` num diretório novo (`alcateia-app`), copiando o tree do openGym **sem**:
`catalogue/media/`, `.git/`, `website/`, `fastlane/`, `helm/`, `kubernetes/`, `contrib/`, `.gitlab/`,
`.gitlab-ci.yml`, `watch-zepp/`, `frontend/ios`, `frontend/android`, `frontend/garmin`, `mcp/`,
`renovate.json`, `.github/workflows/{mirror,ios}.yml`. Remoções de diretórios nativos/auxiliares são
"tentar e rodar os testes": se um teste depender de algo removido, restaurar só o necessário.
Manter `LICENSE`, `NOTICE.md` (editado: remover a seção da mídia Gym visual, **manter** as atribuições
MuscleMap e ExerciseDB/hasaneyldrm e acrescentar "baseado em openGym, Duarte Santos, AGPL-3.0"), `CLA.md` removido.

**Código ligado à mídia.** `web/Dockerfile` (`COPY catalogue/media/`), `scripts/catalogue/check-media.mjs` e
seu passo no CI, `catalogue/media/NOTICE.md`, e todo código que monta URLs `exercise-media/...`
(`lib/exercises.js` `gifSrc`, `lib/anim-quality.js`, `components/Media*`) precisa degradar para
"sem mídia" sem erro de rede nem imagem quebrada. Um teste garante que nenhum caminho `exercise-media/`
é requisitado quando não há mídia.

**Marca.** Nome "Alcateia" (curto "Alcateia App"): `index.html` (title, apple-mobile-web-app-title),
`manifest.json` (name, short_name, description, theme_color, ícones 180/512 gerados do logo do quiz),
telas de login, "Sobre". Cores e fonte tiradas de `alcateiaDeMonstros/site/assets/quiz.css`.
Remover links de doação (Ko-fi, Buy me a coffee), site opengym.ch, Discord, verificação de atualização
para o GitHub do upstream. Em Configurações → Sobre: "Código-fonte" (repo público do fork) e
"Baseado no openGym".

**Idioma.** `DEFAULT_LANG=pt-BR`; as strings novas entram em todos os packs de `locales/`
(regra do projeto, `check-locales.mjs`).

**Railway.** Serviço `api` (Dockerfile `api/`, volume em `/data`, sem domínio público, 1 réplica) e serviço
`web` (Dockerfile `web/`, domínio público). `BACKEND=<nome-interno-do-api>`, `PORT=3000`; o `RESOLVER` do nginx
deve apontar ao DNS da rede privada da Railway (**verificar no deploy**; sem isso `/api` trava).
Variáveis do `api`: `RP_ID=<dominio>`, `ORIGIN=https://<dominio>`, `PASSWORD_LOGIN=1`, `INVITE_ONLY=1`,
`FIRST_USER_ADMIN=1`, `ALLOW_GUEST=0`, `DEFAULT_LANG=pt-BR`, `COACH_DISABLED=1`, `TRUST_PROXY=1`, `AUDIT_IP=off`.
**Risco a resolver:** atrás da Railway o "peer" que o nginx enxerga é o proxy da Railway; a limitação de
tentativas de login por IP pode passar a contar todas as alunas como um só endereço. Verificar em
`web/nginx.conf.template` e ajustar para ler o IP real do cabeçalho que a Railway define.
Backup: ativar backups do volume da Railway (conferir se o plano contratado inclui) e exportar `/data` semanalmente.

## 5. Fase 1 — mini-quiz e gerador de plano

**`frontend/src/lib/plan-generator.js`** (função pura, com `plan-generator.test.js` ao lado).

Entrada: `{ goal, place, days, minutes, level }`
- `goal`: `lose-fat` | `tone` | `glutes-legs` | `conditioning`
- `place`: `home` | `gym` | `both`
- `days`: 2, 3, 4 ou 5
- `minutes`: 15 | 30 | 45
- `level`: `beginner` | `intermediate` | `advanced`

Saída: `{ routines, schedule }` no formato de `buildStarterPlan` (rotinas `[id, séries, reps]`, `schedule` por
dia da semana com `routineId`), ou `null` se a entrada for inválida. O resultado é aplicado pelo mesmo
caminho que o seletor de planos iniciais já usa.

Como escolhe: tabela de **templates escritos à mão** (split por `days`, foco por `goal`), com listas de
exercícios curados (~150–200 ids do catálogo) etiquetados por local (`home`: peso corporal, elástico,
halteres; `gym`: máquinas, barras, cabos). Séries/reps e nº de exercícios por `level` e `minutes`.
Equipamento ausente é trocado por `substituteFor` (já existe em `starter.js`; exportar `fitRoutines`).
Determinística: mesma entrada, mesmo plano. Sem sorteio.

Invariantes testadas: todo id existe em `EXIDX`; nenhum exercício exige equipamento que o `place` não tem;
nenhuma rotina vazia; `schedule` só usa rotinas existentes e dias distintos; nº de dias == `days`;
duração estimada ≤ `minutes` + folga.

**Tela `views/AlcateiaQuiz.jsx`.** Aparece após o login quando `S.alcateia.quizDone` é falso. 5 perguntas, uma por tela,
resultado "Seu plano Alcateia" com botão "Começar". Refazível em Configurações. O estado novo em `S`
passa pelo sync (`sync-merge.js`/`api/sync-stamps.js` são espelhados: **mudar os dois**, ver CLAUDE.md).

## 6. Fase 2 — vídeos

- `frontend/src/lib/exercise-videos.js`: `{ [exerciseId]: youtubeId }`, só IDs (11 chars). Renderizado com
  `YouTubeVideo` onde a mídia nativa aparecia, **só após toque** (`youtube-nocookie.com`, CSP já permite).
- `scripts/videos/verify.mjs`: consulta `https://www.youtube.com/oembed?url=...` por ID; falha em não-200.
  Roda antes de cada release e em CI quando houver rede.
- `docs/curadoria-videos.csv`: id, nome, busca sugerida, URL escolhida, status. Os vídeos são **propostos por
  Claude e aprovados pelo dono do produto**; preferir canais brasileiros com boa técnica. Substituir por
  vídeos próprios é trocar o ID no arquivo.
- Sem vídeo curado: botão "Ver como fazer" com a busca no YouTube em pt-BR (ajustar `youtubeSearchUrl` para
  usar o nome traduzido + "execução correta").
- Card "Alimentação — em breve" na Home e/ou aba, sem função.

## 7. Fase 3 — Cakto, direitos de acesso e bloqueio

### 7.1 Modelo de dados (em `db.json`, junto de `users`)

```
db.entitlements: [{
  email,            // minúsculas, trim; chave de busca
  status,           // 'active' | 'inactive'
  source,           // 'cakto' | 'manual'
  plan,             // 'mensal' | 'trimestral' | 'semestral' | 'manual'
  subscriptionId,   // data.subscription.id da Cakto (ou null)
  validUntil,       // ISO; acesso vale até aqui (já com carência)
  userId,           // preenchido quando a aluna cria a conta
  lastEvent, updatedAt, createdAt
}]
db.caktoSeen: ["<event>:<data.id>", ...]   // dedup, últimos 500
```

Acesso ativo = `status === 'active'` **e** `validUntil > agora`. Administradores são isentos.

### 7.2 Webhook `POST /api/hooks/cakto`

Corpo bruto (bytes exatos) é necessário para a assinatura: capturar antes do `JSON.parse`.
Verificação (docs.cakto.com.br/conceitos/webhooks):
1. Cabeçalhos `X-Cakto-Timestamp` (segundos) e `X-Cakto-Signature` (`v1=<hex>`). Assinado = `"{timestamp}.{corpo bruto}"`,
   HMAC-SHA256 com a chave `CAKTO_WEBHOOK_SECRET`; comparar com `timingSafeEqual`; rejeitar timestamp fora de ±5 min.
2. Sem esses cabeçalhos: comparar `body.secret` com a mesma chave (comparação de tempo constante).
3. Falha → **401**.

Regras de resposta (a Cakto **não reenvia** quando a resposta é erro, e o limite é 8 s): responder **200** em
qualquer evento válido, inclusive os ignorados e os repetidos; processar de forma síncrona e rápida (memória +
`saveDb`); nunca devolver 5xx por conteúdo inesperado, só registrar. Deduplicar por `"<event>:<data.id>"`.
`data` pode ser array no Webhook V2; tratar `Array.isArray(data)` iterando os pedidos. `checkout_abandonment` não tem `data.id`: ignorar.

Mapa de eventos (e-mail = `data.customer.email`):

| Evento | Efeito |
|---|---|
| `purchase_approved`, `subscription_created` | cria/ativa o direito; `validUntil` = `subscription.next_payment_date` + carência, ou `paidAt` + dias do plano |
| `subscription_renewed`, `subscription_late_recovered`, `subscription_resumed` | ativa e estende `validUntil` (nunca encurta) |
| `subscription_late`, `subscription_renewal_refused` | sem mudança (vale a carência) |
| `subscription_canceled` | mantém até `validUntil` (período já pago), sem estender |
| `subscription_paused` | `inactive` |
| `refund`, `chargeback` | `inactive` imediato (`validUntil` = agora) |
| `refund_requested`, `dispute_defense_requested`, demais | só registra |

Plano pelo produto: `CAKTO_PLANS` (JSON em variável de ambiente) mapeia `offer.id` ou `product.id` a `{plan, days}`;
sem mapeamento, usar `subscription.recurrence_period` (30/90/180) e, na falta, 30 dias. Carência:
`ACCESS_GRACE_DAYS` (padrão 3).

### 7.3 Cadastro e bloqueio

- Novo `ACCESS_MODE=subscription`. Desligado, o servidor se comporta como o upstream (sem regressão).
- `POST /api/register/password` passa a exigir `email`. Cadastro permitido só se existir direito **ativo e sem `userId`**
  para aquele e-mail (ou um convite válido, para casos manuais). Ao criar o perfil, grava `user.email` e `entitlement.userId`.
  Mensagem de erro neutra ("não encontramos uma assinatura ativa para este e-mail") para não vazar quais e-mails existem;
  contar tentativas com o limitador já existente (`addressPaused`/`strikeAddress`).
- `publicUser(user)` inclui `access: { active, plan, validUntil }`.
- `PUT /api/data` responde **402** `{ code: 'subscription-inactive' }` quando o direito está inativo (GET segue funcionando;
  os dados da aluna ficam guardados). O frontend mostra a tela "Assinatura inativa" com botão para `RENEW_URL`.
- Admin (`Admin.jsx`): seção "Acessos" para listar e criar/ajustar direitos manualmente (e-mail, plano, validade).
  Migração: perfis criados na Fase 0 (por convite) recebem direito `manual` com a validade combinada, antes de ligar `ACCESS_MODE`.
- Página pós-compra (configurada na Cakto, "Criar minha conta") aponta para `/#/login?cadastro=1`.

### 7.4 Segredos

`CAKTO_WEBHOOK_SECRET`, `CAKTO_PLANS`, `ACCESS_GRACE_DAYS`, `RENEW_URL` só em variáveis de ambiente da Railway. Nunca no repo.

## 8. Escala — quando sair do Railway com arquivos JSON

O `api` guarda contas em `db.json` e reescreve **o arquivo inteiro, duas vezes** (`db.json` + `.bak`, com fsync, de forma
síncrona) a cada mudança de conta, e a cada 10 min por aluna ativa (`lastPull`). Medido neste repo
(NVMe local, `saveDb` completo): 500 contas = 6 ms · 2.000 = 13 ms · 5.000 = 27 ms · 10.000 = 57 ms · 20.000 = 98 ms.
Volume de rede da Railway tende a ser mais lento no fsync; assuma 3–5× (estimativa, medir no deploy real).

Regra prática, com o app aberto por ~5–10 % das assinantes ao mesmo tempo:
- **Até ~2.000 assinantes ativas**: confortável.
- **2.000–5.000**: funciona, mas medir `saveDb` na Railway; mitigação barata é subir `PULL_NOTE_MS` e não indentar o JSON.
- **Planejar a troca por Postgres ao chegar em ~2.000–3.000 assinantes ativas**, ou antes se `saveDb` passar de ~100 ms
  no deploy, ou se houver mais de ~300 alunas simultâneas. A troca é um projeto próprio (camada de contas em `server.js`),
  e o ponto de entrada limpo é o módulo de direitos desta spec.
- Uma réplica só: um deploy gera uns segundos fora do ar. Fazer deploys fora do horário de pico.

## 9. Testes

- Convenção do repo: helper puro em `lib/` com teste ao lado; `api/` usa `node --test`.
- `plan-generator`: invariantes da §5 em todas as combinações (≈ 4·3·4·3·3 = 432 entradas, rápido).
- `api/entitlements.js` (puro: aplica evento a lista de direitos) e `api/cakto-webhook.js` (verificação de assinatura):
  assinatura válida/inválida/expirada, corpo adulterado, segredo no corpo sem cabeçalho, evento repetido, renovação que
  estende, cancelamento que não encurta, reembolso que bloqueia, `data` em array, e-mail com maiúsculas/espaços.
- Rotas: `/api/hooks/cakto` 401/200; cadastro sem direito = erro neutro; `PUT /api/data` 402; admin isento.
- Todo endpoint novo entra em `api/openapi.yaml` (`openapi-routes.test.js` compara).
- Antes de cada entrega: `npm test` (frontend e api), `check-locales`, build Docker e verificação manual no navegador.

## 10. Fora do escopo

Nutrição (plano alimentar, receitas, macros por foto), apps de loja/relógios, Coach de IA, B2B/professor-aluno,
troca para Postgres, quiz de vendas (continua no Vercel), e-mail transacional.

## 11. Pendências do dono do produto

Nome do repo e conta GitHub · domínio · logo em boa resolução · aprovação dos vídeos curados · plano da Railway
(backups de volume) · lista de e-mails das compradoras atuais e validade combinada · IDs de produto/oferta da Cakto
· confirmar com um **evento de teste real** da Cakto o formato da assinatura na conta · ajustar a copy da oferta
(nutrição "em breve", "vídeo" vs. vídeos de terceiros, números e depoimentos devem ser verdadeiros).
