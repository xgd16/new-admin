import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import { Alert, Button, Input, Label, ListBox, Select, Text } from '@heroui/react'

import { ADMIN_API_PREFIX, apiRequest } from '../api/client'
import { apiDownloadBinary, buildExportFilename, triggerFileDownload } from '../api/download'
import {
  ERR_FORBIDDEN,
  type OperationLogListItem,
  type OperationLogListResp,
  type OperationLogStatsResp,
} from '../api/types'
import { useAuth } from '../auth/authContext'
import { PageToolbar } from '../components/PageToolbar'
import { ListPaginationFooter } from '../components/ListPaginationFooter'
import { type ResponsiveColumn, ResponsiveDataTable } from '../components/ResponsiveDataTable'
import { AnimatePresence, motion, motionTokens } from '../components/motionConfig'
import type { AdminLayoutOutletContext } from '../layouts/AdminLayout'
import { useTablePageSize } from '../prefs/workspace'

const OPLOG_SEARCH_OPTIONS = [
  { id: 'all', label: '全部字段' },
  { id: 'username', label: '用户名' },
  { id: 'path', label: '路径' },
  { id: 'query', label: '查询串' },
  { id: 'method', label: 'HTTP 方法' },
  { id: 'ip', label: 'IP' },
  { id: 'user_agent', label: 'User-Agent' },
  { id: 'status', label: 'HTTP 状态码' },
  { id: 'user_id', label: '用户 ID' },
] as const

type OpLogSearchFieldId = (typeof OPLOG_SEARCH_OPTIONS)[number]['id']

function isOpLogSearchFieldId(s: string): s is OpLogSearchFieldId {
  return OPLOG_SEARCH_OPTIONS.some((o) => o.id === s)
}

/** 与列表「操作」列已登记类型对应（其余归为「其他」仅能通过关键词搜路径等） */
const OPLOG_OPERATION_OPTIONS = [
  { id: 'all', label: '全部操作' },
  { id: 'auth_login', label: '登录后台' },
  { id: 'system_user_create', label: '新建后台用户' },
  { id: 'system_user_update', label: '编辑后台用户' },
  { id: 'system_role_create', label: '新建角色' },
  { id: 'system_role_permissions', label: '更新角色权限' },
  { id: 'front_user_create', label: '新建前台用户' },
  { id: 'front_user_update', label: '编辑前台用户' },
] as const

type OpLogOperationId = (typeof OPLOG_OPERATION_OPTIONS)[number]['id']

function isOpLogOperationId(s: string): s is OpLogOperationId {
  return OPLOG_OPERATION_OPTIONS.some((o) => o.id === s)
}

