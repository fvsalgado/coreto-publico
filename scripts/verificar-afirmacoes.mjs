/**
 * Confronta cada afirmação pública com a rota, o campo ou o cabeçalho que a
 * sustenta — e falha nomeando ficheiro e linha.
 *
 * É o irmão do `verificar-numeros.mjs`. Aquele guarda os números escritos à
 * mão, que envelhecem; este guarda as frases, que envelhecem da mesma maneira
 * e fazem pior estrago. Já aconteceu duas vezes neste repositório: o
 * `llms.txt` jurava que a API não devolve passado, e ela devolvia dezasseis
 * eventos passados; o `OPERACAO.md` continuou a dizer, a negrito, que a cópia
 * de segurança «nunca correu» três dias depois de ela correr — o documento que
 * se lê às pressas no pior dia a mandar a segunda pessoa não procurar o que
 * existe.
 *
 *   node scripts/verificar-afirmacoes.mjs
 *
 * A promessa que aqui se guarda é uma só: **nenhuma frase servida em
 * coreto.org, mediotejo.coreto.org ou demo.coreto.org afirma o que a produção
 * desmente.** Uma frase falsa desconta as verdadeiras que estão ao lado, e são
 * as verdadeiras que sustentam o preço.
 *
 * ## Duas famílias, e a distinção é o que permite isto correr no CI
 *
 * **No repositório** — uma frase que não pode existir num ficheiro, uma
 * contagem cravada, uma palavra proibida, um par de ficheiros que têm de mudar
 * ao mesmo tempo. Correm sempre, sem rede e sem um único segredo, que é a
 * condição escrita em `docs/ARQUITETURA.md` («Degradação graciosa») e a razão
 * de este guião caber no trabalho `Qualidade` do CI.
 *
 * **Nas rotas** — um cabeçalho servido, um total da API, um código de estado.
 * Só correm com `AFIRMACOES_BASE` configurada, e saltam com nota quando não
 * está. Um guião que precisasse de rede para passar deixava de passar num
 * fork, e um trabalho que não passa num fork é um trabalho que se aprende a
 * ignorar.
 *
 *   AFIRMACOES_BASE=producao                 as três origens a sério, por HTTPS
 *   AFIRMACOES_BASE=http://127.0.0.1:3000    o sítio local, com o cabeçalho Host
 *
 * ## Três estados, e nenhum deles é «mais ou menos»
 *
 *   ✓  a afirmação e a medição concordam
 *   ✗  divergem — falha, com ficheiro, linha, o que se esperava e o que lá está
 *   !  registada: a afirmação ainda não é verdade e sabe-se porquê, com data
 *
 * O `!` não é uma tolerância aberta. Cada entrada de `PENDENTES` tem uma data e
 * uma razão, e o guião avisa quando uma delas deixa de acertar — que é o dia
 * de a apagar. Uma exceção sem prazo vira mobília.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- o relato --

let passadas = 0;
let falhas = 0;
let registadas = 0;
let saltadas = 0;
const avisos = [];

/**
 * Uma afirmação e a medição que a confirma.
 *
 * A mensagem de falha traz ficheiro, linha, o que se esperava, o que lá está e
 * a razão de a asserção existir. Uma falha que obriga a procurar é uma falha
 * que se ignora — e uma falha sem o porquê ao lado é uma falha que alguém
 * apaga em vez de corrigir.
 */
function afirmar({ afirmacao, onde, porque, ok, esperava, encontrei }) {
  if (ok) {
    passadas += 1;
    console.log(`✓ ${afirmacao}`);
    return true;
  }
  falhas += 1;
  console.error(`✗ ${afirmacao}`);
  console.error(`    onde       ${onde}`);
  console.error(`    esperava   ${esperava}`);
  console.error(`    encontrei  ${encontrei}`);
  console.error(`    porquê     ${porque}`);
  return false;
}

/** A afirmação ainda não é verdade, sabe-se porquê, e não é isto que a corrige. */
function registar({ afirmacao, onde, porque }) {
  registadas += 1;
  console.log(`! ${afirmacao}`);
  console.log(`    onde       ${onde}`);
  console.log(`    por ligar  ${porque}`);
}

/** Sem rede configurada não se mede — e não se finge que se mediu. */
function saltar(afirmacao, motivo) {
  saltadas += 1;
  console.log(`· ${afirmacao} — ${motivo}`);
}

// -------------------------------------------------------- ler o repositório --

function ler(relativo) {
  return readFileSync(join(RAIZ, relativo), 'utf8');
}

/**
 * As linhas (a contar de 1) em que o padrão acerta.
 *
 * Linha a linha e não sobre o texto inteiro, porque o que interessa devolver é
 * o número da linha: é ele que faz a diferença entre corrigir e procurar.
 */
function linhasCom(texto, padrao) {
  const re = new RegExp(padrao.source, padrao.flags.replace('g', ''));
  const encontradas = [];
  texto.split('\n').forEach((linha, i) => {
    if (re.test(linha)) encontradas.push({ numero: i + 1, texto: linha.trim() });
  });
  return encontradas;
}

/**
 * Apaga os comentários sem apagar as linhas.
 *
 * Os comentários desta casa citam de propósito as frases que foram corrigidas
 * — é assim que a cicatriz fica escrita ao lado da decisão. Um guião que lesse
 * o ficheiro inteiro apanhava a citação e mandava apagar exatamente o que se
 * quer manter. Os caracteres vão para espaço em vez de desaparecerem para os
 * números de linha continuarem a bater certo.
 */
function semComentarios(texto) {
  const branco = (m) => m.replace(/[^\n]/g, ' ');
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, branco)
    .split('\n')
    .map((linha) =>
      linha.replace(/(^|[^:'"`\\])\/\/.*$/, (m, antes) => antes + branco(m.slice(antes.length))),
    )
    .join('\n');
}

/** O sítio de onde uma frase é emitida, para a nomear numa falha de rota. */
function origem(ficheiro, padrao) {
  const achadas = linhasCom(ler(ficheiro), padrao);
  return achadas.length ? `${ficheiro}:${achadas[0].numero}` : ficheiro;
}

/** Nenhuma linha do ficheiro pode acertar no padrão. */
function ausente(ficheiro, padrao, { afirmacao, porque, tolerar = () => false, prosa = false }) {
  const texto = prosa ? semComentarios(ler(ficheiro)) : ler(ficheiro);
  const achadas = linhasCom(texto, padrao).filter((linha) => !tolerar(linha));
  return afirmar({
    afirmacao,
    porque,
    onde: achadas.length ? `${ficheiro}:${achadas[0].numero}` : ficheiro,
    ok: achadas.length === 0,
    esperava: `nenhuma linha de ${ficheiro} com ${padrao}`,
    encontrei: achadas.map((l) => `${ficheiro}:${l.numero}  ${l.texto}`).join('\n               '),
  });
}

/** O ficheiro tem de continuar a dizer isto — guarda contra apagar em vez de corrigir. */
function presente(ficheiro, padrao, { afirmacao, porque }) {
  const achadas = linhasCom(ler(ficheiro), padrao);
  return afirmar({
    afirmacao,
    porque,
    onde: achadas.length ? `${ficheiro}:${achadas[0].numero}` : ficheiro,
    ok: achadas.length > 0,
    esperava: `pelo menos uma linha de ${ficheiro} com ${padrao}`,
    encontrei: 'nenhuma',
  });
}

// ----------------------------------------------------------- as pendências --

/**
 * O que ainda não é verdade, com data e com dono.
 *
 * Não é uma lista de perdão: é o que separa «ninguém reparou» de «reparou-se,
 * está medido, e a correção tem vaga». Cada entrada é apagada por quem a
 * corrigir — e o guião avisa quando uma delas já não acerta em nada, para não
 * ficar aqui a proteger o que já não existe.
 */
const PENDENTES = [
  {
    chave: 'glossario:apps/web/app/[regiao]/acessibilidade/page.tsx:gaveta',
    desde: '2026-09-07',
    porque:
      'a declaração exigida pelo DL 83/2018 descreve «a gaveta de navegação»; é jargão interno num documento lido por quem fiscaliza',
  },
  {
    chave: 'glossario:apps/web/app/[regiao]/page.tsx:montra',
    desde: '2026-09-07',
    porque: '«Todos na mesma montra» na entrada de uma região: montra é a página do produto',
  },
  {
    chave: 'glossario:apps/web/src/components/PaginaDaMontra.tsx:disjuntor',
    desde: '2026-09-07',
    porque:
      'a ficha do produto diz «disjuntor por fonte» a quem decide; em texto público é «a pausa automática de uma fonte»',
  },
];

const pendentesUsadas = new Set();

function ehPendente(chave) {
  const entrada = PENDENTES.find((p) => p.chave === chave);
  if (entrada) pendentesUsadas.add(chave);
  return entrada;
}

// -------------------------------------------------- o texto que se vê mesmo --

/**
 * Os ficheiros que servem texto público.
 *
 * O painel fica de fora: `apps/web/app/admin` está atrás de sessão e fala para
 * dentro, e o glossário interno existe precisamente para se usar aí. Uma regra
 * que proibisse «disjuntor» na página de fontes do painel era uma regra que
 * ninguém cumpria.
 */
function ficheirosPublicos() {
  const encontrados = [];
  const andar = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name !== 'admin' && entrada.name !== 'node_modules') andar(caminho);
      } else if (/\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
        encontrados.push(relative(RAIZ, caminho));
      }
    }
  };
  andar(join(RAIZ, 'apps', 'web', 'app'));
  andar(join(RAIZ, 'apps', 'web', 'src', 'components'));
  return encontrados;
}

