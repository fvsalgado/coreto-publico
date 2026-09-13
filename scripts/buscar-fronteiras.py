#!/usr/bin/env python3
"""Traz as fronteiras dos concelhos e escreve-as como migração SQL.

O mapa da agenda desenha a geografia verdadeira da região. Os contornos vêm do
OpenStreetMap, pelo Nominatim, que devolve o polígono já simplificado — não é
preciso biblioteca de cartografia nem mosaicos de terceiros. Desde a migração
0105 os contornos vivem na base, na coluna `municipalities.boundary`; este
script escreve a migração que os põe lá.

**Cada polígono é confrontado com a área oficial do concelho antes de entrar.**
É a verificação que interessa: o Nominatim tanto devolve a fronteira do
concelho como, se a pergunta for ambígua, a da cidade com o mesmo nome — e a
segunda é uma fração da primeira. Sem esta conta, um mapa errado passava
despercebido, porque um contorno plausível parece sempre um contorno certo.

Correr quando for preciso refrescar os contornos, ou para uma região nova:

    python3 scripts/buscar-fronteiras.py --saida supabase/migrations/<carimbo>_<NNNN>_<frase>.sql

A lista de concelhos por omissão é a do Médio Tejo. Para outra região,
passa-se um ficheiro JSON com a mesma forma — uma lista de
`[identificador, consulta ao Nominatim, área oficial em km²]` (a área vem da
Carta Administrativa Oficial de Portugal):

    python3 scripts/buscar-fronteiras.py --concelhos docs/regioes/<regiao>/concelhos.json --saida …

A migração gerada é NOVA de cada vez — a história das migrações não se
reescreve; refrescar contornos é uma migração nova com UPDATEs novos.

Dados © contribuidores do OpenStreetMap, ODbL 1.0 — https://osm.org/copyright
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

AGENTE = 'Coreto/1.0 (+https://github.com/fvsalgado/coreto; agenda cultural)'
NOMINATIM = 'https://nominatim.openstreetmap.org/search'

# A política do Nominatim pede no máximo um pedido por segundo.
PAUSA = 1.2

# Quanto o Nominatim pode simplificar, em graus. 0,002° são cerca de 200 m —
# invisível num mapa de cinquenta quilómetros, e corta o tamanho para um
# décimo.
TOLERANCIA = 0.002

# Casas decimais guardadas. Quatro são cerca de onze metros.
CASAS = 4

# Área oficial de cada concelho, em km² (Carta Administrativa Oficial de
# Portugal). Não é decoração: é o que prova que veio a fronteira certa.
# É a lista do Médio Tejo; outra região passa a sua com --concelhos.
CONCELHOS: list[tuple[str, str, float]] = [
    ('abrantes', 'Abrantes, Santarém', 714.7),
    ('alcanena', 'Alcanena, Santarém', 127.3),
    ('constancia', 'Constância, Santarém', 80.4),
    ('entroncamento', 'Entroncamento, Santarém', 13.7),
    ('ferreira-do-zezere', 'Ferreira do Zêzere, Santarém', 190.3),
    ('macao', 'Mação, Santarém', 400.0),
    ('ourem', 'Ourém, Santarém', 416.6),
    ('sardoal', 'Sardoal, Santarém', 92.1),
    ('tomar', 'Tomar, Santarém', 351.2),
    ('torres-novas', 'Torres Novas, Santarém', 270.0),
    ('vila-nova-da-barquinha', 'Vila Nova da Barquinha, Santarém', 49.5),
]

# Quanto a área medida pode afastar-se da oficial. Dez por cento acomoda a
# simplificação e o arredondamento; uma fronteira de cidade em vez de concelho
# erra por um fator de dez ou mais e não passa daqui.
TOLERANCIA_DE_AREA = 0.10


def buscar(consulta: str) -> dict:
    parametros = urllib.parse.urlencode(
        {
            'q': consulta,
            'format': 'jsonv2',
            'polygon_geojson': '1',
            'polygon_threshold': str(TOLERANCIA),
            'limit': '1',
            'countrycodes': 'pt',
        }
    )
    pedido = urllib.request.Request(f'{NOMINATIM}?{parametros}', headers={'User-Agent': AGENTE})
    with urllib.request.urlopen(pedido, timeout=60) as resposta:
        dados = json.load(resposta)
    if not dados:
        raise SystemExit(f'sem resultado para «{consulta}»')
    return dados[0]


def anel_maior(geometria: dict) -> list[list[float]]:
    """O contorno exterior. Um concelho com ilhas fluviais tem mais do que um."""
    if geometria['type'] == 'Polygon':
        return geometria['coordinates'][0]
    return max((p[0] for p in geometria['coordinates']), key=len)


def area_km2(anel: list[list[float]]) -> float:
    """Área pela fórmula do sapateiro, com a longitude corrigida pela latitude."""
    latitude_media = sum(p[1] for p in anel) / len(anel)
    escala = math.cos(math.radians(latitude_media))
    soma = 0.0
    for i, (x1, y1) in enumerate(anel):
        x2, y2 = anel[(i + 1) % len(anel)]
        soma += (x1 * escala) * y2 - (x2 * escala) * y1
    return abs(soma) / 2 * (111.32**2)


def migracao(contornos: list[tuple[str, list[list[float]]]]) -> str:
    """A migração: um UPDATE por concelho e a rede de segurança dos anéis."""
    linhas = [
        '-- Fronteiras refrescadas do OpenStreetMap (Nominatim), geradas por',
        '-- scripts/buscar-fronteiras.py. Cada polígono foi confrontado com a',
        '-- área oficial do concelho (CAOP) antes de entrar — ver o cabeçalho',
        '-- do script para a razão de isso importar.',
        '--',
        '-- Dados © contribuidores do OpenStreetMap, ODbL 1.0',
        '-- https://osm.org/copyright',
        '',
    ]
    for identificador, anel in contornos:
        arred = [[round(p[0], CASAS), round(p[1], CASAS)] for p in anel]
        if arred[0] != arred[-1]:
            arred.append(list(arred[0]))
        js = json.dumps(arred, separators=(',', ','))
        linhas.append(
            f"update public.municipalities set boundary = '{js}'::jsonb "
            f"where id = '{identificador}';"
        )
    linhas += [
        '',
        '-- ---------------------------------------------------------------------------',
        'do $$',
        'declare',
        '  v_n integer;',
        'begin',
        '  select count(*) into v_n',
        '  from public.municipalities',
        "  where boundary is not null",
        "    and (jsonb_typeof(boundary) <> 'array' or jsonb_array_length(boundary) < 4",
        '      or boundary -> 0 is distinct from boundary -> (jsonb_array_length(boundary) - 1));',
        '  if v_n <> 0 then',
        "    raise exception '% fronteiras que não são um anel fechado', v_n;",
        '  end if;',
        'end $$;',
        '',
    ]
    return '\n'.join(linhas)


def main() -> int:
    analisador = argparse.ArgumentParser(description=__doc__)
    analisador.add_argument(
        '--concelhos',
        type=Path,
        help='JSON com a lista [identificador, consulta, área oficial km²]; por omissão, o Médio Tejo',
    )
    analisador.add_argument(
        '--saida',
        type=Path,
        required=True,
        help='o ficheiro de migração a escrever (supabase/migrations/<carimbo>_<NNNN>_<frase>.sql)',
    )
    argumentos = analisador.parse_args()

    concelhos = CONCELHOS
    if argumentos.concelhos:
        concelhos = [tuple(linha) for linha in json.loads(argumentos.concelhos.read_text())]

    contornos: list[tuple[str, list[list[float]]]] = []

    for identificador, consulta, oficial in concelhos:
        registo = buscar(consulta)
        anel = anel_maior(registo['geojson'])
        medida = area_km2(anel)
        desvio = abs(medida - oficial) / oficial

        estado = 'ok' if desvio <= TOLERANCIA_DE_AREA else 'RECUSADO'
        print(
            f'  {identificador:<24} {medida:>6.0f} km² '
            f'(oficial {oficial:>6.1f}, desvio {desvio:>5.1%})  {estado}'
        )
        if desvio > TOLERANCIA_DE_AREA:
            print(
                f'    o Nominatim devolveu «{registo["display_name"]}», que não é o concelho',
                file=sys.stderr,
            )
            return 1

        contornos.append((identificador, anel))
        time.sleep(PAUSA)

    argumentos.saida.write_text(migracao(contornos), encoding='utf-8')
    total = sum(len(anel) for _, anel in contornos)
    print(f'\n{argumentos.saida} — {len(contornos)} concelhos, {total} pontos')
    print('A migração é nova: aplica-se com as outras, nunca editando as já aplicadas.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
