import type { ReactNode } from 'react'

import { Spinner } from '@heroui/react'

import { motion, motionTokens } from './motionConfig'

/** 列在移动端的展示方式：stack 键值列表；title 卡片顶部主标题；actions 底部分隔全宽；omit 隐藏 */
export type ResponsiveColumnMobile = 'stack' | 'title' | 'actions' | 'omit'

export type ResponsiveColumn<T> = {
  id: string
  header: string
  headerClassName?: string
  cellClassName?: string
  render: (row: T) => ReactNode
  mobile?: ResponsiveColumnMobile
}

export type ResponsiveDataTableProps<T> = {
  columns: ResponsiveColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  /** 桌面表格 min-width，例如 min-w-[1080px] 对应 '1080px' */
  minTableWidth?: string
  loading?: boolean
  emptyText?: string
  /** 附加到桌面端 tbody 每行 */
  desktopRowClassName?: string
}

const defaultDesktopRow =
  'border-b border-[color:var(--border)]/80 last:border-b-0 hover:bg-[color:var(--surface-strong)]/50'

/**
 * 响应式数据列表：≥md 为横向滚动表格，窄屏为卡片式键值列表，避免手机端横滑整表。
 */
export function ResponsiveDataTable<T>({
  columns,
  rows,
  rowKey,
  minTableWidth = '640px',
  loading,
  emptyText = '暂无数据',
  desktopRowClassName = '',
}: ResponsiveDataTableProps<T>) {
  const titleCol = columns.find((c) => c.mobile === 'title')
  const stackCols = columns.filter((c) => (c.mobile ?? 'stack') === 'stack')
  const actionCols = columns.filter((c) => c.mobile === 'actions')

  const mobileState = (
    <div className="px-3 py-10 text-center text-[color:var(--muted)]">
      {loading ? (
        <div className="flex flex-col items-center gap-2">
          <Spinner size="md" />
          <span>加载中…</span>
        </div>
      ) : (
        emptyText
      )}
    </div>
  )

  return (
    <>
      {/* 桌面：表格 */}
      <div className="hidden overflow-x-auto md:block">
        <table
          className="w-full border-collapse text-left text-sm"
          style={{ minWidth: minTableWidth }}
        >
          <thead>
            <tr className="border-b border-[color:var(--border)] text-[color:var(--muted)]">
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`px-3 py-3 align-middle font-semibold sm:px-4 ${col.headerClassName ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-[color:var(--muted)]">
                  <div className="flex flex-col items-center gap-2">
                    <Spinner size="md" />
                    <span>加载中…</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-[color:var(--muted)]">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <motion.tr
                  key={rowKey(row)}
                  className={`${defaultDesktopRow} ${desktopRowClassName}`.trim()}
                  {...motionTokens.item}
                >
                  {columns.map((col) => (
                    <td key={col.id} className={`px-3 py-2.5 align-middle sm:px-4 sm:py-3 ${col.cellClassName ?? ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 移动端：卡片列表 */}
      <div className="md:hidden">
        {loading || rows.length === 0 ? (
          mobileState
        ) : (
          <div className="flex flex-col gap-3 p-3">
            {rows.map((row) => (
              <motion.article
                key={rowKey(row)}
                className="rounded-xl border border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--surface)_65%,transparent)] p-3.5 shadow-sm"
                {...motionTokens.item}
              >
                {titleCol ? (
                  <div className="border-b border-[color:var(--border)]/80 pb-2 text-base font-semibold leading-snug text-[color:var(--text)]">
                    {titleCol.render(row)}
                  </div>
                ) : null}
                <dl className={`flex flex-col gap-3 ${titleCol ? 'mt-3' : ''}`}>
                  {stackCols.map((col) => (
                    <div key={col.id} className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--faint)]">
                        {col.header}
                      </dt>
                      <dd className="mt-1 min-w-0 text-sm leading-relaxed break-words text-[color:var(--text)]">
                        {col.render(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
                {actionCols.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2 border-t border-[color:var(--border)]/80 pt-3">
                    {actionCols.map((col) => (
                      <div key={col.id} className="min-w-0">
                        {col.render(row)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
