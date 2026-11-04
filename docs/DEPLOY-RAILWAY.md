# Deploy do Alcateia App na Railway

Passo a passo do deploy em dois serviços (`api` e `web`) num mesmo projeto da Railway, com os
valores que o `web` precisa para falar com o `api` pela rede privada e para enxergar o IP real de
cada aluna. Não há segredos aqui: tudo o que é segredo (nenhum, no momento) fica só no painel da
Railway.

Os trechos marcados **(doc oficial)** foram conferidos em docs.railway.com em 2026-11-04. Os
marcados **(comunidade)** vêm de respostas da equipe e de usuários no fórum da Railway, não da
documentação, e **(a conferir no ar)** são o que só se confirma com o serviço rodando. A seção
"O que a documentação da Railway não diz" lista as lacunas.

## 1. Serviços

| Serviço | Dockerfile | Contexto de build | Domínio público | Volume |
|---|---|---|---|---|
| `api` | `api/Dockerfile` | `api/` | nenhum | `/data` |
| `web` | `web/Dockerfile` | raiz do repositório | sim (o do app) | nenhum |

O contexto do `web` é a raiz porque o build usa `frontend/` e `api/coach/core/`. O `api` roda com
**uma réplica só**: os dados são arquivos JSON em `/data`, sem coordenação entre processos.

O nome do serviço vira o nome na rede privada: um serviço chamado `api` responde em
`api.railway.internal` **(doc oficial)**. Se você der outro nome ao serviço, use esse nome em
`BACKEND`.

## 2. Variáveis do `api`

```
DATA_DIR=/data
RP_ID=<dominio>                 ORIGIN=https://<dominio>
RP_NAME=Alcateia                DEFAULT_LANG=pt-BR
PASSWORD_LOGIN=1                INVITE_ONLY=0    (vira 1 depois de criar o perfil do dono, passo 7)
ALLOW_GUEST=0                   FIRST_USER_ADMIN=1
COACH_DISABLED=1                AUDIT_IP=off
TRUST_PROXY=1                   PORT=3000
```

`TRUST_PROXY=1` faz o limitador de login contar por `X-Forwarded-For` / `X-Real-IP`, que o nginx do
`web` reescreve a partir do endereço que ele próprio enxerga. Por isso o `api` **não pode** ter
domínio público: se alguém o alcançasse direto, poderia mandar esses cabeçalhos à vontade.

`RP_ID` é o domínio sem `https://`; `ORIGIN` é com `https://` e sem barra no fim. As duas precisam
ser iguais ao domínio final, senão passkeys e login falham.

## 3. Variáveis do `web`

| Variável | Valor na Railway | De onde vem |
|---|---|---|
| `BACKEND` | `api.railway.internal` (nome do serviço do `api` + `.railway.internal`) | doc oficial: Private Networking |
| `PORT` | `3000` (a porta em que o `api` escuta) | o `api` usa `PORT=3000` |
| `NGINX_PORT` | `8080` | a imagem roda sem root e não abre a porta 80 fora do Docker |
| `RESOLVER` | `[fd12::10]` | comunidade (ver abaixo). Alternativa: `auto` |
| `RESOLVER_IPV6` | `on` | doc oficial: ambientes antigos resolvem só IPv6 |
| `REAL_IP_HEADER` | `X-Real-IP` | doc oficial: Specs and Limits |
| `REAL_IP_FROM` | faixa do proxy da Railway, **descoberta no passo 6** | a conferir no ar |

Detalhes de cada uma:

- **`BACKEND`** pode ser escrito como referência de variável da Railway
  (`${{api.RAILWAY_PRIVATE_DOMAIN}}`), que acompanha o nome do serviço se ele for renomeado. O
  upstream do nginx é `http://${BACKEND}:${PORT}`. Um endereço IPv6 literal precisa de colchetes
  (`[fd12::1]`), mas na Railway use o nome: a Railway não dá IP fixo na rede privada **(comunidade)**.
