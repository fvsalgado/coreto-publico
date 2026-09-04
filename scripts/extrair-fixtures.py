#!/usr/bin/env python3
"""Reduz o que a sondagem trouxe ao mínimo que serve para calibrar um seletor.

Guardar páginas de terceiros num repositório é guardar obra de terceiros. O
plano de dados fixou a regra: o mínimo, truncado ao bloco da listagem, com a
data e o endereço de origem em cabeçalho, e sem imagens. É isso que isto faz.

O que sai não é a página: são os blocos de evento, que é o que um adaptador
precisa de ver e a única parte que tem valor como fixture.
"""

from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

# Quantos blocos chegam. Dois seriam suficientes para o caso comum; seis
# apanham também o evento com campo em falta, que é onde os adaptadores se
# partem.
MAX_BLOCOS = 6

# A etiqueta e a classe que envolvem um bloco de evento, por família de sítio.
# A classe aparece sempre no meio de outras, por isso não se ancora no início do
# atributo.
#
# `eb-event-wrapper` é o com_eventbooking, que serve dez concelhos.
# `postWidget` é o sítio próprio do Cine-Teatro Paraíso, que não é Joomla nem
# se parece com nenhum dos outros — foi escrito à medida.
# `post-item` num `article` é o tema WordPress do Centro Cultural Gil Vicente;
# a etiqueta é configurável porque nem todo o site envolve o evento numa `div`,
# e contar profundidade de `div` num `article` devolvia o resto da página.
BLOCO_POR_OMISSAO = ('div', 'eb-event-wrapper')
BLOCO_POR_FONTE = {
    'cine-teatro-paraiso': ('div', 'postWidget'),
    'ccgv-sardoal': ('article', 'post-item'),
}

# As imagens não se guardam: o `src` fica, o ficheiro não vem, e é o `src` que
# o adaptador lê.
COMENTARIO = re.compile(r'<!--.*?-->', re.DOTALL)


def blocos_de_evento(html: str, bloco: tuple[str, str] = BLOCO_POR_OMISSAO) -> list[str]:
    """Extrai cada elemento da etiqueta e classe dadas, contando a profundidade."""
    etiqueta, classe = bloco
    abertura = re.compile(rf'<{etiqueta}\b[^>]*\b{re.escape(classe)}\b[^>]*>', re.IGNORECASE)
    par = re.compile(rf'<(/?){etiqueta}\b[^>]*>', re.IGNORECASE)
    encontrados: list[str] = []

    for inicio in abertura.finditer(html):
        if len(encontrados) >= MAX_BLOCOS:
            break
        profundidade = 0
        posicao = inicio.start()
        for tag in par.finditer(html, inicio.start()):
            profundidade += -1 if tag.group(1) else 1
            if profundidade == 0:
                encontrados.append(html[posicao : tag.end()])
                break

    return encontrados


def itens_de_rss(xml: str, limite: int = 3) -> list[str]:
    return re.findall(r'<item>.*?</item>', xml, re.DOTALL)[:limite]


def cabecalho(origem: str, nota: str) -> str:
    return (
        f'<!--\n'
        f'  Fixture capturada de {origem}\n'
        f'  em {date.today().isoformat()}.\n'
        f'\n'
        f'  {nota}\n'
        f'\n'
        f'  Guardada para calibrar e testar um adaptador de recolha, ao abrigo\n'
        f'  do uso para interoperabilidade. Reduzida ao mínimo necessário: não\n'
        f'  é a página, são os blocos de evento. Nenhuma imagem foi guardada.\n'
        f'\n'
        f'  Se o site mudar, isto deixa de descrever a realidade — e é esse o\n'
        f'  ponto: o teste falha, e alguém vai ver o que mudou.\n'
        f'-->\n'
    )


def main() -> int:
    sondagem = Path(sys.argv[1] if len(sys.argv) > 1 else 'sondagem')
    destino = Path(sys.argv[2] if len(sys.argv) > 2 else 'packages/ingest/src/__fixtures__')
    destino.mkdir(parents=True, exist_ok=True)

    resumo = sondagem / 'resumo.tsv'
    if not resumo.exists():
        print(f'não há sondagem em {sondagem}', file=sys.stderr)
        return 1

    escritas = 0
    for linha in resumo.read_text(encoding='utf-8').splitlines()[1:]:
        campos = linha.split('\t')
        if len(campos) < 7:
            continue
        ident, tipo, codigo, _bytes, _ctype, _servidor, final = campos[:7]

        # Os endereços semeados vão à sondagem para provar que dão 404. Provado
        # o 404, não há nada para guardar.
        if ident.startswith('semeado-') or codigo != '200':
            continue

        corpo = sondagem / f'{ident}.body'
        if not corpo.exists():
            continue

        bruto = COMENTARIO.sub('', corpo.read_text(encoding='utf-8', errors='replace'))

        if tipo == 'html':
            bloco = BLOCO_POR_FONTE.get(ident, BLOCO_POR_OMISSAO)
            partes = blocos_de_evento(bruto, bloco)
            nota = f'{len(partes)} blocos `{bloco[0]}.{bloco[1]}`, dos primeiros da listagem.'
        elif tipo == 'rss':
            partes = itens_de_rss(bruto)
            nota = f'{len(partes)} elementos `<item>`, dos primeiros do feed.'
        else:
            # JSON: guarda-se inteiro, é pequeno e é o contrato da API.
            (destino / f'{ident}.json').write_text(bruto.strip() + '\n', encoding='utf-8')
            print(f'  {ident}.json  ({len(bruto)} bytes, inteiro)')
            escritas += 1
            continue

        if not partes:
            print(f'  {ident}: nada a guardar — nenhum bloco reconhecido')
            continue

        (destino / f'{ident}.html').write_text(
            cabecalho(final, nota) + '\n\n'.join(partes) + '\n', encoding='utf-8'
        )
        print(f'  {ident}.html  ({len(partes)} blocos)')
        escritas += 1

    print(f'\n{escritas} fixtures escritas em {destino}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