/** 本地展示：`YYYY-MM-DD HH:mm:ss`（避免 RFC3339 在窄宽度下断行难看） */
function formatOpLogDateTime(raw: string): string {
  const t = Date.parse(raw)
  if (Number.isNaN(t)) {
    const head = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim())
    return head ? head[1] : raw
  }
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 按日趋势：`YYYY-MM-DD` */
function formatOpLogDateOnly(raw: string): string {
  const t = Date.parse(raw)
  if (Number.isNaN(t)) {
    const head = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim())
    return head ? head[1] : raw
  }
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function OperationLogsPage() {
  const { user, refreshProfile } = useAuth()
  const { setDashboardRefresh } = useOutletContext<AdminLayoutOutletContext>()
  const canRead = user?.permissions?.includes('system:audit:read')
  const pageSize = useTablePageSize()

  const [page, setPage] = useState(1)
  const [prevPageSize, setPrevPageSize] = useState(pageSize)
  if (pageSize !== prevPageSize) {
    setPrevPageSize(pageSize)
    setPage(1)
  }
  const [list, setList] = useState<OperationLogListResp['list']>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [statsDays, setStatsDays] = useState(14)
  const [stats, setStats] = useState<OperationLogStatsResp | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  const [draftQ, setDraftQ] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [draftField, setDraftField] = useState<OpLogSearchFieldId>('all')
  const [appliedField, setAppliedField] = useState<OpLogSearchFieldId>('all')
  const [draftOperation, setDraftOperation] = useState<OpLogOperationId>('all')
  const [appliedOperation, setAppliedOperation] = useState<OpLogOperationId>('all')

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false)
      setList([])
      setTotal(0)
      setListError('当前账号缺少 system:audit:read 权限')
      return
    }
    setLoading(true)
    setListError(null)
    const qs = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    const q = appliedQ.trim()
    if (q) {
      qs.set('q', q)
      if (appliedField !== 'all') qs.set('field', appliedField)
    }
    if (appliedOperation !== 'all') qs.set('operation', appliedOperation)
    const { envelope, httpStatus } = await apiRequest<OperationLogListResp>(
      `${ADMIN_API_PREFIX}/system/operation-logs?${qs.toString()}`,
      { method: 'GET' },
    )
    setLoading(false)
    if (envelope.code === 0) {
      setList(envelope.data.list)
      setTotal(envelope.data.total)
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setListError('无权查看操作日志')
      setList([])
      setTotal(0)
      return
    }
    setListError(envelope.message || '加载失败')
  }, [canRead, page, pageSize, appliedQ, appliedField, appliedOperation])

  const loadStats = useCallback(async () => {
    if (!canRead) {
      setStatsLoading(false)
      setStats(null)
      setStatsError(null)
      return
    }
    setStatsLoading(true)
    setStatsError(null)
    const qs = new URLSearchParams({ days: String(statsDays) })
    const { envelope, httpStatus } = await apiRequest<OperationLogStatsResp>(
      `${ADMIN_API_PREFIX}/system/operation-logs/stats?${qs.toString()}`,
      { method: 'GET' },
    )
    setStatsLoading(false)
    if (envelope.code === 0) {
      setStats(envelope.data)
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setStatsError('无权查看统计数据')
      setStats(null)
      return
    }
    setStatsError(envelope.message || '统计加载失败')
    setStats(null)
  }, [canRead, statsDays])

  useEffect(() => {
    const t = window.setTimeout(() => void loadStats(), 0)
    return () => window.clearTimeout(t)
  }, [loadStats])

  const statsDayMax = useMemo(() => {
    const byDay = stats?.by_day
    if (!byDay?.length) return 1
    return Math.max(1, ...byDay.map((d) => d.count))
  }, [stats])

  const keywordPlaceholder = useMemo(() => {
    switch (draftField) {
      case 'username':
        return '输入用户名片段…'
      case 'path':
        return '路径片段，例如 /admin/v1/system/users'
      case 'query':
        return 'URL 查询串片段…'
      case 'method':
        return 'GET / POST / PATCH …'
      case 'ip':
        return 'IP 或片段…'
      case 'user_agent':
        return '浏览器或客户端标识片段…'
      case 'status':
        return '例如 200、404、500'
      case 'user_id':
        return '数字用户 ID（支持精确或片段）'
      default:
        return '用户名、路径、方法、IP、状态码等（全部字段模糊匹配）'
    }
  }, [draftField])

  const applySearch = () => {
    setAppliedQ(draftQ.trim())
    setAppliedField(draftField)
    setAppliedOperation(draftOperation)
    setPage(1)
  }

  const resetFilters = () => {
    setDraftQ('')
    setAppliedQ('')
    setDraftField('all')
    setAppliedField('all')
    setDraftOperation('all')
    setAppliedOperation('all')
    setPage(1)
  }

  useEffect(() => {
    setDashboardRefresh(() => {
      void load()
      void loadStats()
    })
    return () => setDashboardRefresh(null)
  }, [load, loadStats, setDashboardRefresh])

  useEffect(() => {
    void refreshProfile().catch(() => {})
  }, [refreshProfile])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(t)
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const exportXlsx = useCallback(async () => {
    if (!canRead || exporting) return
    setExporting(true)
    setExportError(null)
    const exportLimit = Math.min(50_000, total > 0 ? total : 10_000)
    const qs = new URLSearchParams({ limit: String(exportLimit) })
    const q = appliedQ.trim()
    if (q) {
      qs.set('q', q)
      if (appliedField !== 'all') qs.set('field', appliedField)
    }
    if (appliedOperation !== 'all') qs.set('operation', appliedOperation)
    const fallbackFilename = buildExportFilename('operation_logs', 'xlsx')
    const res = await apiDownloadBinary(`${ADMIN_API_PREFIX}/system/operation-logs/export?${qs.toString()}`, {
      method: 'GET',
      fallbackFilename,
    })
    setExporting(false)
    if (!res.ok) {
      setExportError(res.message)
      return
    }
    triggerFileDownload(res.blob, res.filename.endsWith('.xlsx') ? res.filename : `${res.filename}.xlsx`)
  }, [canRead, exporting, total, appliedQ, appliedField, appliedOperation])

  const listTotalCaption = useMemo(() => {
    const hasQ = appliedQ.trim().length > 0
    const hasOp = appliedOperation !== 'all'
    if (!hasQ && !hasOp) return '全库累计（列表分页总量）'
    if (hasOp && !hasQ) return '当前操作类型 · 列表总条数'
    if (hasQ && appliedField !== 'all') return '指定字段 · 列表总条数'
    return '当前搜索 · 列表总条数'
  }, [appliedQ, appliedField, appliedOperation])

  const columns = useMemo((): ResponsiveColumn<OperationLogListItem>[] => {
    return [
      {
        id: 'created_at',
        header: '时间',
        cellClassName: 'max-w-[9rem] whitespace-nowrap tabular-nums text-muted',
        render: (row) => (row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '—'),
      },
      {
        id: 'user',
        header: '用户',
        cellClassName: 'max-w-[7rem] font-medium',
        render: (row) => <span className="line-clamp-2">{row.username || `#${row.user_id}`}</span>,
      },
      {
        id: 'summary',
        header: '操作',
        headerClassName: 'min-w-[8rem]',
        cellClassName: 'max-w-[11rem] font-medium',
        mobile: 'title',
        render: (row) => <span className="line-clamp-2">{row.summary}</span>,
      },
      {
        id: 'method',
        header: '方法',
        render: (row) => (
          <span className="rounded-md bg-(--accent)/12 px-1.5 py-0.5 font-mono text-xs font-semibold text-(--accent)">
            {row.method}
          </span>
        ),
      },
      {
        id: 'path',
        header: '路径',
        cellClassName: 'max-w-[20rem] font-mono text-xs text-muted',
        render: (row) => (
          <>
            <span className="line-clamp-2">{row.path}</span>
            {row.query ? <span className="mt-1 line-clamp-1 block opacity-75">?{row.query}</span> : null}
          </>
        ),
      },
      {
        id: 'status_code',
        header: 'HTTP',
        cellClassName: 'tabular-nums',
        render: (row) => (
          <span
            className={
              row.status_code >= 200 && row.status_code < 300
                ? 'text-(--accent)'
                : row.status_code >= 400
                  ? 'text-(--danger)'
                  : ''
            }
          >
            {row.status_code}
          </span>
        ),
      },
      {
        id: 'duration_ms',
        header: '耗时 ms',
        cellClassName: 'tabular-nums text-muted',
        render: (row) => row.duration_ms,
      },
      {
        id: 'ip',
        header: 'IP',
        cellClassName: 'max-w-[9rem] font-mono text-xs text-muted',
        render: (row) => row.ip,
      },
    ]
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <PageToolbar
        title="操作日志"
        description="记录后台写类请求及成功登录；列表「操作」列为中文摘要，技术细节见方法与路径（不含请求体）"
        action={
          canRead ? (
            <Button variant="secondary" isDisabled={exporting} onPress={() => void exportXlsx()}>
              {exporting ? '导出中…' : '导出 Excel'}
            </Button>
          ) : null
        }
      />

      <AnimatePresence>
        {exportError ? (
          <motion.div {...motionTokens.item} exit={{ opacity: 0, y: -8 }}>
            <Alert status="danger">
              <Alert.Content>
                <Alert.Title>导出失败</Alert.Title>
                <Alert.Description>{exportError}</Alert.Description>
              </Alert.Content>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {listError ? (
          <motion.div {...motionTokens.item} exit={{ opacity: 0, y: -8 }}>
            <Alert status="danger">
              <Alert.Content>
                <Alert.Title>加载异常</Alert.Title>
                <Alert.Description>{listError}</Alert.Description>
              </Alert.Content>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {statsError && canRead ? (
          <motion.div {...motionTokens.item} exit={{ opacity: 0, y: -8 }}>
            <Alert status="danger">
              <Alert.Content>
                <Alert.Title>统计加载异常</Alert.Title>
                <Alert.Description>{statsError}</Alert.Description>
              </Alert.Content>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {canRead ? (
        <motion.article className="glass-card rounded-xl p-4 sm:p-5" {...motionTokens.panel}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-bold tracking-tight">数据统计</h2>
              <Text className="mt-1" size="sm" variant="muted">
                {stats && !statsLoading ? (
                  <>
                    近 {stats.days} 个自然日 · 自{' '}
                    <span className="whitespace-nowrap tabular-nums">{formatOpLogDateTime(stats.since)}</span>
                    {' '}起至当前
                  </>
                ) : statsLoading ? (
                  '正在加载统计…'
                ) : (
                  '—'
                )}
              </Text>
            </div>
            <div className="flex flex-wrap gap-2">
              {([7, 14, 30, 90] as const).map((d) => (
                <Button
                  key={d}
                  className="min-w-18"
                  variant={statsDays === d ? 'primary' : 'secondary'}
                  onPress={() => setStatsDays(d)}
                >
                  {d} 天
                </Button>
              ))}
            </div>
          </div>

          {statsLoading ? (
            <Text variant="muted">统计加载中…</Text>
          ) : stats ? (
            <div className="flex flex-col gap-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-(--surface-soft)/45 px-4 py-3">
                  <Text size="sm" variant="muted">
                    窗口内操作数
                  </Text>
                  <div className="mt-1 text-2xl font-black tabular-nums">{stats.total_in_range}</div>
                </div>
                <div className="rounded-xl border border-border bg-(--surface-soft)/45 px-4 py-3">
                  <Text size="sm" variant="muted">
                    平均耗时
                  </Text>
                  <div className="mt-1 text-2xl font-black tabular-nums">
                    {Math.round(stats.avg_duration_ms)} ms
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-(--surface-soft)/45 px-4 py-3 sm:col-span-2 lg:col-span-2">
                  <Text size="sm" variant="muted">
                    {listTotalCaption}
                  </Text>
                  <div className="mt-1 text-2xl font-black tabular-nums">{total}</div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <Text className="mb-2 font-semibold">按 HTTP 方法</Text>
                  <div className="flex flex-wrap gap-2">
                    {stats.by_method.length ? (
                      stats.by_method.map((m) => (
                        <span
                          key={m.key}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-(--surface-strong)/80 px-2.5 py-1 font-mono text-xs font-semibold"
                        >
                          {m.key}
                          <span className="tabular-nums text-muted">{m.count}</span>
                        </span>
                      ))
                    ) : (
                      <Text size="sm" variant="muted">
                        无数据
                      </Text>
                    )}
                  </div>
                </div>
                <div>
                  <Text className="mb-2 font-semibold">按 HTTP 状态区间</Text>
                  <div className="flex flex-wrap gap-2">
                    {stats.by_status_bucket.length ? (
                      stats.by_status_bucket.map((b) => (
                        <span
                          key={b.key}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                            b.key === '4xx' || b.key === '5xx'
                              ? 'border-(--danger)/35 bg-(--danger)/10 text-(--danger)'
                              : b.key === '2xx'
                                ? 'border-(--accent)/35 bg-(--accent)/10 text-(--accent)'
                                : 'border-border bg-(--surface-strong)/80'
                          }`}
                        >
                          {b.key}
                          <span className="tabular-nums opacity-90">{b.count}</span>
                        </span>
                      ))
                    ) : (
                      <Text size="sm" variant="muted">
                        无数据
                      </Text>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Text className="mb-2 font-semibold">按日趋势</Text>
                {stats.by_day.length ? (
                  <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                    {stats.by_day.map((d) => (
                      <div key={d.date} className="flex min-h-0 items-center gap-2 text-sm">
                        <span className="w-34 shrink-0 whitespace-nowrap tabular-nums text-muted">
                          {formatOpLogDateOnly(d.date)}
                        </span>
                        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-(--border)/50">
                          <div
                            className="h-full rounded-full bg-(--accent)"
                            style={{ width: `${Math.min(100, (d.count / statsDayMax) * 100)}%` }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right tabular-nums">{d.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text size="sm" variant="muted">
                    该窗口内暂无按日数据
                  </Text>
                )}
              </div>

              <div>
                <Text className="mb-2 font-semibold">活跃用户 Top 10</Text>
                {stats.top_users.length ? (
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {stats.top_users.map((u, i) => (
                      <li
                        key={`${u.user_id}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-(--surface-soft)/40 px-3 py-2"
                      >
                        <span className="min-w-0 truncate font-medium">
                          {u.username || `#${u.user_id}`}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted">{u.count} 次</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Text size="sm" variant="muted">
                    无数据
                  </Text>
                )}
              </div>
            </div>
          ) : (
            <Text variant="muted">暂无统计数据</Text>
          )}
        </motion.article>
      ) : null}

      {canRead ? (
        <section className="glass-card flex flex-col gap-4 rounded-xl p-4 sm:p-5">
          <Text className="text-sm font-semibold">搜索</Text>
          <div className="flex flex-col gap-3">
            <div className="grid gap-4 sm:grid-cols-12 sm:items-end">
              <div className="flex flex-col gap-2 sm:col-span-12 lg:col-span-3">
                <Label id="oplog-filter-op-label" htmlFor="oplog-filter-op">
                  操作类型
                </Label>
                <Select
                  id="oplog-filter-op"
                  aria-labelledby="oplog-filter-op-label"
                  selectedKey={draftOperation}
                  onSelectionChange={(key) => {
                    if (key == null) return
                    const k = String(key)
                    if (isOpLogOperationId(k)) setDraftOperation(k)
                  }}
                  fullWidth
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {OPLOG_OPERATION_OPTIONS.map((o) => (
                        <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                          {o.label}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-6 lg:col-span-3">
                <Label id="oplog-filter-field-label" htmlFor="oplog-filter-field">
                  搜索范围
                </Label>
                <Select
                  id="oplog-filter-field"
                  aria-labelledby="oplog-filter-field-label"
                  selectedKey={draftField}
                  onSelectionChange={(key) => {
                    if (key == null) return
                    const k = String(key)
                    if (isOpLogSearchFieldId(k)) setDraftField(k)
                  }}
                  fullWidth
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {OPLOG_SEARCH_OPTIONS.map((o) => (
                        <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                          {o.label}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:col-span-6 lg:col-span-4">
                <Label htmlFor="oplog-filter-q">关键词</Label>
                <Input
                  id="oplog-filter-q"
                  placeholder={keywordPlaceholder}
                  value={draftQ}
                  onChange={(e) => setDraftQ(e.target.value)}
                  fullWidth
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applySearch()
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-12 lg:col-span-2 lg:justify-end">
                <Button variant="primary" onPress={applySearch}>
                  <i className="ri-search-line" />
                  搜索
                </Button>
                <Button variant="secondary" onPress={resetFilters}>
                  <i className="ri-refresh-line" />
                  重置
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <motion.article className="glass-card overflow-hidden rounded-xl" {...motionTokens.panel}>
        <ResponsiveDataTable
          columns={columns}
          rows={list}
          rowKey={(row) => row.id}
          minTableWidth="1080px"
          loading={loading}
          emptyText={canRead ? '暂无记录' : '—'}
        />
        <ListPaginationFooter
          loading={loading}
          page={page}
          totalItems={total}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </motion.article>
    </div>
  )
}