- **`PORT` no `web`.** A Railway usa a variável `PORT` do serviço para saber a que porta mandar o
  tráfego do domínio público. Como o `web` precisa de `PORT=3000` (é a porta do `api` no upstream) e
  o nginx escuta em `NGINX_PORT=8080`, **defina a porta de destino do domínio do `web` como 8080** em
  Settings, Networking. Sem isso o domínio manda para a 3000, onde nada escuta, e a Railway devolve 502.
- **`RESOLVER` / `RESOLVER_IPV6`.** O nginx do `web` resolve `BACKEND` a cada requisição (para
  sobreviver a um redeploy do `api` com IP novo), e para isso precisa do endereço do DNS. A
  documentação da Railway não publica esse endereço. A comunidade e a equipe da Railway apontam
  `fd12::10` (o mesmo desde que a rede privada existe) e sugerem `valid` curto. A imagem já usa
  `valid=10s`. Nos ambientes **criados antes de 16/10/2025** o nome resolve **só IPv6**
  **(doc oficial)**, e com `ipv6=off` o nginx nem pergunta por AAAA e responde 502 (testado, ver
  seção 8). Ambientes novos resolvem IPv4 e IPv6, mas `on` funciona nos dois casos.
  Se `[fd12::10]` não funcionar no seu ambiente, use `RESOLVER=auto`: a imagem lê o primeiro
  `nameserver` de `/etc/resolv.conf` (que a própria Railway preenche) e coloca colchetes se for
  IPv6. A linha `11-resolver.envsh: nginx resolver for BACKEND: ...` no log de subida mostra o
  valor que valeu. Quem quiser conferir à mão: `railway ssh` no serviço `web` e `cat /etc/resolv.conf`.
- **O `api` precisa aceitar IPv6.** Em ambiente antigo a rede privada é só IPv6. O `api` faz
  `server.listen(PORT)` sem endereço, e o Node assim escuta em `::` (IPv6 e IPv4), então já serve.
- **`REAL_IP_HEADER` / `REAL_IP_FROM`**: ver seção 5.

Os valores padrão da imagem (`RESOLVER=127.0.0.11`, `RESOLVER_IPV6=off`, `REAL_IP_FROM` e
`REAL_IP_HEADER` vazios) são os do `docker compose` e de self-host, que continuam funcionando sem
mudar nada.

## 4. Volume, réplica e domínio

1. No `api`: volume montado em `/data`. Uma réplica. Sem domínio público.
2. No `web`: domínio customizado (a Railway emite o certificado) e porta de destino 8080.
3. Confira `RP_ID` e `ORIGIN` do `api` contra o domínio final e faça redeploy do `api`.

## 5. IP real da aluna (o risco da spec)

Sem ajuste, o nginx do `web` enxerga como cliente o proxy da Railway e repassa esse endereço ao
`api` em `X-Real-IP` e `X-Forwarded-For`. O limitador de login do `api` conta falhas por endereço
(20 respostas erradas livres, depois pausa de 30 s que dobra até 15 min) e limita 60 requisições por
minuto por endereço. Com todas as alunas no mesmo endereço, uma só pessoa digitando senha errada
pausa o login por senha de todo mundo.

A correção usa o `ngx_http_realip_module` do nginx, ligado por variáveis:

- `REAL_IP_FROM`: endereços ou faixas CIDR do proxy que está na frente (separados por espaço ou
  vírgula). **Vazio (padrão) = não confia em ninguém**, e `$remote_addr` continua sendo quem abriu a
  conexão TCP, como sempre foi.
- `REAL_IP_HEADER`: o cabeçalho em que esse proxy coloca o IP da visitante. Se `REAL_IP_FROM` estiver
  preenchido e este vazio, vale `X-Real-IP`.

O cabeçalho só é aceito em conexões que **vêm de** `REAL_IP_FROM`. Numa conexão de qualquer outro
endereço, um `X-Real-IP` ou `X-Forwarded-For` forjado é ignorado. A imagem recusa na subida
`0.0.0.0/0` e `::/0` (confiar em todo mundo seria deixar qualquer um escolher o próprio IP) e
qualquer valor que não seja endereço ou faixa.

