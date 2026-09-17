-- 0159 — Uma fonte pode estar parada de propósito.
--
-- A `sources` sabia dizer duas coisas sobre uma fonte que não traz eventos:
-- que está **ligada e avariada** (`is_enabled = true`, e a saúde cai para
-- `atrasada` ou `parada`), ou que está **desligada** (`is_enabled = false`, e
-- sai da vigilância como se não existisse). Falta a que descreve o que se
-- passa hoje no Médio Tejo, e que não é nenhuma das duas.
--
-- ---------------------------------------------------------------------------
-- O caso que não cabia em nenhuma das duas
-- ---------------------------------------------------------------------------
--
-- A 17 de setembro de 2026, `mediotejo.coreto.org/estado.json` dizia:
--
--     grau:   mau
--     resumo: «Há uma fonte sem ser lida com sucesso há mais de uma semana.»
--
-- E dizia-o com razão, pela régua que tinha. Só que as oito câmaras caladas
-- estão **bloqueadas pela máquina da CIM** — ECONNRESET em sete,
-- UND_ERR_CONNECT_TIMEOUT no Mação, «REJECT e DROP, duas regras e não uma
-- avaria» — e a casa decidiu, por escrito, **parar de lhes bater**: «nem um
-- pedido desde 14 de setembro, nem um antes de 21, nem para verificar»,
-- enquanto a carta não sai. O Teatro Virgínia é a segunda carta, ao Cineclube
-- de Torres Novas.
--
-- Nada disto é uma avaria por atender. É uma decisão, com data, à espera de
-- resposta de terceiros. E, pela régua velha, ia pôr o painel vermelho de seis
-- em seis horas até pelo menos 21 de setembro — que é precisamente o que os
-- comentários desta casa mandam não fazer, em três sítios diferentes: «um
-- alarme que toca sempre por uma razão que não é a sua é o alarme que se
-- aprende a ignorar».
--
-- ---------------------------------------------------------------------------
-- Porque é que `is_enabled = false` não servia
-- ---------------------------------------------------------------------------
--
-- Desligar as oito calava o alarme — e perdia-as. O comentário da
-- `avaliarRecolha` diz o que uma fonte desligada significa: «o portal fechou,
-- o município pediu, a câmara passou a publicar noutro sítio». É uma decisão
-- **sem data de fim**, e uma fonte assim sai da vigilância para sempre. As
-- oito têm de voltar, e o que garante que voltam não pode ser a memória de
-- alguém.
--
-- A diferença entre as duas colunas é essa, e é toda:
--
--     is_enabled = false    desligada, sem data. Ninguém a espera.
--     pausada_ate = <data>  calada até àquele dia, e nesse dia volta a gritar.
--
-- ---------------------------------------------------------------------------
-- A pausa tem de acabar, e é isso que a torna segura
-- ---------------------------------------------------------------------------
--
-- Uma pausa sem fim é um alarme apagado com outro nome. Por isso:
--
--   * `pausada_ate` é um instante, nunca um booleano. Não há «pausada» sem
--     saber até quando.
--   * `pausa_motivo` é obrigatório enquanto houver pausa — o CHECK recusa uma
--     sem ele. Quem cala um alarme escreve porquê, e quem vier a seguir lê a
--     razão em vez de a adivinhar.
--   * **Quando a data passa, não acontece nada** — e é de propósito. A fonte
--     volta a ser avaliada pela régua normal e o alarme regressa sozinho, sem
--     ninguém ter de o rearmar. Uma pausa esquecida acaba; um alarme desligado
--     à mão não se liga sozinho.
--
-- O `circuit_open_until` que já existe nesta tabela parece-se com isto e não
-- é: ele é automático, aberto por falhas seguidas, e serve para **não gastar**
-- a janela de recolha num sítio em baixo. Não cala veredito nenhum — uma fonte
-- com o disjuntor aberto continua a contar como parada, e deve. Este é o
-- contrário: declarado por uma pessoa, não muda o que se tenta ler, e muda só
-- o que se diz a quem lê o painel.

alter table public.sources
  add column if not exists pausada_ate  timestamptz,
  add column if not exists pausa_motivo text;

comment on column public.sources.pausada_ate is
  'Até quando esta fonte está calada por decisão, e não por avaria. Passada a '
  'data, volta a ser avaliada pela régua normal sem ninguém a rearmar. Não '
  'impede a recolha de a tentar — só impede que ela ponha o painel vermelho.';

comment on column public.sources.pausa_motivo is
  'Porque é que está em pausa. Obrigatório enquanto a pausa durar: quem cala '
  'um alarme escreve a razão.';

-- Uma pausa sem motivo é uma pausa que ninguém sabe rever. `not valid` não
-- serve aqui — não há linhas por corrigir, a coluna nasce agora.
alter table public.sources
  drop constraint if exists sources_pausa_tem_motivo;

alter table public.sources
  add constraint sources_pausa_tem_motivo
  check (
    pausada_ate is null
    or (pausa_motivo is not null and length(btrim(pausa_motivo)) > 0)
  );

-- As duas colunas são públicas, como o `last_run_at` (0128) e o `adapter`
-- (0139), e pela mesma razão: a página `/estado` e o `estado.json` servem-se
-- da chave anónima, e uma coluna por conceder não vem a `null` — faz o
-- PostgREST recusar o pedido inteiro. O `fields.test.ts` compara esta linha
-- com o `PUBLIC_SOURCE_FIELDS` e falha em CI se as duas divergirem.
--
-- E são públicas por mérito próprio, não por arrasto: a pausa é informação que
-- quem lê a página **precisa** de ter. Uma agenda que diz «em pausa até 21 de
-- setembro, à espera de resposta da CIM» é honesta; a mesma agenda a esconder
-- a pausa e a dizer «tudo bem» é a mentira que esta migração existe para
-- evitar.
grant select (pausada_ate) on public.sources to anon, authenticated;
grant select (pausa_motivo) on public.sources to anon, authenticated;
