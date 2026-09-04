#!/usr/bin/env bash
# Concilia o registo de migrações com os ficheiros de `supabase/migrations/`.
#
# O registo (`supabase_migrations.schema_migrations`) é a lista do que já
# correu: é por ele que `aplicar-migracoes.sh` e o CLI do Supabase decidem o
# que falta. Só serve se disser a verdade — e em produção deixou de a dizer,
# de quatro maneiras, todas por migrações aplicadas pela API do Supabase e não
# por este repositório: o carimbo de tempo ficou o da hora a que correu, e não
# o do nome do ficheiro; sete linhas ficaram sem o número («minde_entra_pela_
# porta_certa» em vez de «0056_…»); cinco ficaram com o nome do ficheiro
# inteiro, carimbo incluído; e dezanove migrações correram sem deixar linha.
# Um registo assim faz `aplicar-migracoes.sh` reaplicar o que já lá está, que
# é o pior resultado possível para um script cujo trabalho é não repetir nada.
#
# A identidade de uma migração é a etiqueta («0056_minde_entra_pela_porta_
# certa») e o carimbo é o do ficheiro. Este script casa cada linha do registo
# com o seu ficheiro — pela etiqueta; pela etiqueta sem o carimbo à frente;
# pelo texto sem o número; ou pelo mesmo texto com outro número, que é uma
# migração renumerada depois de aplicada — e diz o que está torto. Com
# `--escrever`, endireita: cada linha fica com o carimbo e a etiqueta do seu
# ficheiro, e uma linha a mais para o mesmo ficheiro sai.
#
# O que nunca faz sozinho: apagar uma linha que não é de ficheiro nenhum (o
# relatório traz o `delete`, para quem souber o que ela foi), e inventar
# linhas para ficheiros que não têm nenhuma — «sem linha» tanto é «por
# aplicar» como «aplicada sem registo», e só quem conhece a base sabe qual.
# `--aplicadas-ate 0118` é essa pessoa a dizê-lo: até esse número, os
# ficheiros sem linha ganham uma.
#
# Uso:
#   DATABASE_URL='postgresql://…' ./scripts/conciliar-registo.sh
#       O relatório. Sai com 1 se houver o que endireitar.
#   DATABASE_URL='postgresql://…' ./scripts/conciliar-registo.sh --escrever [--aplicadas-ate NNNN]
#       Endireita, numa transação só, e mostra o que fez.
#   ./scripts/conciliar-registo.sh --sql [--escrever] [--aplicadas-ate NNNN]
#       Só imprime o SQL, para correr onde não há `psql` — o editor do painel
#       do Supabase, a API. O relatório sai como resultado da última consulta.
#
# Nunca toca no esquema: só na tabela do registo. Correr isto sobre a base de
# produção é correr sobre uma lista.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

escrever=false
so_sql=false
ate=''
while [ $# -gt 0 ]; do
  case "$1" in
    --escrever) escrever=true ;;
    --sql) so_sql=true ;;
    --aplicadas-ate)
      ate="${2:-}"
      shift
      ;;
    *)
      echo "Argumento desconhecido: $1. Ver o cabeçalho de $0." >&2
      exit 2
      ;;
  esac
  shift
done

if [ -n "$ate" ] && ! [[ "$ate" =~ ^[0-9]{4}$ ]]; then
  echo "--aplicadas-ate espera o número de uma migração, com quatro algarismos (ex.: 0118)." >&2
  exit 2
fi

