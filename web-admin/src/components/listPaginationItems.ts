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
