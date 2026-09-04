import { PageHeader } from './PageHeader';

/**
 * O que uma página do painel mostra sem `SUPABASE_SERVICE_ROLE_KEY`.
 *
 * Era um parágrafo solto em oito páginas — sem cabeçalho, sem `<h1>`, uma
 * página que não dizia onde se estava. O estado «por configurar» tem de ter
 * a mesma estrutura que qualquer outro: o título da página, e a razão de não
 * haver mais nada debaixo dele. Vive num sítio só para as oito não voltarem
 * a divergir.
 */
export function SemChaveDeServico({ titulo }: { titulo: string }) {
  return (
    <>
      <PageHeader title={titulo} />
      <p className="text-muted">
        Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. Sem ela o backoffice não lê nada.
      </p>
    </>
  );
}