if [ "$so_sql" = false ] && [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL (ou --sql, para só imprimir o SQL). Ver o cabeçalho de $0." >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Os ficheiros, como uma lista de valores SQL: carimbo e etiqueta.
#
# `20260829150000_0056_minde_entra_pela_porta_certa.sql` dá o carimbo
# `20260829150000` e a etiqueta `0056_minde_entra_pela_porta_certa`. Um nome
# fora deste padrão pára aqui: é mais barato do que casá-lo mal.
# ---------------------------------------------------------------------------
valores=''
for file in "$ROOT"/supabase/migrations/*.sql; do
  nome="$(basename "$file" .sql)"
  versao="${nome%%_*}"
  etiqueta="${nome#*_}"
  if ! [[ "$versao" =~ ^[0-9]{14}$ && "$etiqueta" =~ ^[0-9]{4}_[a-z0-9_]+$ ]]; then
    echo "✗ nome de migração fora do padrão AAAAMMDDHHMMSS_NNNN_descricao.sql: $nome.sql" >&2
    exit 2
  fi
  valores+="  ('${versao}', '${etiqueta}'),"$'\n'
done
valores="${valores%,$'\n'}"

if [ -n "$ate" ]; then
  ate_sql="'${ate}'"
else
  ate_sql='null'
fi

sql=$(cat <<SQL
-- Gerado por scripts/conciliar-registo.sh. Só toca no registo de migrações;
-- o esquema fica como está.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);

drop table if exists conciliacao_ficheiros;
drop table if exists conciliacao_mapa;
drop table if exists conciliacao_relatorio;
drop table if exists conciliacao_adiadas;

create temp table conciliacao_ficheiros (
  versao   text primary key,
  etiqueta text not null unique,
  numero   text not null,
  texto    text not null
);

insert into conciliacao_ficheiros (versao, etiqueta, numero, texto)
select v, e, substr(e, 1, 4), substr(e, 6)
from (values
${valores}
) as f (v, e);

-- Cada linha do registo e o ficheiro que lhe corresponde, se houver.
create temp table conciliacao_mapa (
  version          text primary key,
  name             text,
  ficheiro_versao  text,
  ficheiro_etiqueta text,
  caso             text not null
);

create temp table conciliacao_relatorio (
  ordem    serial primary key,
  caso     text not null,
  versao   text,
  nome     text,
  ficheiro text,
  acao     text not null
);

-- As que esperam por uma segunda passagem: o carimbo que lhes cabe está, por
-- agora, na linha de outra migração — que só o larga quando chegar a sua vez.
create temp table conciliacao_adiadas (
  ficheiro_versao  text primary key,
  ficheiro_etiqueta text not null,
  linha_version    text not null,
  linha_name       text,
  caso             text not null
);

do \$\$
declare
  escrever      constant boolean := ${escrever};
  aplicadas_ate constant text := ${ate_sql};
  r         record;
  f         record;
  guarda    record;
  n         integer;
  problemas integer := 0;
  ficheiros integer;
  linhas    integer;
begin
  -- 1. Casar cada linha do registo com um ficheiro.
  for r in select version, name from supabase_migrations.schema_migrations loop
    -- A etiqueta tal e qual: o caso certo, ou só com o carimbo trocado.
    select * into f from conciliacao_ficheiros where etiqueta = r.name;
    if found then
      insert into conciliacao_mapa values (r.version, r.name, f.versao, f.etiqueta,
        case when f.versao = r.version then 'certa' else 'carimbo diferente' end);
      continue;
    end if;

    -- O nome do ficheiro inteiro, com o carimbo à frente.
    if r.name ~ '^[0-9]{14}_' then
      select * into f from conciliacao_ficheiros where etiqueta = substr(r.name, 16);
      if found then
        insert into conciliacao_mapa values (r.version, r.name, f.versao, f.etiqueta, 'nome com carimbo');
        continue;
      end if;
    end if;

    -- O texto sem o número; e o mesmo texto com outro número (renumerada).
    if r.name !~ '^[0-9]{4}_' then
      select count(*) into n from conciliacao_ficheiros where texto = r.name;
      if n = 1 then
        select * into f from conciliacao_ficheiros where texto = r.name;
        insert into conciliacao_mapa values (r.version, r.name, f.versao, f.etiqueta, 'nome sem número');
        continue;
      elsif n > 1 then
        insert into conciliacao_mapa values (r.version, r.name, null, null, 'ambígua');
        continue;
      end if;
    else
      select count(*) into n from conciliacao_ficheiros where texto = substr(r.name, 6);
      if n = 1 then
        select * into f from conciliacao_ficheiros where texto = substr(r.name, 6);
        insert into conciliacao_mapa values (r.version, r.name, f.versao, f.etiqueta, 'renumerada');
        continue;
      elsif n > 1 then
        insert into conciliacao_mapa values (r.version, r.name, null, null, 'ambígua');
        continue;
      end if;
    end if;

    insert into conciliacao_mapa values (r.version, r.name, null, null, 'órfã');
  end loop;

  -- 2. Ficheiro a ficheiro: uma linha só, com o carimbo e a etiqueta certos.
  for f in select * from conciliacao_ficheiros order by versao loop
    select count(*) into n from conciliacao_mapa where ficheiro_versao = f.versao;

    if n = 0 then
      if aplicadas_ate is not null and f.numero <= aplicadas_ate then
        problemas := problemas + 1;
        if escrever then
          insert into supabase_migrations.schema_migrations (version, name)
          values (f.versao, f.etiqueta);
          insert into conciliacao_relatorio (caso, ficheiro, acao)
          values ('sem linha', f.etiqueta, 'linha escrita');
        else
          insert into conciliacao_relatorio (caso, ficheiro, acao)
          values ('sem linha', f.etiqueta, 'linha a escrever (--escrever)');
        end if;
      else
        insert into conciliacao_relatorio (caso, ficheiro, acao)
        values ('sem linha', f.etiqueta,
                'por aplicar, ou aplicada sem registo — --aplicadas-ate NNNN decide');
      end if;
      continue;
    end if;

    -- A linha que fica: a que já tem o carimbo do ficheiro, senão a mais antiga.
    select m.* into guarda
    from conciliacao_mapa m
    where m.ficheiro_versao = f.versao
    order by (m.version = f.versao) desc, m.version
    limit 1;

    for r in
      select * from conciliacao_mapa
      where ficheiro_versao = f.versao and version <> guarda.version
      order by version
    loop
      problemas := problemas + 1;
      if escrever then
        delete from supabase_migrations.schema_migrations where version = r.version;
        insert into conciliacao_relatorio (caso, versao, nome, ficheiro, acao)
        values ('repetida', r.version, r.name, f.etiqueta, 'linha a mais para o mesmo ficheiro — apagada');
      else
        insert into conciliacao_relatorio (caso, versao, nome, ficheiro, acao)
        values ('repetida', r.version, r.name, f.etiqueta, 'linha a mais para o mesmo ficheiro — a apagar');
      end if;
    end loop;

    if guarda.caso <> 'certa' then
      problemas := problemas + 1;
      if guarda.version <> f.versao
         and exists (select 1 from supabase_migrations.schema_migrations where version = f.versao) then
        -- Aconteceu em produção: a API carimbou a 0062 com a hora exacta que
        -- o ficheiro da 0055 tem no nome. A linha da 0062 larga o carimbo
        -- quando chegar a vez dela; a 0055 espera por isso.
        insert into conciliacao_adiadas values (f.versao, f.etiqueta, guarda.version, guarda.name, guarda.caso);
      elsif escrever then
        update supabase_migrations.schema_migrations
           set version = f.versao, name = f.etiqueta
         where version = guarda.version;
        insert into conciliacao_relatorio (caso, versao, nome, ficheiro, acao)
        values (guarda.caso, guarda.version, guarda.name, f.etiqueta,
                'fica ' || f.versao || ' ' || f.etiqueta || ' — escrito');
      else
        insert into conciliacao_relatorio (caso, versao, nome, ficheiro, acao)
        values (guarda.caso, guarda.version, guarda.name, f.etiqueta,
                'fica ' || f.versao || ' ' || f.etiqueta || ' (--escrever)');
      end if;
    end if;
  end loop;

  -- 3. A segunda passagem: o que ficou à espera de um carimbo ocupado.
  for r in select * from conciliacao_adiadas order by ficheiro_versao loop
    if exists (select 1 from supabase_migrations.schema_migrations where version = r.ficheiro_versao) then
      insert into conciliacao_relatorio (caso, versao, nome, ficheiro, acao)
      values ('colisão', r.linha_version, r.linha_name, r.ficheiro_etiqueta,
              'outra linha tem o carimbo ' || r.ficheiro_versao || ' e não o larga — resolver à mão');
    elsif escrever then
      update supabase_migrations.schema_migrations
         set version = r.ficheiro_versao, name = r.ficheiro_etiqueta
       where version = r.linha_version;
      insert into conciliacao_relatorio (caso, versao, nome, ficheiro, acao)
      values (r.caso, r.linha_version, r.linha_name, r.ficheiro_etiqueta,
              'fica ' || r.ficheiro_versao || ' ' || r.ficheiro_etiqueta || ' — escrito na segunda passagem');
    else
      insert into conciliacao_relatorio (caso, versao, nome, ficheiro, acao)
      values (r.caso, r.linha_version, r.linha_name, r.ficheiro_etiqueta,
              'fica ' || r.ficheiro_versao || ' ' || r.ficheiro_etiqueta || ' (--escrever, numa segunda passagem)');
    end if;
  end loop;

  -- 4. O que não é de ficheiro nenhum fica como está, e diz-se.
  for r in select * from conciliacao_mapa where caso in ('órfã', 'ambígua') order by version loop
    problemas := problemas + 1;
    insert into conciliacao_relatorio (caso, versao, nome, acao)
    values (r.caso, r.version, r.name,
            'não é de ficheiro nenhum; se for lixo: delete from supabase_migrations.schema_migrations where version = '''
            || r.version || ''';');
  end loop;

  select count(*) into ficheiros from conciliacao_ficheiros;
  select count(*) into linhas from supabase_migrations.schema_migrations;
  insert into conciliacao_relatorio (caso, acao)
  values ('resumo', format('%s ficheiros · %s linhas no registo · %s por endireitar%s',
                           ficheiros, linhas, problemas,
                           case when escrever then ' (antes de escrever)' else '' end));
end
\$\$;

select caso, versao, nome, ficheiro, acao from conciliacao_relatorio order by ordem;
SQL
)

if [ "$so_sql" = true ]; then
  printf '%s\n' "$sql"
  exit 0
fi

saida="$(printf '%s\n' "$sql" | PGOPTIONS='--client-min-messages=warning' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -q --pset footer=off)"
printf '%s\n' "$saida"

# O relatório termina no resumo; o número «por endireitar» é o que decide a
# saída. Depois de escrever, o que havia já não há: sai a zero.
por_endireitar="$(printf '%s\n' "$saida" | sed -n 's/.* \([0-9][0-9]*\) por endireitar.*/\1/p' | tail -1)"
if [ "$escrever" = false ] && [ "${por_endireitar:-0}" != "0" ]; then
  echo >&2
  echo "✗ ${por_endireitar} coisa(s) por endireitar no registo. Com --escrever, endireita-se." >&2
  exit 1
fi
