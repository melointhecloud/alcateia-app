# Operação manual do Alcateia App

Guia para o dono do produto. Serve para quem já comprou e precisa de acesso antes da integração automática com a Cakto (Fase 3). Nada aqui exige programar.

Troque `<dominio>` pelo endereço real do app (o mesmo configurado na Railway).

## 1. Primeiro acesso do dono (uma vez só)

O app só aceita cadastro com convite (`INVITE_ONLY=1`). Mas convite só se gera dentro do painel admin, e o painel admin só existe depois que alguém se cadastra. Por isso, no primeiro dia:

1. A variável `INVITE_ONLY` do serviço `api` começa em `0`. Assim o primeiro cadastro não pede convite.
2. Você abre `https://<dominio>`, toca em "Criar novo perfil" e cria o seu perfil (de preferência por senha). Como `FIRST_USER_ADMIN=1`, o primeiro perfil criado vira admin e dono.
3. Só depois disso, na Railway, mude `INVITE_ONLY` para `1` e reinicie o serviço `api`.
4. Teste: abra o app numa janela anônima e tente criar um perfil sem código. Tem que ser recusado.

Atenção: se `INVITE_ONLY` ficar em `0`, qualquer pessoa com o link cria conta. Se ficar em `1` antes de você se cadastrar, ninguém consegue entrar, nem você.

## 2. Gerar um convite

1. Entre no app com a sua conta.
2. Abra Configurações e toque em "Painel de administração". Esse item só aparece para contas admin.
3. No painel, procure o cartão "Invite codes" e toque em "New code".
4. O código é criado e já fica copiado na área de transferência. Ele também aparece na lista "Unused".

Observações:
- O painel é em inglês (não é traduzido). Os nomes acima são os reais.
- Cada código vale para uma pessoa só. Depois de usado, passa para a lista "Already used", com o nome de quem usou.
- Para cancelar um código que ainda não foi usado, toque no ícone de lixeira ao lado dele.

## 3. Enviar à aluna

Mande por WhatsApp ou e-mail, uma mensagem por aluna:

> Oi, [nome]! Seu acesso ao Alcateia App está liberado.
> 1. Abra https://<dominio>
> 2. Toque em "Criar novo perfil"
> 3. Se aparecer a escolha entre "Chave de acesso" e "Senha", escolha **Senha**
> 4. Preencha seu nome, o **e-mail que você usou na compra**, o código de convite abaixo e uma senha (mínimo 10 caracteres)
> 5. Seu código: **XXXXXXXX**
> Guarde sua senha. Dica: no celular, use "Adicionar à tela inicial" para instalar o app.

Pontos importantes:
- O formulário de cadastro por senha já tem o campo "E-mail (opcional)". Ele é opcional no app, então nada impede a aluna de deixar em branco. Combine com ela que é obrigatório informar, porque a Fase 3 vai usar esse e-mail para casar o perfil com a assinatura. Se esquecer, ela pode cadastrar o e-mail depois nas configurações da conta, ou você anota na planilha.
- Quando há suporte a chave de acesso (passkey) no aparelho, o app abre primeiro na opção "Chave de acesso". É preciso trocar para "Senha" no seletor. Se a aluna escolher chave de acesso, o formulário não tem campo de e-mail.
- Você confere o e-mail de cada aluna no painel: na lista "Users", o e-mail aparece embaixo do nome.

## 4. Gerenciar contas

No painel de administração, na lista "Users", toque no nome da aluna. Lá estão os botões (em inglês):

- **Disable account**: bloqueia o acesso. Ela é desconectada de todos os aparelhos e não consegue entrar nem sincronizar. Nada é apagado. Use quando a assinatura vence. Para devolver o acesso, o mesmo botão vira "Enable account".
- **Delete account**: apaga a conta e todo o histórico de treino dela, sem volta. Pede duas confirmações. Antes de apagar, o painel oferece baixar os dados dela. O código de convite usado continua gasto.
- **Reset password** (criar código de redefinição): para quem esqueceu a senha. Você recebe um código de uso único, válido por 24 horas, e passa para a aluna.
- Contas admin não podem ser desativadas nem apagadas sem antes remover o papel de admin.

Prefira desativar a apagar. Desativar é reversível.

## 5. Log de atividade

No mesmo painel, role até o cartão "Activity log" (último da página). Ele mostra quem entrou, quais tentativas falharam e o que um admin mudou. Filtros: All, Sign-ins, Admin, Failed. O botão de atualizar (seta circular) fica no topo da página.

- O log fica guardado por 90 dias ou 5.000 eventos (`AUDIT_DAYS` e `AUDIT_MAX`, o que vier primeiro).
- Por privacidade, endereços de IP não são gravados (`AUDIT_IP=off`).
- Só o dono pode limpar o log (ícone de lixeira do cartão).
- O arquivo em si é `/data/audit.log`.

## 6. Planilha de controle

