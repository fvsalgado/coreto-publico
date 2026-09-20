# Política de segurança

Esta é a política do **Coreto**, o software, e vale em todas as regiões que ele
serve. Está publicada em <https://coreto.org/seguranca>, que é para onde aponta
o campo `Policy:` do `/.well-known/security.txt` de todos os domínios: este
ficheiro vive num repositório privado, e quem segue a RFC 9116 tem de conseguir
ler o âmbito e os prazos sem pedir acesso a ninguém. **As duas cópias mudam ao
mesmo tempo** — a página está em
`apps/web/app/pagina-do-produto/seguranca/page.tsx`.

## Como reportar

**Não abras um issue público** para uma falha de segurança.

Escreve para **fabio@coreto.org** com `[segurança]` no assunto. É o contacto do
produto, e é o primeiro de propósito: quem corrige o software é quem o escreve,
e uma falha no Coreto é uma falha em todas as regiões ao mesmo tempo. Mandá-la
primeiro para o contacto de uma região é mostrá-la, dias antes de chegar a quem
a pode corrigir, a pessoal que não a pode corrigir.

O contacto da região — o que está no `security.txt` do domínio por onde
chegaste — fica como alternativa, para quem encontrou a falha numa agenda e não
tem de saber que há um produto por baixo. É a mesma ordem que
`apps/web/app/[regiao]/seguranca-txt/route.ts` já produz, e a razão está escrita
lá.

Se a falha envolver dados pessoais de alguém, diz isso na primeira linha — muda
a ordem pela qual as coisas são tratadas e os prazos que a lei impõe.

Ajuda muito incluir:

- o que se consegue fazer que não se devia conseguir;
- os passos para lá chegar, com o endereço concreto;
- a data e a hora aproximadas em que tentaste, para se poderem encontrar os
  registos;
- se chegaste a dados de alguém — e, se sim, que não ficaste com cópia.

## O que esperar

| Momento  | O que acontece                                                     |
| -------- | ------------------------------------------------------------------ |
| 72 horas | Acusamos a receção e dizemos se conseguimos reproduzir.            |
| 30 dias  | Falha confirmada corrigida, ou uma data com fundamento para o ser. |
| Depois   | Publicamos o que se passou, e o teu nome se o quiseres.            |

Este é um projeto pequeno, com poucas pessoas e sem programa de recompensas. Os
prazos acima são um compromisso honesto, não um contrato comercial.

## Âmbito

Interessa-nos, por esta ordem:

- qualquer caminho que leia ou escreva dados de submissões — endereços de email
  de quem submete, anexos, hashes de IP — sem passar pela moderação;
- qualquer forma de entrar na área de `/admin` sem a palavra-passe, ou de correr
  uma ação de moderação sem sessão;
- exposição da chave de serviço do Supabase, ou escrita em tabelas que o RLS
  devia proteger;
- injeção em SQL, em HTML ou nos feeds gerados;
- falhas no widget que permitam correr código no sítio de quem o embebeu.

**Fora de âmbito**: resultados brutos de varredores automáticos sem impacto
demonstrado; ausência de cabeçalhos que não mudam nada neste contexto; o CORS
aberto em `/api/events` e nos feeds, que é deliberado — os dados são públicos e
existem para ser reutilizados; e os contadores por evento poderem ser
inflacionados por quem insista, que é um custo conhecido da decisão de não
identificar quem visita.

## O que já está feito

Para não gastares tempo a confirmar o que já se sabe:

- **Sem contas de utilizador.** A área interna tem uma palavra-passe, guardada
  em hash scrypt com sal, e um cookie de sessão assinado com HMAC, `httpOnly` e
  `sameSite=strict`. As tentativas de entrada são limitadas por IP.
- **A chave de serviço nunca chega ao navegador.** O que vai para o cliente é a
  chave pública de leitura, e o que ela pode ler é o que o RLS deixa.
- **Todas as escritas de moderação passam por funções SQL** com auditoria. As
  funções `security definer` têm o `execute` revogado a `anon` e
  `authenticated`.
- **Endereços IP nunca são guardados em claro** — só um hash com sal, apagado ao
  fim de dois dias.
- **O webhook de email exige assinatura HMAC**; sem segredo configurado, recusa
  tudo com 503.
- **CSP restritiva**, com `frame-ancestors 'none'` em todo o lado exceto no
  widget, que existe para ser embebido. Uma exceção, e está aqui escrita por
  ser exceção: `script-src` leva `'unsafe-inline'`, porque o App Router arranca
  a hidratação com scripts inline e a alternativa canónica (nonce por pedido)
  obriga a renderização dinâmica e deitava fora o ISR. O risco aceite: um
  script inline só corre se alguém conseguir injetar HTML, e o React escapa
  tudo por omissão — o único `dangerouslySetInnerHTML` é o JSON-LD, gerado por
  nós. O raciocínio completo está em `apps/web/next.config.ts`.
- **Varrimento de segredos** em cada alteração (gitleaks, no CI, sem exceções
  silenciosas). A análise estática com CodeQL, incluindo a dos próprios
  workflows, está configurada e **só corre quando o repositório for público**
  — em repositório privado o GitHub não tem onde receber os resultados, e o
  trabalho é saltado em vez de ficar vermelho para sempre. O repositório é
  privado hoje; enquanto for, esta linha não pode dizer que o CodeQL corre.

## Divulgação

Pedimos divulgação coordenada: dá-nos a hipótese de corrigir antes de tornares
público. Em troca, mantemos-te a par e damos-te crédito no aviso, se quiseres.