Como o `envsubst` não faz condicionais, o script `web/12-real-ip.sh` (que o entrypoint do nginx
roda antes de montar a configuração) gera `/etc/nginx/real-ip.conf` com as diretivas, e
`web/nginx.conf.template` o inclui. Com `REAL_IP_FROM` vazio o arquivo só tem um comentário.
`real_ip_recursive on` faz o nginx, quando o cabeçalho é `X-Forwarded-For`, ler a lista da direita
para a esquerda pulando os proxies confiáveis, então um endereço que o cliente coloque na frente da
lista nunca é escolhido. Depois do ajuste, `X-Real-IP` e `X-Forwarded-For` que o nginx passa ao
`api` (sempre reescritos a partir de `$remote_addr`, nunca copiados do pedido) já trazem o IP da aluna.

## 6. Descobrir `REAL_IP_FROM` (fazer uma vez, no ar)

A Railway **não publica** a faixa de IPs do proxy de borda. Em vez de chutar, meça:

1. Suba o `web` com `REAL_IP_FROM` **vazio**. Abra `https://<dominio>/` e depois
   `https://<dominio>/api/health`.
2. Nos logs do `web` (Railway, aba Logs) cada acesso aparece no formato padrão do nginx, que começa
   com o endereço da conexão, por exemplo `fd12:xxxx:xxxx::5 - - [...] "GET /api/health ..."`. Esse é
   o endereço do proxy da Railway que fala com o seu nginx. Anote vários acessos, de redes
   diferentes (wi-fi e 4G), e veja se são sempre da mesma faixa.
3. Defina `REAL_IP_FROM` com a menor faixa que cobre esses endereços (um `/64` IPv6, um `/24` IPv4, ou
   o endereço único) e `REAL_IP_HEADER=X-Real-IP`. Redeploy do `web`.
4. Confirme nos logs: o primeiro campo agora é o IP público de quem acessou, não o do proxy. A
   subida também escreve `12-real-ip.sh: client address taken from X-Real-IP on connections from: ...`.

Se os endereços variarem muito, a faixa da rede privada da Railway (a mesma do DNS, `fd12::/16`)
provavelmente os cobre, mas isso é uma suposição: use só se os logs do passo 2 mostrarem endereços
dentro dela. Lembre que ambientes diferentes não se enxergam na rede privada **(doc oficial)**, e
que o `api` não tem domínio público; o `web` só deve receber conexões do proxy da Railway e dos
serviços do próprio projeto.

**Teste de falsificação (obrigatório).** A documentação diz que `X-Real-IP` identifica o IP remoto do
cliente, mas não diz se um `X-Real-IP` enviado pelo próprio cliente é sobrescrito. Confirme:

```
curl -s -H 'X-Real-IP: 198.51.100.77' https://<dominio>/api/health
```

Olhe o log do `web` para esse acesso: o endereço registrado tem que ser o **seu** IP público, não
`198.51.100.77`. Se aparecer o forjado, **não use** `X-Real-IP`: deixe `REAL_IP_FROM` vazio e abra
chamado com a Railway pedindo o cabeçalho confiável (ou ponha Cloudflare na frente, ver
`docs/SELF_HOSTING.md`, e use `CF_CONNECTING_IP`).

## 7. Verificação no ar

1. `curl -s https://<dominio>/api/health` devolve JSON em menos de 1 s. Se travar, o `RESOLVER` está
   errado (o nginx fica esperando um DNS que não responde). Se devolver 502 rápido, confira
   `RESOLVER_IPV6=on`, `BACKEND`, `PORT` do `web` e a porta de destino do domínio (8080).
2. Abra o app no navegador, crie o perfil do dono (vira admin por `FIRST_USER_ADMIN=1`), saia e entre
   de novo por senha. Confirme HTTPS e que o PWA é instalável.
3. **Depois** mude `INVITE_ONLY=1` no `api` e faça redeploy. Teste que um cadastro sem convite é
   recusado e que um convite gerado no painel funciona.

### Teste manual do limitador (IPs diferentes)

Precisa de duas redes: o computador no wi-fi e o celular no 4G, por exemplo.

