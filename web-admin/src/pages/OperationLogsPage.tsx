import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import { Alert, Button } from '@heroui/react'

import { ADMIN_API_PREFIX, apiRequest } from '../api/client'
import { apiDownloadBinary, buildExportFilename, triggerFileDownload } from '../api/download'
import {
  ERR_FORBIDDEN,
  type OperationLogListItem,
  type OperationLogListResp,
} from '../api/types'
import { useAuth } from '../auth/authContext'
import { PageToolbar } from '../components/PageToolbar'
import { ListPaginationFooter } from '../components/ListPaginationFooter'
import { type ResponsiveColumn, ResponsiveDataTable } from '../components/ResponsiveDataTable'
import { AnimatePresence, motion, motionTokens } from '../components/motionConfig'
import type { AdminLayoutOutletContext } from '../layouts/AdminLayout'
import { useTablePageSize } from '../prefs/workspace'

export function OperationLogsPage() {
  const { user, refreshProfile } = useAuth()
  const { setDashboardRefresh } = useOutletContext<AdminLayoutOutletContext>()
  const canRead = user?.permissions?.includes('system:audit:read')
  const pageSize = useTablePageSize()

  const [page, setPage] = useState(1)
  const [list, setList] = useState<OperationLogListResp['list']>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

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
  }, [canRead, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  useEffect(() => {
    setDashboardRefresh(() => load)
    return () => setDashboardRefresh(null)
  }, [load, setDashboardRefresh])

  useEffect(() => {
    void refreshProfile().catch(() => {})
  }, [refreshProfile])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const exportXlsx = useCallback(async () => {
    if (!canRead || exporting) return
    setExporting(true)
    setExportError(null)
    const exportLimit = Math.min(50_000, total > 0 ? total : 10_000)
    const qs = new URLSearchParams({ limit: String(exportLimit) })
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
  }, [canRead, exporting, total])

  const columns = useMemo((): ResponsiveColumn<OperationLogListItem>[] => {
    return [
      {
        id: 'created_at',
        header: '时间',
        cellClassName: 'max-w-[9rem] whitespace-nowrap tabular-nums text-[color:var(--muted)]',
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
          <span className="rounded-md bg-[color:var(--accent)]/12 px-1.5 py-0.5 font-mono text-xs font-semibold text-[color:var(--accent)]">
            {row.method}
          </span>
        ),
      },
      {
        id: 'path',
        header: '路径',
        cellClassName: 'max-w-[20rem] font-mono text-xs text-[color:var(--muted)]',
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
                ? 'text-[color:var(--accent)]'
                : row.status_code >= 400
                  ? 'text-[color:var(--danger)]'
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
        cellClassName: 'tabular-nums text-[color:var(--muted)]',
        render: (row) => row.duration_ms,
      },
      {
        id: 'ip',
        header: 'IP',
        cellClassName: 'max-w-[9rem] font-mono text-xs text-[color:var(--muted)]',
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