/**
 * Um fragmento é prosa, ou é código com ar de prosa.
 *
 * A regra de corte é o `=`: uma frase servida não tem sinais de igual, e um
 * pedaço de JSX apanhado entre um `=>` e um `<` tem sempre. Sem isto, um
 * `const toldo = CORES[...]` num ficheiro `.tsx` contava como texto visível — e
 * o guião mandava renomear uma variável em vez de corrigir uma frase.
 */
function ehProsa(fragmento) {
  const texto = fragmento.trim();
  if (!/\s/.test(texto)) return false;
  if (texto.includes('=')) return false;
  if (!/[A-Za-zÀ-ÿ]{3}/.test(texto)) return false;
  // Uma lista de classes do Tailwind — «mt-2 text-sm text-muted» — é toda ela
  // minúsculas sem acentos e sem pontuação. Prosa portuguesa não é.
  if (texto.split(/\s+/).every((ficha) => /^[a-z0-9:[\]\-./%()#!]+$/.test(ficha))) return false;
  return true;
}

/** Os pedaços de um ficheiro que uma pessoa chega a ler: texto de JSX e literais. */
function* prosaDe(fonte) {
  const padroes = [
    /[>}]([^<>{}]+)[<{]/g,
    /'([^'\\\n]*(?:\\.[^'\\\n]*)*)'/g,
    /"([^"\\\n]*(?:\\.[^"\\\n]*)*)"/g,
    /`([^`\\]*(?:\\.[^`\\]*)*)`/g,
  ];
  for (const padrao of padroes) {
    for (const achado of fonte.matchAll(padrao)) {
      if (!ehProsa(achado[1])) continue;
      yield { linha: fonte.slice(0, achado.index).split('\n').length, texto: achado[1] };
    }
  }
}

/**
 * Uma palavra inteira, e não um pedaço de identificador.
 *
 * O `ct-goteira` é um nome de classe, o `data-paleta="montra"` é um atributo e
 * o `./montra` é um caminho de módulo: nenhum deles é texto que alguém leia. O
 * que os separa de uma palavra escrita numa frase é o que vem imediatamente
 * antes e depois.
 */
function palavraInteira(termo) {
  return new RegExp(`(?<![\\p{L}\\p{N}_"'\`\\-/])${termo}(?![\\p{L}\\p{N}_\\-])`, 'iu');
}

/** O glossário interno de `docs/NARRATIVA.md` §9 — nunca em texto público. */
const GLOSSARIO_INTERNO = [
  'montra',
  'toldo',
  'lambrequim',
  'goteira',
  'sobrancelha',
  'gaveta',
  'disjuntor',
  'impressão digital',
  'multi-inquilino',
  'deriva de layout',
];

/** As palavras proibidas de `docs/NARRATIVA.md` §7. */
const PALAVRAS_PROIBIDAS = [
  'solução',
  'soluções',
  'plataforma inovadora',
  'ecossistema',
  'potenciar',
  'alavancar',
  'disruptivo',
  'experiência do utilizador',
  'stakeholder',
  'engagement',
  'one-stop-shop',
];

function varrerDicionario(termos, { afirmacao, porque, prefixoDaChave }) {
  const achados = [];
  for (const ficheiro of ficheirosPublicos()) {
    const fonte = semComentarios(ler(ficheiro));
    for (const { linha, texto } of prosaDe(fonte)) {
      for (const termo of termos) {
        if (!palavraInteira(termo).test(texto)) continue;
        const pendente = ehPendente(`${prefixoDaChave}:${ficheiro}:${termo}`);
        if (pendente) continue;
        achados.push(`${ficheiro}:${linha}  «${termo}» em «${texto.trim().slice(0, 70)}…»`);
      }
    }
  }
  return afirmar({
    afirmacao,
    porque,
    onde: achados.length
      ? achados[0].split('  ')[0]
      : 'apps/web/app/**, apps/web/src/components/**',
    ok: achados.length === 0,
    esperava: 'nenhum destes termos em texto visível',
    encontrei: [...new Set(achados)].join('\n               '),
  });
}

// ------------------------------------------------------------ pedir a rede --

/**
 * As três origens, por papel e não por nome.
 *
 * O guião fala de «a ficha», «a região» e «a montra» — os domínios são o
 * endereço de hoje, e o dia em que uma CIM mudar de domínio não pode ser o dia
 * em que este ficheiro deixa de fazer sentido.
 */
const ORIGENS = {
  ficha: 'coreto.org',
  regiao: 'mediotejo.coreto.org',
  montra: 'demo.coreto.org',
};

const BASE = (() => {
  const valor = process.env.AFIRMACOES_BASE;
  if (!valor) return null;
  if (valor === 'producao') return { modo: 'producao' };
  return { modo: 'local', origem: new URL(valor) };
})();

function pedir(dominio, caminho, { seguir = 2 } = {}) {
  const alvo =
    BASE.modo === 'producao'
      ? new URL(`https://${dominio}${caminho}`)
      : new URL(caminho, BASE.origem);
  const cliente = alvo.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const pedido = cliente.request(
      {
        hostname: alvo.hostname,
        port: alvo.port || (alvo.protocol === 'https:' ? 443 : 80),
        path: `${alvo.pathname}${alvo.search}`,
        headers: { Host: dominio, 'user-agent': 'coreto/verificar-afirmacoes' },
      },
      (resposta) => {
        const estado = resposta.statusCode ?? 0;
        const destino = resposta.headers.location;
        if (seguir > 0 && estado >= 300 && estado < 400 && destino) {
          resposta.resume();
          const proximo = new URL(destino, alvo);
          resolve(
            pedir(proximo.host, `${proximo.pathname}${proximo.search}`, { seguir: seguir - 1 }),
          );
          return;
        }
        const partes = [];
        resposta.on('data', (parte) => partes.push(parte));
        resposta.on('end', () =>
          resolve({
            estado,
            cabecalhos: resposta.headers,
            corpo: Buffer.concat(partes).toString('utf8'),
          }),
        );
      },
    );
    pedido.on('error', reject);
    pedido.setTimeout(30_000, () => pedido.destroy(new Error('demorou mais de 30 s')));
    pedido.end();
  });
}

/** Quantas vezes uma frase aparece no corpo servido. */
function conta(corpo, frase) {
  return corpo.split(frase).length - 1;
}

// =============================================================================
// No repositório — correm sempre, sem rede e sem segredos
// =============================================================================

console.log('No repositório\n');

const FICHA = 'apps/web/src/components/PaginaDaMontra.tsx';
const SUBMETER = 'apps/web/app/[regiao]/submeter/page.tsx';

ausente(FICHA, /formul[áa]rio/i, {
  afirmacao: 'a ficha não anuncia nenhum canal de submissão por formulário',
  porque:
    'o único canal além do email é POST /api/submissions, e a rota recusa application/x-www-form-urlencoded por decisão contra CSRF — a porta não se reabre por uma frase',
  // A linha do campo «Acessibilidade» fala de filtros e é verdadeira: os
  // formulários que existem funcionam mesmo sem JavaScript.
  tolerar: (linha) => /Filtros e formulários funcionam sem/.test(linha.texto),
});

presente(FICHA, /quase-duplicados entre fontes/, {
  afirmacao: 'a ficha distingue repetições da mesma fonte de quase-duplicados entre fontes',
  porque:
    'dizia «os duplicados fundem-se», contra a regra mais defendida da casa: entre fontes não se funde nada sem uma pessoa',
});
ausente(FICHA, /Os duplicados fundem-se/, {
  afirmacao: 'a ficha não volta a prometer que os duplicados se fundem',
  porque: 'fundir entre fontes é perder informação, e perder informação é o erro que não se desfaz',
  prosa: true,
});
for (const funcao of ['mergeSourceDuplicates', 'findNearDuplicates']) {
  presente('packages/core/src/dedup.ts', new RegExp(`export function ${funcao}`), {
    afirmacao: `a distinção tem mecanismo: dedup.ts exporta ${funcao}`,
    porque:
      'a frase da ficha descreve dois comportamentos diferentes; se as duas funções virarem uma, a frase deixou de ter o que a sustente',
  });
}

presente(FICHA, /Uma recolha por dia/, {
  afirmacao: 'a ficha diz a cadência da recolha pelo dia',
  porque:
    'a correção preguiçosa de uma frase falsa é apagá-la; o que se quer é a cadência certa, não o silêncio',
});
ausente(FICHA, /todas as noites/i, {
  afirmacao: 'a ficha não promete uma recolha todas as noites',
  porque:
    'o cron do scrape.yml está às 03:20 UTC e as execuções medidas caíram às 08:2x, 10:11 e 15:28 de Lisboa — a hora não se promete',
  prosa: true,
});

ausente(FICHA, /O que a versão/, {
  afirmacao: 'nenhum cabeçalho da ficha promete notas de versão que não existem',
  porque:
    'a sobrancelha dizia «O que a versão 2.1 faz» e não havia para onde mandar quem quisesse ir ver',
  prosa: true,
});
{
  // O par que apanha o dia em que houver notas de versão: a ressalva e a rota
  // não podem ser verdade ao mesmo tempo.
  const temRessalva = /Não há notas de versão/.test(ler('apps/web/src/lib/produto.ts'));
  const temRota = existsSync(join(RAIZ, 'apps/web/app/[regiao]/notas-de-versao'));
  afirmar({
    afirmacao: 'a ressalva «não há notas de versão publicadas» concorda com o que se serve',
    porque:
      'quem publicar notas de versão tira a ressalva; enquanto as duas coisas coexistirem, uma delas está a mentir',
    onde: origem('apps/web/src/lib/produto.ts', /Não há notas de versão/),
    ok: !(temRessalva && temRota),
    esperava: 'a ressalva sem rota de notas, ou a rota sem a ressalva',
    encontrei: 'a ressalva em produto.ts e uma rota de notas de versão publicada',
  });
}

ausente(SUBMETER, /\bonze\b/i, {
  afirmacao: 'a contagem de concelhos de /submeter é a da região que responde',
  porque:
    'a mesma página tem de dizer onze no Médio Tejo e dois na demonstração; um número cravado mente num dos domínios',
});
presente(SUBMETER, /concelhosPorExtenso/, {
  afirmacao: '/submeter conta os concelhos pela região e não por um literal',
  porque: 'é o campo da região que faz a frase mudar de domínio para domínio',
});
ausente(SUBMETER, /todas as noites/i, {
  afirmacao: '/submeter não promete leitura noturna',
  porque:
    'a recolha não corre de noite, e quem submete não tem de aprender uma hora que não existe',
  prosa: true,
});

{
  // A varredura larga: nenhuma rota de região promete a madrugada. Quando o
  // `admin/relatorios/page.tsx` for corrigido, alarga-se a `apps/web/app`
  // inteiro, que é o alvo do plano.
  const achados = [];
  const andar = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) andar(caminho);
      else if (/\.tsx?$/.test(entrada.name)) {
        const relativo = relative(RAIZ, caminho);
        for (const linha of linhasCom(semComentarios(ler(relativo)), /por noite|de madrugada/i)) {
          achados.push(`${relativo}:${linha.numero}  ${linha.texto}`);
        }
      }
    }
  };
  andar(join(RAIZ, 'apps', 'web', 'app', '[regiao]'));
  afirmar({
    afirmacao: 'nenhuma página de região promete que a recolha corre de madrugada',
    porque:
      '/estado e /fontes diziam «uma recolha por noite» e ela corre às 09:3x de Lisboa — a hora não é a que se prometia',
    onde: achados.length ? achados[0].split('  ')[0] : 'apps/web/app/[regiao]/**',
    ok: achados.length === 0,
    esperava: 'nenhuma menção a noite ou madrugada nas rotas de região',
    encontrei: achados.join('\n               '),
  });
}

presente('apps/web/app/[regiao]/estado/page.tsx', /uma vez por dia/, {
  afirmacao: '/estado continua a dizer a cadência da recolha',
  porque: 'guarda contra corrigir uma frase falsa apagando-a: quem lê /estado precisa da cadência',
});
presente('apps/web/app/[regiao]/fontes/page.tsx', /uma recolha por dia/, {
  afirmacao: '/fontes continua a dizer a cadência da recolha',
  porque: 'a mesma guarda: a página do levantamento sem cadência é meia página',
});
presente('apps/web/app/[regiao]/concelho/[id]/page.tsx', /uma vez por dia/, {
  afirmacao: 'a ficha de concelho continua a dizer a cadência da recolha',
  porque: 'a mesma guarda, na terceira página que a descreve',
});

{
  // Grafia pós-acordo em tudo o que se serve. O `docs/` fica de fora porque o
  // plano cita a frase antiga para explicar o que se corrigiu.
  const extensoes = /\.(ts|tsx|js|mjs|cjs|md|ya?ml|json|sql|sh|css|txt)$/;
  const ignorar = new Set(['node_modules', '.git', '.next', 'dist', 'docs', 'instantaneos']);
  // Este guião fica de fora da própria varredura: para proibir a palavra tem
  // de a escrever, e um guarda que se apanha a si mesmo não guarda nada.
  const oProprioGuarda = 'scripts/verificar-afirmacoes.mjs';
  const achados = [];
  const andar = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      if (ignorar.has(entrada.name)) continue;
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) andar(caminho);
      else if (extensoes.test(entrada.name)) {
        const relativo = relative(RAIZ, caminho);
        if (relativo === oProprioGuarda) continue;
        for (const linha of linhasCom(ler(relativo), /nocturn/i)) {
          achados.push(`${relativo}:${linha.numero}  ${linha.texto.slice(0, 70)}`);
        }
      }
    }
  };
  andar(RAIZ);
  afirmar({
    afirmacao: 'nenhuma superfície pública usa grafia pré-acordo',
    porque:
      '«noturna», não «nocturna» — a casa escreve pós-acordo e uma grafia velha lê-se como descuido',
    onde: achados.length ? achados[0].split('  ')[0] : 'o repositório, fora de docs/',
    ok: achados.length === 0,
    esperava: 'nenhuma ocorrência de «nocturn» fora de docs/',
    encontrei: achados.join('\n               '),
  });
}

