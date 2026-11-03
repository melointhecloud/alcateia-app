Você vai implementar o **Alcateia App**, um fork do openGym (AGPL-3.0) que entrega a oferta "Alcateia de Monstros" como SaaS B2C na Railway. O desenho e o plano já estão prontos e aprovados; sua tarefa é executar.

## Leia primeiro (nesta ordem)

1. `/home/lukas-melo/PROJETOS/projetoWomansApp/docs/superpowers/specs/2026-11-03-alcateia-app-design.md` (o que e por quê)
2. `/home/lukas-melo/PROJETOS/projetoWomansApp/docs/superpowers/plans/2026-11-03-alcateia-app.md` (como, tarefa por tarefa, com código e comandos)
3. `/home/lukas-melo/PROJETOS/projetoWomansApp/openGym/CLAUDE.md` (convenções do código; o clone `openGym/` é só referência, não edite)

## Como executar

Use a skill `superpowers:subagent-driven-development` (ou `superpowers:executing-plans`) e siga o plano na ordem: **Parte A (Fase 0) → B → C → D**. Marque os checkboxes conforme avança. Em tarefas com TDD, escreva o teste, veja falhar, implemente, veja passar, commite. Todo trabalho acontece no repo novo `/home/lukas-melo/PROJETOS/projetoWomansApp/alcateia-app/`, que a Task A1 cria.

## Contexto rápido

- Base: openGym (React 19 + Vite + Zustand; API em Node puro `node:http`, JSON em disco). Detalhes no CLAUDE.md dele.
- Produto: assinaturas via Cakto (mensal R$19,90, trimestral R$39,90, semestral R$64,90), quiz de vendas no Vercel (`PROJETOS/alcateiaDeMonstros/site`, não alterar), app em pt-BR.
- O dono do produto já tem compradoras esperando: a Fase 0 (app no ar, contas criadas por convite) é a prioridade.

## Regras que não podem ser quebradas

1. **A mídia da Gym visual (`catalogue/media/`) nunca entra no repo novo, nem no histórico git, nem na imagem Docker.** A licença proíbe uso comercial. A Task A2 cria uma guarda de CI; mantenha-a verde sempre. Não use as imagens do `free-exercise-db` (origem não comprovada).
2. **O fork é público** (AGPL): mantenha `LICENSE`, avisos de copyright e o link "Código-fonte" no app. Nunca coloque segredos, `.env`, `data/` ou o `secret` da sessão no repo.
3. **Não faça por conta própria, peça confirmação ao usuário antes:** criar o repo no GitHub (Task A6), criar/alterar recursos na Railway e domínio (A7), ligar `ACCESS_MODE`/webhook na Cakto (D7), qualquer compra/reembolso de teste. São ações externas e/ou com custo.
4. **Pare e peça validação humana** ao fim da Parte A (app no ar com marca) e antes de aprovar os vídeos (C3: o usuário aprova cada vídeo proposto) e antes de ligar a Cakto (D7).
5. Siga as convenções do repo: sem linter/TS (copie o estilo), helpers puros em `frontend/src/lib/` com teste ao lado, endpoint novo entra em `api/openapi.yaml`, texto novo dentro de `t()` e em todos os packs de `frontend/src/locales/`, sem travessão (em dash) em texto para o usuário, `sync-merge.js` e `api/sync-stamps.js` mudam juntos.
6. Dependências novas: evite (o projeto é deliberadamente enxuto; o plano não precisa de nenhuma).
7. Se algo no plano não bater com o código real (número de linha, nome de função, formato), **confie no código**, ajuste e registre a divergência em `docs/FORK-NOTAS.md`. Se um teste do plano falhar por causa de um dado do catálogo (ex.: um id do gerador que exija acessório), troque o dado, não relaxe o teste.
8. Não declare uma tarefa pronta sem rodar os testes dela e a suíte do pacote (`cd frontend && npm test`, `cd api && npm test`) e, quando a tarefa mexe na interface, **abrir o app no navegador** e ver funcionando.

## Informações que você vai precisar pedir ao usuário (no momento certo)

Nome do repo e conta do GitHub · domínio · logo em boa resolução (o do quiz serve para começar) · e-mail de suporte · IDs de produto/oferta das 3 ofertas na Cakto · lista de e-mails das compradoras atuais e validade combinada · plano contratado da Railway (backups de volume) · aprovação dos vídeos curados.

## Pontos já sabidos que merecem atenção

- Railway: o `RESOLVER` do nginx (`web`) precisa apontar ao DNS da rede privada, e o IP real do cliente precisa chegar ao limitador de login (senão todas as alunas dividem o mesmo limite). Está na Task A7, passos 4 e 6.
- Cakto: a docs diz que o webhook **não é reenviado** se a resposta for erro e que o limite é 8 s; por isso o handler responde 200 a todo evento autêntico e deduplica por `<evento>:<data.id>`. Confirme o formato da assinatura com um **evento de teste real** (D7, passo 4).
- Escala: o `api` reescreve `db.json` inteiro a cada mudança de conta. Registre o tempo de `saveDb` observado na Railway em `docs/OPERACAO.md` (D8) para decidir quando migrar para Postgres (~2.000-3.000 assinantes ativas).
- A copy da oferta (nutrição, "vídeo", números e depoimentos) precisa refletir o que o app realmente entrega; lembre o usuário na entrega.

Comece pela Task A1.
