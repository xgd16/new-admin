import { ListBox, Pagination, Select, Text } from '@heroui/react'

import {
  ALLOWED_PAGE_SIZES,
  setTablePageSize,
  type TablePageSize,
  useTablePageSize,
} from '../prefs/workspace'

/** 页码序列：多页时在中间用省略号压缩 */
export function buildPaginationItems(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages < 1) return []
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1])
  for (const p of [...pages]) {
    if (p < 1 || p > totalPages) pages.delete(p)
  }
  const sorted = [...pages].sort((a, b) => a - b)
  const out: (number | 'ellipsis')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('ellipsis')
    out.push(p)
    prev = p
  }
  return out
}

export type ListPaginationFooterProps = {
  page: number
  totalPages: number
  /** 传入时摘要为「共 N 条 · 第 x / y 页」，否则为「第 x / y 页」 */
  totalItems?: number
  loading?: boolean
  onPageChange: (nextPage: number) => void
  /** 是否在摘要旁显示「每页条数」选择，与系统设置共用同一偏好 */
  pageSizeSelect?: boolean
}

/**
 * 列表卡片底部：左侧摘要 + HeroUI Pagination（页码、上一页/下一页图标）。
 */
export function ListPaginationFooter({
  page,
  totalPages,
  totalItems,
  loading,
  onPageChange,
  pageSizeSelect = true,
}: ListPaginationFooterProps) {
  const tablePageSize = useTablePageSize()
  const itemsLow = Math.max(1, totalPages)
  const safePage = Math.min(Math.max(1, page), itemsLow)
  const items = buildPaginationItems(safePage, itemsLow)

  const summary =
    totalItems != null
      ? `共 ${totalItems} 条 · 第 ${safePage} / ${itemsLow} 页`
      : `第 ${safePage} / ${itemsLow} 页`

  return (
    <div className="border-t border-[color:var(--border)]/80 px-4 py-3">
      <Pagination
        size="sm"
        aria-label="列表分页"
        className="flex w-full max-w-full flex-wrap items-center justify-between gap-3"
      >
        <Pagination.Summary className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
          <Text size="sm" variant="muted" className="tabular-nums">
            {summary}
          </Text>
          {pageSizeSelect ? (
            <Select
              aria-label="每页条数"
              selectedKey={String(tablePageSize)}
              isDisabled={loading}
              onSelectionChange={(key) => {
                if (key == null) return
                const n = Number(key)
                if ((ALLOWED_PAGE_SIZES as readonly number[]).includes(n)) {
                  setTablePageSize(n as TablePageSize)
                }
              }}
              className="w-[min(100%,9.5rem)]"
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {ALLOWED_PAGE_SIZES.map((n) => (
                    <ListBox.Item key={n} id={String(n)} textValue={`${n} 条`}>
                      {n} 条 / 页
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          ) : null}
        </Pagination.Summary>
        <Pagination.Content className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-0.5 sm:flex-initial">
          <Pagination.Item>
            <Pagination.Previous
              aria-label="上一页"
              isDisabled={safePage <= 1 || loading}
              onPress={() => onPageChange(Math.max(1, safePage - 1))}
            >
              <Pagination.PreviousIcon />
            </Pagination.Previous>
          </Pagination.Item>
          {items.map((entry, idx) =>
            entry === 'ellipsis' ? (
              <Pagination.Item key={`ellipsis-${idx}`}>
                <Pagination.Ellipsis />
              </Pagination.Item>
            ) : (
              <Pagination.Item key={entry}>
                <Pagination.Link
                  aria-label={`第 ${entry} 页`}
                  isActive={entry === safePage}
                  isDisabled={loading}
                  onPress={() => onPageChange(entry)}
                >
                  {entry}
                </Pagination.Link>
              </Pagination.Item>
            ),
          )}
          <Pagination.Item>
            <Pagination.Next
              aria-label="下一页"
              isDisabled={safePage >= itemsLow || loading}
              onPress={() => onPageChange(Math.min(itemsLow, safePage + 1))}
            >
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    </div>
  )
}