// ---- Segurança: quem recebe a falha, e para onde manda o Policy ----

ausente('SECURITY.md', /coreto@mediotejo\.pt/, {
  afirmacao: 'nenhum endereço servido manda uma falha de segurança para a caixa de um cliente',
  porque:
    'era a caixa da CIM cliente, e o próprio levantamento dizia que está por criar: uma falha do produto ficava sem quem a corrigisse',
});
presente('SECURITY.md', /fabio@coreto\.org/, {
  afirmacao: 'o SECURITY.md nomeia quem corrige o software',
  porque:
    'quem corrige o Coreto é quem o escreve, e uma falha do produto é de todas as regiões ao mesmo tempo',
});
for (const rota of [
  'apps/web/app/[regiao]/seguranca-txt/route.ts',
  'apps/web/app/pagina-do-produto/seguranca-txt/route.ts',
]) {
  ausente(rota, /github\.com/, {
    afirmacao: `o Policy: ${rota.includes('[regiao]') ? 'de cada região' : 'do domínio do produto'} não aponta ao repositório`,
    porque:
      'o repositório é privado e api.github.com devolve "private": true — o Policy: dava 404 a qualquer investigador',
    prosa: true,
  });
  presente(rota, /URL_DA_POLITICA/, {
    afirmacao: `${rota.includes('[regiao]') ? 'cada região' : 'o domínio do produto'} aponta o Policy: para uma página nossa`,
    porque:
      'uma política de segurança servida no próprio domínio responde 200 sem sessão de ninguém',
  });
}
for (const prazo of ['72 horas', '30 dias']) {
  const naPagina = new RegExp(prazo).test(ler('apps/web/app/pagina-do-produto/seguranca/page.tsx'));
  const noManual = new RegExp(prazo).test(ler('SECURITY.md'));
  afirmar({
    afirmacao: `a página da política e o SECURITY.md dizem o mesmo prazo de ${prazo}`,
    porque:
      'são duas cópias da mesma promessa; o par existe para as apanhar no dia em que só uma mudar',
    onde: `SECURITY.md e apps/web/app/pagina-do-produto/seguranca/page.tsx`,
    ok: naPagina === noManual,
    esperava: `«${prazo}» nos dois, ou em nenhum`,
    encontrei: `SECURITY.md: ${noManual ? 'sim' : 'não'} · página: ${naPagina ? 'sim' : 'não'}`,
  });
}

