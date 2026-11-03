# Alcateia App

O app de treino da Alcateia: plano personalizado, registro de treinos e peso, progressão de cargas
e histórico. É um PWA (instala na tela inicial) com login por senha ou chave de acesso (passkey),
feito para rodar em dois containers (`api` e `web`) com os dados numa pasta/volume só seu.

Este projeto é um fork do [openGym](https://github.com/DuarteSantos8/openGym), de Duarte Santos,
e continua sob a mesma licença. Nesta versão não há mídia de exercícios (as imagens e animações do
openGym têm licença própria e não foram trazidas); os exercícios aparecem só em texto.

## Como rodar

Desenvolvimento (Node 22):

```bash
# API (porta 3000)
cd api && npm install
DATA_DIR=/tmp/alcateia-data PORT=3000 RP_ID=localhost ORIGIN=http://localhost:5173 node server.js

# Frontend (porta 5173, repassa /api para a porta 3000)
cd frontend && npm install && npm run dev
```

Com Docker:

```bash
cp .env.example .env     # ajuste RP_ID, ORIGIN e o resto
docker compose up -d --build
```

Variáveis úteis: `RP_ID` e `ORIGIN` (o domínio do app, necessários para passkeys), `RP_NAME`
(padrão `Alcateia`), `DEFAULT_LANG=pt-BR` (idioma de quem ainda não escolheu um), `INVITE_ONLY`,
`PASSWORD_LOGIN`, `ALLOW_GUEST`. O guia completo, herdado do upstream, está em
[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

Testes:

```bash
cd frontend && npm test
cd api && npm test
node scripts/check-no-licensed-media.mjs
```

## Licença e código-fonte

O Alcateia App é software livre sob a [GNU AGPL v3 ou posterior](LICENSE). Quem usa o app tem
direito ao código-fonte correspondente: o link está em Configurações, Sobre e Atualizações
("Código-fonte"). As atribuições de terceiros estão em [NOTICE.md](NOTICE.md).

## Baseado no openGym

Código original de [openGym](https://github.com/DuarteSantos8/openGym), por Duarte Santos
(AGPL-3.0-or-later). As mudanças deste fork estão registradas em
[docs/FORK-NOTAS.md](docs/FORK-NOTAS.md). Os documentos em `docs/` que vieram do upstream ainda
falam do openGym.