1. Na rede A, tente entrar por senha **mais de 20 vezes** com nomes inventados e senhas erradas
   (o limite livre por endereço é 20). A partir daí a rede A recebe "muitas tentativas".
2. Na rede B, entre com uma conta real e a senha certa. Tem que entrar. Antes do ajuste, entraria o
   bloqueio da rede A, porque todas pareciam o mesmo endereço.
3. Separadamente, o limite por **conta** continua valendo para qualquer rede: 5 senhas erradas na
   mesma conta pausam aquela conta por 1 minuto (dobrando até 1 h). Isso é de propósito; é o que
   protege a senha.

## 8. O que foi testado localmente

Com a imagem do `web` construída de `web/Dockerfile` e um upstream falso que devolve os cabeçalhos
recebidos, em redes Docker próprias:

- Sem `REAL_IP_FROM`: o upstream recebe `X-Real-IP` e `X-Forwarded-For` iguais ao endereço da
  conexão, idêntico à imagem anterior, mesmo com `X-Forwarded-For: 203.0.113.7` forjado.
- `REAL_IP_FROM` cobrindo o cliente: com `X-Forwarded-For: 203.0.113.7` (ou `X-Real-IP`) o upstream
  recebe `203.0.113.7` nos dois. Com `X-Forwarded-For: 6.6.6.6, 203.0.113.7` recebe `203.0.113.7`.
- `REAL_IP_FROM` que não cobre o cliente: o cabeçalho forjado é ignorado.
- DNS só IPv6 (um servidor DNS de teste que responde apenas AAAA): `RESOLVER_IPV6=off` dá 502
  ("could not be resolved"), `on` dá 200.
- Ponta a ponta com o `api` real (`TRUST_PROXY=1`): 21 senhas erradas de um IP dão 429 a partir da
  22a. Sem `REAL_IP_FROM`, um segundo IP também recebe 429. Com `REAL_IP_FROM` correto, o segundo IP
  recebe 401 (senha errada, mas não bloqueado). Com `REAL_IP_FROM` que não cobre o cliente, o IP
  forjado não escapa do bloqueio.
- Valores perigosos recusados na subida: `0.0.0.0/0`, `::/0`, `*`, `10.0.0.1;x`, cabeçalho com `;`,
  `RESOLVER_IPV6=maybe`. `nginx -t` passa com `RESOLVER=[fd12::10]`, `RESOLVER_IPV6=on` e faixas IPv6.
- `api/test/web-real-ip.test.js` guarda o que dá para checar sem Docker (template, padrões da imagem
  e os dois scripts).

Não foi possível testar na própria Railway: o resolvedor real, a faixa do proxy e o comportamento do
`X-Real-IP` enviado pelo cliente dependem do ambiente, daí os passos 6 e 7.

## O que a documentação da Railway não diz

- O endereço do DNS da rede privada. Só aparece em respostas da comunidade (`fd12::10`).
- A faixa de IPs do proxy de borda. Só existe a lista de locais (POPs), sem endereços.
- O comportamento de `X-Forwarded-For` (a página de Specs and Limits não o menciona) e se um
  `X-Real-IP` vindo do cliente é substituído. Por isso o `web` usa só `X-Real-IP`, só de
  `REAL_IP_FROM`, e o teste de falsificação do passo 6 é obrigatório.
- Se o proxy de borda alcança o `web` por IPv4 ou IPv6. O nginx do `web` escuta só em IPv4
  (`listen ${NGINX_PORT}`). Se o domínio responder 502 mesmo com tudo certo, é a primeira suspeita.

Fontes: docs.railway.com/networking/private-networking e `.../how-it-works` (DNS `*.railway.internal`,
IPv6 apenas em ambientes legados, IPv4 e IPv6 nos criados depois de 16/10/2025);
docs.railway.com/networking/public-networking/specs-and-limits (cabeçalhos de requisição,
`X-Real-IP`, `X-Forwarded-Proto` sempre `https`); Railway Station, threads sobre nginx e
`railway.internal` (`resolver [fd12::10] ipv6=on valid=1s`).