presente('apps/web/app/[regiao]/robots.txt/route.ts', /text\/plain; charset=utf-8/, {
  afirmacao: 'o robots.txt declara o charset',
  porque:
    'o ficheiro tem acentos e sem charset quem o lê fica autorizado a adivinhar a codificação',
});

presente('apps/web/app/[regiao]/llms.txt/route.ts', /há menos de 90 dias/, {
  afirmacao: 'o llms.txt diz do passado o que a API cumpre',
  porque:
    'jurava que o passado sai de tudo, e ?from=2026-01-01 devolvia dezasseis eventos passados — foi a primeira destas frases a ser apanhada',
});

{
  // A lista fechada do anfitrião sem região: quatro endereços e mais nenhum.
  const fonte = ler('apps/web/middleware.ts');
  const bloco = fonte.split('const CAMINHOS_DA_MONTRA')[1]?.split(']);')[0] ?? '';
  const servidos = [...bloco.matchAll(/\['([^']+)',/g)].map((m) => m[1]).sort();
  const esperados = ['/', '/.well-known/security.txt', '/seguranca', '/sitemap.xml'].sort();
  afirmar({
    afirmacao: 'o anfitrião sem região tem uma lista fechada de quatro endereços',
    porque:
      'é a lista que impede um domínio apontado para cá antes de a região existir de ver a agenda de outra CIM',
    onde: origem('apps/web/middleware.ts', /const CAMINHOS_DA_MONTRA/),
    ok: JSON.stringify(servidos) === JSON.stringify(esperados),
    esperava: esperados.join(', '),
    encontrei: servidos.join(', ') || 'não consegui ler a lista',
  });
}

// ---- Acessibilidade: o que se declara feito e o que se declara em falta ----

{
  const fonte = ler('apps/web/src/components/informacoes/acessibilidade.ts');
  const feito =
    semComentarios(fonte).split('export const FEITO')[1]?.split('export const')[0] ?? '';
  const temReflow = /deslocamento horizontal|ecrãs estreitos/.test(feito);
  afirmar({
    afirmacao: '«O que está feito» não afirma ausência de deslocamento horizontal',
    porque:
      'a medição de 7 de setembro de 2026 desmentiu-a: a 320 px a entrada pede 561 px de largura — a declaração é lida por quem fiscaliza',
    onde: origem('apps/web/src/components/informacoes/acessibilidade.ts', /export const FEITO/),
    ok: !temReflow,
    esperava: 'nada sobre reflow dentro de FEITO',
    encontrei: 'FEITO afirma o que a medição desmente',
  });
  presente('apps/web/src/components/informacoes/acessibilidade.ts', /1\.4\.10/, {
    afirmacao: 'a declaração nomeia a falha do critério 1.4.10',
    porque:
      'uma limitação sem o critério nomeado não serve a quem fiscaliza nem a quem a vai corrigir',
  });
  presente('apps/web/src/components/informacoes/acessibilidade.ts', /de setembro de 2026/, {
    afirmacao: 'a limitação do reflow está datada',
    porque:
      'a casa escreve a limitação com data; sem data ninguém sabe se ainda é verdade — e é assim que uma ressalva envelhece em silêncio',
  });
}

presente('apps/web/src/components/FilterBar.tsx', /filtro-acessivel-nota/, {
  afirmacao: 'a caixa «Acesso a cadeiras de rodas» serve a ressalva ao lado dela',
  porque:
    'o filtro mostra só o que declara acesso, e sem a ressalva um zero lê-se como «não há nada acessível»',
});
presente('apps/web/src/components/FilterBar.tsx', /mostra só os eventos que o declaram/, {
  afirmacao: 'a ressalva do filtro diz o que o filtro faz',
  porque: 'a mesma cicatriz: ausência de declaração não é ausência de acesso',
});

presente('apps/web/app/[regiao]/page.tsx', /recorte: \{ accessible: true \}/, {
  afirmacao: 'o atalho «Acessível» da entrada é oferecido por contagem e não por remoção',
  porque:
    'zero de 128 no Médio Tejo e 24 de 30 na demonstração: o atalho levava a «Sem resultados» na agenda que tem público. Por contagem, volta sozinho quando o filtro passar a olhar para o espaço',
});
presente('apps/web/app/[regiao]/page.tsx', /comResultados/, {
  afirmacao: 'a entrada pergunta à base se o recorte tem eventos antes de o oferecer',
  porque: 'é a contagem que faz o atalho aparecer e desaparecer sem ninguém se lembrar dele',
});

{
  // O par por ligar: a função existe e a agenda ainda não a chama.
  const agenda = ler('apps/web/app/[regiao]/agenda/page.tsx');
  if (/vazioDaAgenda/.test(agenda)) {
    presente(
      'apps/web/src/components/EmptyState.tsx',
      /só os eventos onde o acesso a cadeiras de rodas está declarado/,
      {
        afirmacao: 'com ?accessible=1 e zero resultados, a agenda não aconselha alargar as datas',
        porque: 'alargar o intervalo não muda um recorte que só mostra o que declara acesso',
      },
    );
  } else {
    registar({
      afirmacao: 'com ?accessible=1 e zero resultados, a agenda não aconselha alargar as datas',
      onde: `${origem('apps/web/app/[regiao]/agenda/page.tsx', /<EmptyState/)} — a descrição continua cravada`,
      porque:
        'vazioDaAgenda existe em EmptyState.tsx e a agenda ainda não a chama; enquanto não chamar, /agenda?accessible=1 aconselha alargar o intervalo de datas a quem isso não ajuda',
    });
  }
}

// ---- Privacidade e medição ----

presente(
  'apps/web/app/[regiao]/privacidade/page.tsx',
  /hasAnalytics \? 'Quatro coisas' : 'Três coisas'/,
  {
    afirmacao: 'o número de saídas para fora de /privacidade acompanha a medição',
    porque:
      'anunciava «três coisas» e eram quatro, com o PostHog em todas as páginas: o número tem de ser função do que a CSP autoriza',
  },
);
presente(
  'apps/web/app/[regiao]/privacidade/page.tsx',
  /ANFITRIAO_DA_MEDICAO = new URL\(env\.NEXT_PUBLIC_POSTHOG_HOST\)/,
  {
    afirmacao: 'os anfitriões que /privacidade nomeia vêm da mesma variável que a CSP',
    porque:
      'uma política que nomeia servidores à mão acaba a nomear quem ninguém contacta, ou a calar quem se contacta',
  },
);
/*
 * A guarda do widget vale em três sítios, e é por isso que se verificam os
 * três. Esteve escrita contra um só — «`export function ehCaixaEmbebida` em
 * `posthog.ts`» — e a primeira mexida legítima fê-la falhar: a função mudou
 * para `caixa-embebida.ts`, sozinha e sem dependências, precisamente para o
 * provider a poder perguntar sem arrastar a chave para o `iframe` das
 * câmaras. Uma asserção presa ao ficheiro onde a coisa está hoje transforma
 * cada arrumação numa falha, e é assim que um guarda se ensina a ignorar.
 *
 * O que não pode mudar é a invariante: a função existe, o `capturePageView`
 * chama-a antes de contar, e o provider responde-a **antes** de importar o
 * módulo pesado. As três juntas são mais fortes do que a que aqui estava.
 */
presente('apps/web/src/lib/analytics/caixa-embebida.ts', /export function ehCaixaEmbebida/, {
  afirmacao: 'a guarda que impede o widget de contar visitas continua a existir',
  porque:
    'o widget corre no sítio de outra pessoa; contar visitas dele era medir quem nunca veio aqui. Seja qual for a correção do chunk, esta guarda não se substitui por nada',
});
presente('apps/web/src/lib/analytics/posthog.ts', /if \(ehCaixaEmbebida\(path\)\) return;/, {
  afirmacao: 'quem conta uma vista pergunta primeiro se é uma caixa embebida',
  porque:
    'a guarda no provider poupa o download; esta é a que impede a contagem, e quem chamar `capturePageView` por outro caminho continua protegido por ela',
});
presente(
  'apps/web/src/components/AnalyticsProvider.tsx',
  /if \(ehCaixaEmbebida\(pathname\)\) return/,
  {
    afirmacao: 'o provider decide a caixa embebida antes de fazer seja o que for',
    porque:
      'é esta linha que poupa ao `iframe` de cada câmara o download do pacote com a chave; sem ela, a importação dinâmica abaixo não serve de nada',
  },
);
presente(
  'apps/web/src/components/AnalyticsProvider.tsx',
  /import\('@\/src\/lib\/analytics\/posthog'\)/,
  {
    afirmacao: 'o módulo com a chave entra no provider por importação dinâmica',
    porque:
      'com a importação estática que aqui esteve, o pacote com a chave era descarregado dentro do `iframe` de cada câmara para a guarda o mandar embora sem correr — peso morto na casa de um cliente',
  },
);
if (/import .*analytics\/posthog/.test(ler('apps/web/src/components/AnalyticsProvider.tsx'))) {
  registar({
    afirmacao: 'nenhum chunk carregado pela rota do widget contém a chave do PostHog',
    onde: origem('apps/web/src/components/AnalyticsProvider.tsx', /analytics\/posthog/),
    porque:
      'a importação é estática, e por isso a chave viaja para o chunk de qualquer rota que carregue o provider — o widget incluído. A prova é uma compilação com uma chave de teste, cara de mais para este trabalho; a correção é tornar a importação dinâmica',
  });
}

{
  const consulta = ler('apps/web/src/lib/analytics/queries.ts');
  const semRegiao = /rpc\('event_stats_by_municipality'\)/.test(consulta);
  const painel = semComentarios(ler('apps/web/app/admin/estatisticas/page.tsx'));
  if (semRegiao) {
    afirmar({
      afirmacao:
        'o painel de estatísticas não promete um recorte por região que a consulta não faz',
      porque:
        'a RPC devolve os concelhos de todas as regiões da base; dizer «os onze» ou «o total da região» era contar um número que a tabela não mostra',
      onde: origem('apps/web/src/lib/analytics/queries.ts', /event_stats_by_municipality/),
      ok:
        /Nada aqui está recortado por região/.test(painel) &&
        !/aparecem sempre os onze|o total da região na última linha/.test(painel),
      esperava: 'a nota «Nada aqui está recortado por região», e nenhuma promessa de recorte',
      encontrei: 'o painel promete um recorte que a consulta não faz',
    });
  } else {
    afirmar({
      afirmacao: 'a nota «Nada aqui está recortado por região» sai quando o recorte existir',
      porque: 'a RPC passou a receber região (vaga 7): a ressalva deixou de ser verdade',
      onde: origem('apps/web/app/admin/estatisticas/page.tsx', /Nada aqui está recortado/),
      ok: !/Nada aqui está recortado por região/.test(painel),
      esperava: 'a nota removida',
      encontrei: 'a consulta recorta por região e a nota continua lá',
    });
  }
}

// ---- Os alarmes, que só servem enquanto alarmarem pela sua razão ----

{
  const codeql = ler('.github/workflows/codeql.yml');
  const condicoes = linhasCom(codeql, /^\s*if:/);
  afirmar({
    afirmacao: 'o trabalho de CodeQL é saltado, e não falhado, enquanto o repositório for privado',
    porque:
      "um `|| github.event_name == 'schedule'` fazia a execução agendada passar a condição, correr e falhar pela razão que a condição existe para evitar — vermelho todas as segundas-feiras, que é como se ensina alguém a ignorar um alarme",
    onde: condicoes.length
      ? `.github/workflows/codeql.yml:${condicoes[0].numero}`
      : '.github/workflows/codeql.yml',
    ok:
      condicoes.length === 1 &&
      condicoes[0].texto === "if: github.event.repository.visibility == 'public'",
    esperava: "uma só condição: if: github.event.repository.visibility == 'public'",
    encontrei: condicoes.map((l) => `codeql.yml:${l.numero}  ${l.texto}`).join('\n               '),
  });
}

{
  const scrape = ler('.github/workflows/scrape.yml');
  afirmar({
    afirmacao: 'o aviso «A recolha noturna falhou» está aberto se e só se a última recolha falhou',
    porque:
      'a recolha abria o aviso e não o fechava: o #125 ficou aberto com duas noites boas depois dele. Um aviso que não fecha deixa de ser um aviso',
    onde: origem('.github/workflows/scrape.yml', /TITULO:/),
    ok:
      /TITULO:/.test(scrape) &&
      /^\s*if: failure\(\)/m.test(scrape) &&
      /^\s*if: success\(\)/m.test(scrape) &&
      /gh issue close/.test(scrape),
    esperava:
      'o título no env do trabalho, um passo com if: failure() a abrir e outro com if: success() a fechar',
    encontrei: `TITULO ${/TITULO:/.test(scrape) ? 'sim' : 'não'} · abre ${/^\s*if: failure\(\)/m.test(scrape) ? 'sim' : 'não'} · fecha ${/gh issue close/.test(scrape) ? 'sim' : 'não'}`,
  });
}

for (const manual of ['docs/OPERACAO.md', 'docs/BACKUPS.md']) {
  ausente(manual, /cópia \*\*nunca correu\*\*/, {
    afirmacao: `${manual} não afirma, a negrito, que a cópia de segurança nunca correu`,
    porque:
      'ficou escrito três dias depois de a cópia correr, no documento que se lê às pressas no pior dia — a segunda pessoa não procura o que o manual diz não existir',
  });
}
{
  // O par que faz a ressalva do ensaio de restauro cair com a causa dela.
  const usaNoPrivileges = /--no-privileges/.test(ler('.github/workflows/backup.yml'));
  const manualRegista = /no-privileges/.test(ler('docs/OPERACAO.md'));
  afirmar({
    afirmacao: 'o manual regista a limitação do ensaio de restauro enquanto ela existir',
    porque:
      'o ensaio passa a verde sobre uma base sem uma única concessão a anon e authenticated — acreditar no verde é o erro que aquele parágrafo existe para evitar. No dia em que a vaga 3 tirar o --no-privileges, é o parágrafo que sai com ele',
    onde: 'docs/OPERACAO.md e .github/workflows/backup.yml',
    ok: usaNoPrivileges === manualRegista,
    esperava:
      'o manual a registar a limitação exatamente enquanto o backup.yml usar --no-privileges',
    encontrei: `backup.yml: ${usaNoPrivileges ? 'usa' : 'não usa'} · manual: ${manualRegista ? 'regista' : 'não regista'}`,
  });
}

// ---- A bíblia da língua, e o que ela obriga ----

{
  // A declaração do PROJETO.md e o histórico têm de concordar, seja qual for o
  // lado que mude.
  let mencoes = null;
  try {
    mencoes = execFileSync('git', ['log', '--format=%B'], { cwd: RAIZ, encoding: 'utf8' })
      .split('\n')
      .filter((linha) => /claude/i.test(linha)).length;
  } catch {
    saltar('PROJETO.md e o histórico concordam sobre a geração automática', 'sem git aqui');
  }
  if (mencoes !== null) {
    const seccao =
      ler('PROJETO.md')
        .split('Nenhuma referência a geração automática')[1]
        ?.split('- Código conciso')[0] ?? '';
    afirmar({
      afirmacao: 'PROJETO.md não declara cumprida a ausência de referências a geração automática',
      porque:
        'a linha dizia que também as mensagens de commit estavam limpas, e `git log | grep -ci claude` desmentia-a. Corrigiu-se a declaração e não o histórico: reescrever quarenta commits apagava o porquê ao lado de cada decisão',
      onde: origem('PROJETO.md', /Nenhuma referência a geração automática/),
      ok: mencoes === 0 || /mensagens de commit são a exceção/.test(seccao),
      esperava: 'a exceção declarada, já que o histórico tem menções',
      encontrei: `${mencoes} linhas do histórico com «claude» e nenhuma exceção declarada`,
    });
  }
}

{
  const lingua = ler('CONTRIBUTING.md').split('### Língua')[1]?.split('### ')[0] ?? '';
  afirmar({
    afirmacao: 'o CONTRIBUTING.md remete para a bíblia da língua na secção «Língua»',
    porque:
      'apanha tanto a remissão apagada como o documento renomeado sem alguém atualizar quem lhe aponta',
    onde: origem('CONTRIBUTING.md', /### Língua/),
    ok: lingua.includes('docs/NARRATIVA.md') && existsSync(join(RAIZ, 'docs/NARRATIVA.md')),
    esperava: 'a secção «Língua» a apontar para docs/NARRATIVA.md, e o ficheiro a existir',
    encontrei: `remissão ${lingua.includes('docs/NARRATIVA.md') ? 'sim' : 'não'} · ficheiro ${existsSync(join(RAIZ, 'docs/NARRATIVA.md')) ? 'sim' : 'não'}`,
  });
}

{
  const palavras = ler('docs/NARRATIVA.md').trim().split(/\s+/).length;
  afirmar({
    afirmacao: 'docs/NARRATIVA.md continua a caber em quatro páginas',
    porque:
      'o limite é o que faz alguém abri-lo antes de escrever um email; um documento que cresce para dez páginas deixa de ser consultado e volta-se ao problema que ele resolve',
    onde: 'docs/NARRATIVA.md',
    ok: palavras <= 2600,
    esperava: 'no máximo 2600 palavras',
    encontrei: `${palavras} palavras`,
  });
}

varrerDicionario(GLOSSARIO_INTERNO, {
  afirmacao: 'nenhum termo do glossário interno aparece em texto visível servido',
  porque:
    'o jargão já escorregou uma vez para a declaração de acessibilidade e para a entrada do Médio Tejo; «montra» é a página do produto e «gaveta» é o menu, e quem lê não tem de saber a diferença',
  prefixoDaChave: 'glossario',
});
varrerDicionario(PALAVRAS_PROIBIDAS, {
  afirmacao: 'nenhuma palavra proibida aparece em texto visível servido',
  porque:
    'cada uma descreve qualquer coisa e por isso não descreve nada; ao lado de frases que se podem conferir, uma delas chega para pôr a página inteira em dúvida',
  prefixoDaChave: 'proibida',
});

{
  // Enquanto o repositório responder 404 a quem não tem sessão, a frase larga
  // não se publica. Quando abrir, é esta asserção que se inverte.
  const achados = [];
  const andar = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name !== 'node_modules') andar(caminho);
      } else if (/\.tsx?$/.test(entrada.name)) {
        const relativo = relative(RAIZ, caminho);
        for (const linha of linhasCom(
          semComentarios(ler(relativo)),
          /qualquer pessoa pode ler o código|código aberto e auditável/i,
        )) {
          achados.push(`${relativo}:${linha.numero}`);
        }
      }
    }
  };
  andar(join(RAIZ, 'apps', 'web', 'app'));
  andar(join(RAIZ, 'apps', 'web', 'src'));
  afirmar({
    afirmacao: '«qualquer pessoa pode ler o código» não se publica enquanto ninguém puder',
    porque:
      'github.com/fvsalgado/coreto responde 404 a quem não tem sessão. Dizer «qualquer pessoa pode ler» enquanto ninguém pode é exatamente o género de afirmação que este guião existe para impedir',
    onde: achados.length ? achados[0] : 'apps/web/app/**, apps/web/src/**',
    ok: achados.length === 0,
    esperava: 'a frase só depois de o repositório abrir',
    encontrei: achados.join(', '),
  });
}

