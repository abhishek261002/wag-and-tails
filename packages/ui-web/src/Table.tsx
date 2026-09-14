import React from 'react';
import clsx from 'clsx';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  /** Render bare, without the wcard-style border — use inside a WCard. */
  bare?: boolean;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  loading = false,
  emptyMessage = 'Nothing here yet.',
  className,
  bare = false,
}: TableProps<T>) {
  const table = (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              style={{ width: col.width }}
              className={clsx(
                'text-left text-[10.5px] font-bold tracking-[0.08em] uppercase text-[#6E5B4B] pb-2.5 px-3.5 border-b border-[#EDE4D9] whitespace-nowrap',
                col.align === 'center' && 'text-center',
                col.align === 'right' && 'text-right'
              )}
              scope="col"
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={columns.length} className="py-10 text-center text-[#9A8878]">
              <div className="flex justify-center">
                <div className="w-5 h-5 border-2 border-[#4A1E0B] border-t-transparent rounded-full animate-spin" />
              </div>
            </td>
          </tr>
        ) : data.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="py-10 text-center text-[#9A8878] text-sm">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          data.map((row, index) => (
            <tr
              key={keyExtractor(row, index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(
                'transition-colors duration-100 [&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-[#EDE4D9]',
                onRowClick && 'cursor-pointer hover:bg-[#F9F1E9]'
              )}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') onRowClick(row);
                    }
                  : undefined
              }
              role={onRowClick ? 'button' : 'row'}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx(
                    'py-[13px] px-3.5 align-middle text-[#1C1006]',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right'
                  )}
                >
                  {col.render(row, index)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  if (bare) return <div className={clsx('overflow-x-auto -mx-[18px] px-[18px]', className)}>{table}</div>;

  return (
    <div className={clsx('overflow-x-auto rounded-[14px] border border-[#EDE4D9] bg-white px-[18px] py-1', className)}>
      {table}
    </div>
  );
}

export function TableId({ children }: { children: React.ReactNode }) {
  return <span className="font-extrabold text-[12.5px]" style={{ fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>{children}</span>;
}

export function TableStrong({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold">{children}</span>;
}