Mantenha uma planilha (Google Sheets) com uma linha por aluna:

| nome | e-mail | plano | data da compra | validade |
|---|---|---|---|---|
| Maria Silva | maria@exemplo.com | mensal | 2026-11-03 | 2026-12-03 |

- **e-mail**: o mesmo da compra na Cakto. É a chave para a Fase 3.
- **plano**: o nome do plano comprado.
- **validade**: até quando ela tem direito. Olhe a coluna toda semana e desative (seção 4) quem venceu e não renovou.
- Opcional: uma coluna "convite enviado" com o código, para saber a quem cada um foi.

A planilha tem dados pessoais. Não compartilhe com quem não precisa.

## 7. Backup e restauração

O que importa fica no volume `/data` do serviço `api` (contas em `db.json`, treinos em `state-*.json`, chave de sessão em `secret`, log em `audit.log`). Se o volume se perder sem backup, as alunas perdem tudo.

**Opção A, recomendada: backups automáticos da Railway.** No painel da Railway, abra o projeto, o serviço `api`, o volume, e procure a aba "Backups". Ative e defina a frequência. Nem todo plano da Railway inclui backup de volume: confira no seu plano. (A conferir na tarefa D8.)

**Opção B: exportação semanal manual.** Precisa do Railway CLI instalado (versão testada: 5.71.0), com `railway login` feito e o projeto ligado (`railway link`). Comandos, no seu computador:

```bash
# 1. Ver o volume e o serviço
railway volume list
railway status

# 2. Baixar a pasta inteira do volume para uma pasta datada
railway volume files download / ./backup-AAAA-MM-DD --volume <nome-ou-id-do-volume>
```

Alternativa, gerando um único arquivo dentro do servidor e baixando:

```bash
railway ssh -s api "tar czf /data/backup.tgz -C /data --exclude=backup.tgz ."
railway volume files download /backup.tgz ./backup-AAAA-MM-DD.tgz --volume <nome-ou-id-do-volume>
railway volume files delete /backup.tgz --volume <nome-ou-id-do-volume> --yes
```

Regras:
- Faça toda semana (ponha um lembrete na agenda) e guarde as 4 últimas cópias, num lugar seguro e privado. O backup contém senhas (em formato protegido) e dados pessoais.
- Estes comandos foram escritos a partir de `railway --help`, `railway ssh --help` e `railway volume files --help`, e ainda não foram executados no projeto real. Teste uma vez com calma e confirme que o arquivo baixado abre.

**Restaurar.** Peça ajuda técnica para esta etapa, porque o servidor guarda os dados em memória e sobrescreve o que for colocado por cima enquanto está no ar. Resumo do procedimento:
1. Na Railway, pare o serviço `api` (remova o deploy ativo).
2. Envie os arquivos do backup de volta:
   `railway volume files upload ./backup-AAAA-MM-DD/db.json /db.json --volume <nome-ou-id-do-volume>` (repita para os demais arquivos, incluindo `secret`).
3. Faça o deploy do `api` de novo e teste `https://<dominio>/api/health` e um login.

Se só o `db.json` estiver corrompido, o servidor já tenta usar sozinho o `db.json.bak` (cópia da última gravação) ao subir.

## 8. Quando migrar para Postgres

Hoje as contas ficam em um arquivo JSON (`db.json`), reescrito inteiro a cada mudança. Isso é rápido para poucas alunas e vai ficando mais lento com o tamanho.

Medido em disco local rápido: 500 contas levam 6 ms por gravação, 2.000 levam 13 ms, 5.000 levam 27 ms, 10.000 levam 57 ms e 20.000 levam 98 ms. O disco da Railway é mais lento; a estimativa é de 3 a 5 vezes mais.

Regra prática:
- Até cerca de 2.000 assinantes ativas: tranquilo.
- De 2.000 a 5.000: funciona, mas meça o tempo de gravação na Railway.
- Planeje a troca por Postgres ao chegar em 2.000 a 3.000 assinantes ativas, ou antes se a gravação passar de cerca de 100 ms, ou se houver mais de cerca de 300 alunas usando ao mesmo tempo.
- A troca é um projeto próprio. Avise com antecedência.
- Há uma réplica só: cada deploy deixa o app fora do ar por alguns segundos. Faça deploys fora do horário de pico.

**Medição real do `saveDb` na Railway** (preencher na tarefa D8):

| data | nº de contas | tempo do `saveDb` (ms) | quem mediu |
|---|---|---|---|
| (pendente) | | | |

## 9. Lista do que fazer agora

1. Concluir o primeiro acesso (seção 1) e ligar `INVITE_ONLY=1`.
2. Configurar o backup (seção 7) e testar uma exportação.
3. Criar a planilha (seção 6) com as compradoras atuais.
4. Gerar um convite por compradora e enviar a mensagem da seção 3.
5. Conferir no painel, depois de alguns dias, quem já se cadastrou e quem falta.