{
  // A frase de posicionamento publicada tem de ser, letra a letra, a de §2 —
  // e hoje ainda não é. Regista-se em vez de falhar: a substituição é a
  // medida 4 da vaga 7, e uma falha por trabalho que ainda não tem vaga é uma
  // falha que se aprende a saltar.
  const citacao =
    ler('docs/NARRATIVA.md')
      .split('## 2. A frase de posicionamento')[1]
      ?.split('**A institucional')[0]
      .split('\n')
      .filter((linha) => linha.startsWith('> '))
      .map((linha) => linha.slice(2).trim())
      .join(' ') ?? '';
  const ficha = ler(FICHA);
  if (citacao && ficha.includes(citacao)) {
    afirmar({
      afirmacao: 'a frase de posicionamento publicada é, letra a letra, a de docs/NARRATIVA.md §2',
      porque: 'duas versões da mesma frase divergem sempre, e a que diverge é a que está publicada',
      onde: origem(FICHA, /Toda a programação cultural|O Coreto é a agenda cultural/),
      ok: true,
      esperava: '',
      encontrei: '',
    });
  } else {
    registar({
      afirmacao: 'a frase de posicionamento publicada é, letra a letra, a de docs/NARRATIVA.md §2',
      onde: `${origem(FICHA, /Toda a programação cultural/)} — a ficha abre com outro parágrafo`,
      porque:
        'a substituição do subtítulo é a medida 4 da vaga 7; até lá o guião regista a divergência em vez de falhar, e depois passa a exigir a igualdade como /informacoes já faz entre a prosa visível e o bloco FAQPage',
    });
  }
}

