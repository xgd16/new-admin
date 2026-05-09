import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import { Alert, Chip, Separator, Text } from '@heroui/react'

import { ADMIN_API_PREFIX, apiRequest } from '../api/client'
import { useAuth } from '../auth/authContext'
import { AnimatePresence, motion, motionTokens } from '../components/motionConfig'
import type { AdminLayoutOutletContext } from '../layouts/AdminLayout'

type OverviewMetric = {
  label: string
  value: string
  hint: string
  icon: string
  tone: string
}

type OverviewPayload = {
  title: string
  message: string
  metrics?: OverviewMetric[]
}

const loadingPlaceholders: OverviewMetric[] = [
  { label: '…', value: '—', hint: '加载中', icon: 'ri-loader-4-line', tone: 'var(--muted)' },
  { label: '…', value: '—', hint: '加载中', icon: 'ri-loader-4-line', tone: 'var(--muted)' },
  { label: '…', value: '—', hint: '加载中', icon: 'ri-loader-4-line', tone: 'var(--muted)' },
  { label: '…', value: '—', hint: '加载中', icon: 'ri-loader-4-line', tone: 'var(--muted)' },
]

export function OverviewPage() {
  const { user, refreshProfile } = useAuth()
  const { setDashboardRefresh } = useOutletContext<AdminLayoutOutletContext>()
  const [overview, setOverview] = useState<OverviewPayload | null>(null)
  const [ovError, setOvError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setOvError(null)
    const { envelope, httpStatus } = await apiRequest<OverviewPayload>(
      `${ADMIN_API_PREFIX}/dashboard/overview`,
      { method: 'GET' },
    )
    setLoading(false)
    if (envelope.code === 0) {
      setOverview(envelope.data)
      return
    }
    if (httpStatus === 403 || envelope.code === 40301) {
      setOvError('无权访问控制台接口（缺少 dashboard:view 权限）')
      setOverview(null)
      return
    }
    setOvError(envelope.message || '加载失败')
  }, [])

  useEffect(() => {
    setDashboardRefresh(() => load)
    return () => setDashboardRefresh(null)
  }, [load, setDashboardRefresh])

  useEffect(() => {
    void refreshProfile().catch(() => {})
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load, refreshProfile])

  const displayMetrics =
    loading && (!overview?.metrics || overview.metrics.length === 0)
      ? loadingPlaceholders
      : (overview?.metrics ?? [])

  return (
    <>
      <motion.div
        className="grid gap-3 sm:grid-cols-2 sm:gap-4 2xl:grid-cols-4"
        {...motionTokens.list}
      >
        {displayMetrics.map((metric, idx) => (
          <motion.article
            key={`${metric.label}-${idx}`}
            className="glass-card overflow-hidden rounded-xl p-4 sm:p-5"
            {...motionTokens.item}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Text size="sm" variant="muted">
                  {metric.label}
                </Text>
                <div className="text-2xl font-black tracking-tight sm:text-3xl">{metric.value}</div>
              </div>
              <span className="icon-badge" style={{ color: metric.tone }}>
                <i className={`${metric.icon} text-xl`} />
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[color:var(--accent-3)]/15 px-2.5 py-1 text-xs font-semibold text-[color:var(--accent-3)]">
                {metric.hint}
              </span>
            </div>
          </motion.article>
        ))}
      </motion.div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:gap-5">
        <motion.article className="glass-card rounded-xl p-4 sm:p-5" {...motionTokens.item}>
            <div className="mb-4 flex items-center justify-between">
              <Text className="text-lg font-bold">当前身份</Text>
              <i className="ri-user-star-line text-xl text-[color:var(--accent)]" />
            </div>
            <div className="flex items-center gap-3">
              <div className="grid size-14 place-items-center rounded-xl bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-2)] text-xl font-black text-white">
                {(user?.username || 'A').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Text className="block font-bold">{user?.username || '未加载'}</Text>
                <Text size="sm" variant="muted" className="block">
                  {user?.roles?.length ? user.roles.join(' · ') : '暂无角色'}
                </Text>
              </div>
            </div>
            <Separator className="my-4" />
            <Text size="xs" variant="muted">
              服务端使用 JWT 载荷中的用户 ID，对每个受保护路由按 RBAC 表校验权限码。
            </Text>
          </motion.article>

          <motion.article className="glass-card rounded-xl p-4 sm:p-5" {...motionTokens.item}>
            <div className="mb-4 flex items-center justify-between">
              <Text className="text-lg font-bold">权限清单</Text>
              <span className="rounded-full bg-[color:var(--accent)]/15 px-2.5 py-1 text-xs font-semibold text-[color:var(--accent)]">
                {user?.permissions?.length || 0} 项
              </span>
            </div>
            {user?.permissions?.length ? (
              <div className="flex flex-wrap gap-2">
                {user.permissions.map((p) => (
                  <Chip key={p}>
                    <i className="ri-key-2-line" />
                    {p}
                  </Chip>
                ))}
              </div>
            ) : (
              <Text variant="muted" size="sm">
                暂无（请确认已登录并完成迁移）
              </Text>
            )}
          </motion.article>

          <AnimatePresence>
            {ovError ? (
              <motion.div className="sm:col-span-2" {...motionTokens.item} exit={{ opacity: 0, y: -8 }}>
                <Alert status="danger">
                  <Alert.Content>
                    <Alert.Title>无法加载控制台接口</Alert.Title>
                    <Alert.Description>{ovError}</Alert.Description>
                  </Alert.Content>
                </Alert>
              </motion.div>
            ) : null}
          </AnimatePresence>
      </div>
    </>
  )
}
