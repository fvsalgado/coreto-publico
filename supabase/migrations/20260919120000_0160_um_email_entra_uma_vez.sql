-- 0160 — Um email entra uma vez.
--
-- O webhook do canal de email assina o corpo com HMAC, e um corpo assinado
-- continua assinado para sempre: quem o capturar pode voltar a entregá-lo, e
-- até 19 de setembro de 2026 cada entrega abria uma submissão nova, gastava
-- uma leitura automática e uma linha da quota do remetente. A rota passa a
-- perguntar, antes de criar, se já há uma submissão com o mesmo `messageId`
-- (`raw_headers->>'messageId'`, que o formato do webhook já trazia).
--
-- Este índice é o que faz dessa pergunta uma leitura de índice e não um
-- varrimento da fila. **Não é único, e é de propósito**: a fila de produção
-- pode ter repetições anteriores a hoje, e um índice único que reprovasse ao
-- ser criado — ou uma migração que apagasse submissões para o conseguir criar
-- — era pior do que a repetição que se quer evitar. A unicidade é da rota; o
-- índice é da velocidade.
create index if not exists submissions_email_message_id_idx
  on public.submissions ((raw_headers->>'messageId'))
  where channel = 'email' and raw_headers->>'messageId' is not null;