{
  // Os cinco princípios de §5 e a secção «as regras da casa» da ficha, que
  // ainda não existe.
  const principios = (
    ler('docs/NARRATIVA.md')
      .split('## 5. Os cinco princípios')[1]
      ?.split('## 6.')[0]
      .match(/^\d+\.\s+\*\*(.+?)\*\*/gm) ?? []
  ).length;
  const fichaTemRegras = /as regras da casa/i.test(ler(FICHA));
  if (fichaTemRegras) {
    afirmar({
      afirmacao: 'os cinco princípios da ficha são, palavra a palavra, os de docs/NARRATIVA.md §5',
      porque:
        'a mesma razão da frase de posicionamento: duas cópias divergem, e diverge a publicada',
      onde: origem(FICHA, /as regras da casa/i),
      ok: principios === 5,
      esperava: 'cinco princípios em §5 e os mesmos cinco na ficha',
      encontrei: `${principios} princípios em §5`,
    });
  } else {
    registar({
      afirmacao: 'os cinco princípios da ficha são, palavra a palavra, os de docs/NARRATIVA.md §5',
      onde: 'docs/NARRATIVA.md §5 — a secção «as regras da casa» da ficha ainda não existe',
      porque: 'a secção é a medida 4 da vaga 7; enquanto não existir, esta asserção fica por ligar',
    });
  }
}

// =============================================================================
// Nas rotas — só com AFIRMACOES_BASE, porque o CI corre sem rede e sem chaves
// =============================================================================

console.log('\nNas rotas\n');

