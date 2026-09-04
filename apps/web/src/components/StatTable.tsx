import type { ReactNode } from 'react';

export interface StatColumn<Row> {
  key: string;
  label: string;
  /** A coluna que diz de que linha se trata. Vira `<th scope="row">`. */
  isRowHeader?: boolean;
  /** Números alinham à direita e com dígitos de largura fixa. */
  isNumeric?: boolean;
  render: (row: Row) => ReactNode;
}

interface Props<Row> {
  /**
   * Descrição da tabela para quem não a vê. Fica escondida à vista porque a
   * secção já tem um título visível — mas um leitor de ecrã que salte de
   * tabela em tabela precisa de a ouvir, e o título da secção não vai com ela.
   */
  caption: string;
  columns: Array<StatColumn<Row>>;
  rows: Row[];
  rowKey: (row: Row) => string;
  emptyMessage: string;
  /** Linha de totais, se houver. Vai para `<tfoot>`. */
  totalRow?: Row;
}

function cellClass(column: { isNumeric?: boolean }): string {
  return column.isNumeric ? 'py-2 pl-4 text-right tabular-nums' : 'py-2 pr-4';
}

/**
 * Tabela de números, acessível.
 *
 * Cabeçalhos de coluna e de linha com `scope`, legenda própria e rolamento
 * horizontal quando não cabe — sem o `overflow`, num telemóvel, as colunas da
 * direita ficam inalcançáveis.
 */
export function StatTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  emptyMessage,
  totalRow,
}: Props<Row>) {
  if (rows.length === 0) {
    return <p className="mt-2 text-muted">{emptyMessage}</p>;
  }

  return (
    <div
      className="mt-3 overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label="Tabela, deslocável na horizontal"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={
                  column.isNumeric
                    ? 'py-2 pl-4 text-right font-semibold'
                    : 'py-2 pr-4 font-semibold'
                }
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-border">
              {columns.map((column) =>
                column.isRowHeader ? (
                  <th key={column.key} scope="row" className={`${cellClass(column)} font-normal`}>
                    {column.render(row)}
                  </th>
                ) : (
                  <td key={column.key} className={cellClass(column)}>
                    {column.render(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {totalRow ? (
          <tfoot>
            <tr className="border-t-2 border-field font-semibold">
              {columns.map((column) =>
                column.isRowHeader ? (
                  <th key={column.key} scope="row" className={cellClass(column)}>
                    {column.render(totalRow)}
                  </th>
                ) : (
                  <td key={column.key} className={cellClass(column)}>
                    {column.render(totalRow)}
                  </td>
                ),
              )}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