if (!BASE) {
  saltar('as afirmações que precisam de um pedido a produção', 'sem AFIRMACOES_BASE configurada');
  console.log(
    '    AFIRMACOES_BASE=producao para as três origens a sério, ou um endereço para o sítio local.',
  );
} else {
  const onde = (dominio, caminho, ficheiro) =>
    `https://${dominio}${caminho}${ficheiro ? ` (emitido em ${ficheiro})` : ''}`;

  // ---- A ficha do produto ----
  {
    const ficha = await pedir(ORIGENS.ficha, '/');
    const pares = [
      ['por formulário', 0, 'a ficha não anuncia um canal de submissão por formulário'],
      ['Os duplicados fundem-se', 0, 'a ficha não promete que os duplicados se fundem'],
      ['quase-duplicados entre fontes', 1, 'a ficha distingue repetições de quase-duplicados'],
      ['todas as noites', 0, 'a ficha não promete uma recolha todas as noites'],
      ['Uma recolha por dia', 1, 'a ficha diz a cadência da recolha pelo dia'],
      ['versão 2.1', 1, 'o número da versão é publicado uma vez, como identificação'],
      ['O que a versão', 0, 'nenhum cabeçalho promete notas de versão que não existem'],
    ];
    for (const [frase, esperado, afirmacao] of pares) {
      const vezes = conta(ficha.corpo, frase);
      afirmar({
        afirmacao: `${afirmacao} (servido)`,
        porque: 'a fonte pode estar certa e a rota servir outra coisa — é o que este par mede',
        onde: onde(ORIGENS.ficha, '/', FICHA),
        ok: esperado === 0 ? vezes === 0 : vezes >= esperado,
        esperava: `«${frase}» ${esperado === 0 ? 'zero vezes' : `${esperado} vez`}`,
        encontrei: `${vezes} vezes`,
      });
    }
  }

  // ---- A contagem de concelhos, que muda de domínio para domínio ----
  {
    const daRegiao = await pedir(ORIGENS.regiao, '/submeter');
    const daMontra = await pedir(ORIGENS.montra, '/submeter');
    afirmar({
      afirmacao: 'a contagem de concelhos de /submeter é a da região que responde',
      porque:
        'é o par que apanha uma regressão nos dois sentidos: a mesma página tem de dizer números diferentes em domínios diferentes',
      onde: onde(ORIGENS.regiao, '/submeter', SUBMETER),
      ok:
        conta(daRegiao.corpo, 'num dos onze concelhos') === 1 &&
        conta(daMontra.corpo, 'num dos dois concelhos') === 1 &&
        conta(daMontra.corpo, 'onze') === 0,
      esperava: 'onze no Médio Tejo, dois na demonstração, e nenhum «onze» na demonstração',
      encontrei: `região: ${conta(daRegiao.corpo, 'num dos onze concelhos')} · montra: ${conta(daMontra.corpo, 'num dos dois concelhos')} · «onze» na montra: ${conta(daMontra.corpo, 'onze')}`,
    });
    for (const [papel, resposta] of [
      ['região', daRegiao],
      ['montra', daMontra],
    ]) {
      afirmar({
        afirmacao: `/submeter da ${papel} não promete leitura noturna`,
        porque:
          'a recolha não corre de noite; quem submete não tem de aprender uma hora que não existe',
        onde: onde(papel === 'região' ? ORIGENS.regiao : ORIGENS.montra, '/submeter', SUBMETER),
        ok: !/todas as noites/i.test(resposta.corpo),
        esperava: 'nenhuma menção a «todas as noites»',
        encontrei: 'a página promete uma recolha durante a noite',
      });
    }
  }

  // ---- O security.txt das três origens, e para onde o Policy: manda ----
  for (const [papel, dominio] of Object.entries(ORIGENS)) {
    const resposta = await pedir(dominio, '/.well-known/security.txt');
    afirmar({
      afirmacao: `${papel}: /.well-known/security.txt responde 200`,
      porque:
        'coreto.org não servia nenhum, e é o primeiro domínio onde um investigador procura — a rota vivia em app/[regiao] e a montra não é região',
      onde: onde(dominio, '/.well-known/security.txt'),
      ok: resposta.estado === 200,
      esperava: '200',
      encontrei: String(resposta.estado),
    });
    if (resposta.estado !== 200) continue;

    const primeiroContacto = resposta.corpo.split('\n').find((l) => l.startsWith('Contact:')) ?? '';
    afirmar({
      afirmacao: `${papel}: a falha de segurança chega primeiro a quem a corrige`,
      porque:
        'o primeiro Contact: era a caixa de uma CIM cliente, e o levantamento dizia que está por criar',
      onde: onde(
        dominio,
        '/.well-known/security.txt',
        'apps/web/app/[regiao]/seguranca-txt/route.ts',
      ),
      ok: primeiroContacto.trim() === 'Contact: mailto:fabio@coreto.org',
      esperava: 'Contact: mailto:fabio@coreto.org',
      encontrei: primeiroContacto || 'nenhuma linha Contact:',
    });

    for (const politica of resposta.corpo
      .split('\n')
      .filter((l) => l.startsWith('Policy: '))
      .map((l) => l.slice('Policy: '.length).trim())) {
      const alvo = new URL(politica);
      const pagina = await pedir(alvo.host, `${alvo.pathname}${alvo.search}`);
      afirmar({
        afirmacao: `${papel}: o Policy: ${politica} responde 200 e não é o repositório`,
        porque:
          'apontava para github.com/fvsalgado/coreto, e o repositório é privado: 404 para qualquer investigador',
        onde: onde(dominio, '/.well-known/security.txt'),
        ok: pagina.estado === 200 && !politica.includes('github.com'),
        esperava: '200 num domínio nosso',
        encontrei: `${pagina.estado}${politica.includes('github.com') ? ' e aponta ao GitHub' : ''}`,
      });
    }
  }

  // ---- O sitemap do domínio do produto não lista nada de ninguém ----
  {
    const mapa = await pedir(ORIGENS.ficha, '/sitemap.xml');
    const fugas = mapa.corpo.match(/mediotejo|concelho|evento|demo\./gi) ?? [];
    afirmar({
      afirmacao: 'o sitemap do domínio do produto não lista nada de nenhuma região',
      porque:
        'esta origem responde a qualquer anfitrião fora do mapa, incluindo o domínio de um cliente apontado para cá antes de a região dele existir',
      onde: onde(
        ORIGENS.ficha,
        '/sitemap.xml',
        'apps/web/app/pagina-do-produto/sitemap-xml/route.ts',
      ),
      ok: mapa.estado === 200 && conta(mapa.corpo, '<loc>') === 2 && fugas.length === 0,
      esperava: '200, dois <loc>, e nem uma palavra de uma região',
      encontrei: `${mapa.estado}, ${conta(mapa.corpo, '<loc>')} <loc>, fugas: ${fugas.join(', ') || 'nenhuma'}`,
    });
  }

  // ---- O charset do robots.txt, nas duas origens que o servem ----
  for (const dominio of [ORIGENS.regiao, ORIGENS.montra]) {
    const resposta = await pedir(dominio, '/robots.txt');
    afirmar({
      afirmacao: `${dominio}: o robots.txt declara o charset`,
      porque: 'o ficheiro tem acentos e sem charset quem o lê fica autorizado a adivinhar',
      onde: onde(dominio, '/robots.txt', 'apps/web/app/[regiao]/robots.txt/route.ts'),
      ok: /text\/plain;\s*charset=utf-8/i.test(String(resposta.cabecalhos['content-type'] ?? '')),
      esperava: 'text/plain; charset=utf-8',
      encontrei: String(resposta.cabecalhos['content-type'] ?? 'sem content-type'),
    });
  }

  // ---- O llms.txt e a API que ele descreve ----
  {
    const llms = await pedir(ORIGENS.regiao, '/llms.txt');
    afirmar({
      afirmacao: 'o llms.txt continua a dizer os 90 dias',
      porque: 'a frase e a medição mudam juntas, e é a frase que se corrigiu para a medição',
      onde: onde(ORIGENS.regiao, '/llms.txt', 'apps/web/app/[regiao]/llms.txt/route.ts'),
      ok: conta(llms.corpo, 'há menos de 90 dias') === 1,
      esperava: '«há menos de 90 dias» uma vez',
      encontrei: `${conta(llms.corpo, 'há menos de 90 dias')} vezes`,
    });

    const api = await pedir(ORIGENS.regiao, '/api/events?from=2020-01-01&limit=100');
    try {
      const hoje = new Date();
      const dados = JSON.parse(api.corpo);
      const velhos = (dados.events ?? [])
        .filter((evento) => evento.date_end)
        .map((evento) => ({
          id: evento.id ?? evento.slug,
          dias: Math.floor((hoje - new Date(evento.date_end)) / 86_400_000),
        }))
        .filter((evento) => evento.dias > 90);
      afirmar({
        afirmacao: 'nada do que a API devolve acabou há mais de 90 dias',
        porque:
          'o llms.txt jurava que o passado sai de tudo e ?from=2026-01-01 devolvia dezasseis eventos passados — foi esta a primeira frase falsa a ser apanhada aqui',
        onde: onde(ORIGENS.regiao, '/api/events', 'apps/web/app/[regiao]/llms.txt/route.ts'),
        ok: velhos.length === 0,
        esperava: 'nenhum evento acabado há mais de 90 dias',
        encontrei: velhos.map((e) => `${e.id} há ${e.dias} dias`).join(', '),
      });
    } catch (erro) {
      afirmar({
        afirmacao: 'nada do que a API devolve acabou há mais de 90 dias',
        porque: 'a mesma cicatriz do llms.txt',
        onde: onde(ORIGENS.regiao, '/api/events'),
        ok: false,
        esperava: 'uma resposta JSON com events[]',
        encontrei: `${api.estado} — ${erro.message}`,
      });
    }
  }

  // ---- A política de segurança servida e o SECURITY.md ----
  {
    const politica = await pedir(ORIGENS.ficha, '/seguranca');
    for (const prazo of ['72 horas', '30 dias']) {
      afirmar({
        afirmacao: `a página da política serve o prazo de ${prazo} que o SECURITY.md promete`,
        porque: 'são duas cópias da mesma promessa, e este par apanha-as quando só uma mudar',
        onde: onde(ORIGENS.ficha, '/seguranca', 'SECURITY.md'),
        ok: politica.corpo.includes(prazo) === ler('SECURITY.md').includes(prazo),
        esperava: `«${prazo}» nos dois`,
        encontrei: `servido: ${politica.corpo.includes(prazo) ? 'sim' : 'não'} · SECURITY.md: ${ler('SECURITY.md').includes(prazo) ? 'sim' : 'não'}`,
      });
    }
  }

  // ---- A privacidade contra a CSP que a desmentiria ----
  for (const dominio of [ORIGENS.regiao, ORIGENS.montra]) {
    const entrada = await pedir(dominio, '/');
    const csp = String(entrada.cabecalhos['content-security-policy'] ?? '');
    const pagina = await pedir(dominio, '/privacidade');
    const haMedicao = /posthog/i.test(csp);

    afirmar({
      afirmacao: `${dominio}: /privacidade não diz «nada» com a medição a correr`,
      porque:
        'a frase disse «nada» durante o tempo em que o PostHog já corria: de quem só visita sai um evento por cada página aberta',
      onde: onde(dominio, '/privacidade', 'apps/web/app/[regiao]/privacidade/page.tsx'),
      ok: !haMedicao || pagina.corpo.includes('um evento por cada página aberta'),
      esperava: 'a página a dizer o que sai de quem só visita',
      encontrei: 'a CSP nomeia o PostHog e a página diz que não sai nada',
    });

    const esperado = haMedicao ? 'Quatro coisas' : 'Três coisas';
    afirmar({
      afirmacao: `${dominio}: o número de saídas para fora acompanha a medição`,
      porque: 'anunciava «três coisas» e eram quatro, com o PostHog em todas as páginas',
      onde: onde(dominio, '/privacidade', 'apps/web/app/[regiao]/privacidade/page.tsx'),
      ok: pagina.corpo.includes(`<strong>${esperado}`),
      esperava: `<strong>${esperado}`,
      encontrei: pagina.corpo.includes('<strong>Quatro coisas') ? 'Quatro coisas' : 'Três coisas',
    });

    const nomeados = [
      ...new Set(
        (pagina.corpo.match(/<code>[a-z.-]*posthog\.com<\/code>/g) ?? []).map((m) =>
          m.replace(/<\/?code>/g, ''),
        ),
      ),
    ].sort();
    const autorizados = [
      ...new Set(
        csp
          .split(';')
          .filter((diretiva) => /script-src|connect-src/i.test(diretiva))
          .flatMap((diretiva) => diretiva.match(/[a-z.-]*posthog\.com/g) ?? []),
      ),
    ].sort();
    afirmar({
      afirmacao: `${dominio}: os anfitriões que /privacidade nomeia são os que a CSP autoriza`,
      porque:
        'uma política que nomeia servidores que ninguém contacta é tão falsa como uma que cala um que se contacte',
      onde: onde(dominio, '/privacidade', 'apps/web/app/[regiao]/privacidade/page.tsx'),
      ok: JSON.stringify(nomeados) === JSON.stringify(autorizados),
      esperava: autorizados.join(', ') || 'nenhum',
      encontrei: nomeados.join(', ') || 'nenhum',
    });
  }

  // ---- O atalho «Acessível» só quando o recorte tem eventos ----
  for (const dominio of [ORIGENS.regiao, ORIGENS.montra]) {
    const recorte = await pedir(dominio, '/api/events?accessible=1&limit=1');
    const total = Number(recorte.corpo.match(/"total":(\d+)/)?.[1] ?? '-1');
    const entrada = await pedir(dominio, '/');
    const oferece = conta(entrada.corpo, 'agenda?accessible=1') > 0;
    afirmar({
      afirmacao: `${dominio}: a entrada só oferece «Acessível» quando o recorte tem eventos`,
      porque:
        'zero de 128 no Médio Tejo e 24 de 30 na demonstração: o atalho estava na agenda com público a levar a «Sem resultados». É o modo de falha que passa em todos os ensaios e só está vazio onde há gente',
      onde: onde(dominio, '/', 'apps/web/app/[regiao]/page.tsx'),
      ok: total < 0 ? false : (total === 0) !== oferece,
      esperava:
        total === 0
          ? 'sem atalho, porque o recorte está vazio'
          : 'o atalho, porque o recorte tem eventos',
      encontrei: `total ${total} e o atalho ${oferece ? 'oferecido' : 'ausente'}`,
    });
  }

  // ---- A declaração de acessibilidade, e onde cada frase está ----
  {
    const pagina = await pedir(ORIGENS.regiao, '/acessibilidade');
    afirmar({
      afirmacao: 'a declaração nomeia a falha do critério 1.4.10 com números e com data',
      porque:
        'é o documento que quem fiscaliza lê; uma limitação sem critério e sem data não serve para nada',
      onde: onde(
        ORIGENS.regiao,
        '/acessibilidade',
        'apps/web/src/components/informacoes/acessibilidade.ts',
      ),
      ok: pagina.corpo.includes('1.4.10') && pagina.corpo.includes('7 de setembro de 2026'),
      esperava: '«1.4.10» e a data da medição',
      encontrei: `1.4.10 ${pagina.corpo.includes('1.4.10') ? 'sim' : 'não'} · data ${pagina.corpo.includes('7 de setembro de 2026') ? 'sim' : 'não'}`,
    });
    const limitacoes = pagina.corpo.indexOf('Limitações conhecidas');
    const reflow = pagina.corpo.indexOf('deslocamento horizontal');
    afirmar({
      afirmacao: '«deslocamento horizontal» aparece nas limitações e nunca no que está feito',
      porque:
        'esteve escrito em «O que está feito» e a medição desmentiu-o: a 320 px a entrada pede 561 px de largura',
      onde: onde(
        ORIGENS.regiao,
        '/acessibilidade',
        'apps/web/src/components/informacoes/acessibilidade.ts',
      ),
      ok: reflow === -1 || (limitacoes !== -1 && reflow > limitacoes),
      esperava: 'a frase depois de «Limitações conhecidas»',
      encontrei: reflow === -1 ? 'a frase não aparece' : 'a frase aparece antes das limitações',
    });
  }

  // ---- A ressalva do filtro, ao lado da caixa ----
  {
    const agenda = await pedir(ORIGENS.regiao, '/agenda');
    afirmar({
      afirmacao: 'a caixa «Acesso a cadeiras de rodas» serve a ressalva ao lado dela',
      porque:
        'sem a ressalva, um zero lê-se como «não há nada acessível» — e não é isso que o filtro mede',
      onde: onde(ORIGENS.regiao, '/agenda', 'apps/web/src/components/FilterBar.tsx'),
      ok:
        agenda.corpo.includes('filtro-acessivel-nota') &&
        agenda.corpo.includes('mostra só os eventos que o declaram'),
      esperava: 'a nota ligada à caixa por aria-describedby',
      encontrei: 'a caixa sem a ressalva',
    });
  }

  // ---- A cadência, nas três páginas que a descrevem ----
  for (const caminho of ['/estado', '/fontes', '/concelho/tomar']) {
    const pagina = await pedir(ORIGENS.regiao, caminho);
    afirmar({
      afirmacao: `${caminho} não promete uma recolha por noite`,
      porque:
        'diziam «uma recolha por noite» e ela corre às 09:3x de Lisboa; o cron está às 03:20 UTC e as execuções medidas foram às 08:2x, 10:11 e 15:28',
      onde: onde(ORIGENS.regiao, caminho),
      ok: !/por noite|de madrugada/i.test(pagina.corpo),
      esperava: 'nenhuma menção a noite ou madrugada',
      encontrei: 'a página promete uma hora que a recolha não cumpre',
    });
  }
  for (const [caminho, frase] of [
    ['/estado', 'uma vez por dia'],
    ['/fontes', 'uma recolha por dia'],
  ]) {
    const pagina = await pedir(ORIGENS.regiao, caminho);
    afirmar({
      afirmacao: `${caminho} continua a dizer a cadência da recolha`,
      porque: 'guarda contra a correção preguiçosa de apagar a frase em vez de a corrigir',
      onde: onde(ORIGENS.regiao, caminho),
      ok: conta(pagina.corpo, frase) >= 1,
      esperava: `«${frase}» pelo menos uma vez`,
      encontrei: '0 vezes',
    });
  }
}

// ------------------------------------------------------------------- fecho --

for (const pendente of PENDENTES) {
  if (pendentesUsadas.has(pendente.chave)) continue;
  avisos.push(
    `a pendência «${pendente.chave}» (desde ${pendente.desde}) já não acerta em nada — apaga-a de PENDENTES, em scripts/verificar-afirmacoes.mjs`,
  );
}

if (avisos.length > 0) {
  console.log('');
  for (const aviso of avisos) console.log(`⚠ ${aviso}`);
}

const plural = (quantas, singular, muitas) => `${quantas} ${quantas === 1 ? singular : muitas}`;
console.log(
  `\n${plural(passadas, 'afirmação confirmada', 'afirmações confirmadas')}, ` +
    `${plural(registadas, 'registada por ligar', 'registadas por ligar')}, ` +
    `${plural(saltadas, 'por medir', 'por medir')}, ` +
    `${plural(falhas, 'a falhar', 'a falhar')}.`,
);

if (falhas > 0) {
  console.error(
    '\nUma frase servida afirma o que a produção desmente. Corrige a frase — ou o que a desmente.',
  );
  process.exit(1);
}
