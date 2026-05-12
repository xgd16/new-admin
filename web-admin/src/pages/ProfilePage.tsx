import { Button, Separator, Text } from '@heroui/react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/authContext'
import { motion, motionTokens } from '../components/motionConfig'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
      <Text className="shrink-0 text-xs font-semibold uppercase tracking-wider text-[color:var(--faint)] sm:w-28">
        {label}
      </Text>
      <Text className="min-w-0 break-all text-sm">{value}</Text>
    </div>
  )
}

export function ProfilePage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    void refreshProfile().catch(() => {})
  }, [refreshProfile])

  const rolesLine = user?.roles?.length ? user.roles.join(' · ') : '—'
  const permCount = user?.permissions?.length ?? 0

  return (
    <motion.section
      className="glass-panel rounded-xl p-6 sm:p-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionTokens.softSpring}
    >
      <div className="flex max-w-2xl flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
        <div
          className="grid size-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-2)] text-2xl font-bold text-white shadow-[0_16px_40px_var(--glow)] sm:size-24 sm:text-3xl"
          aria-hidden
        >
          {(user?.username || 'A').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <Text className="text-lg font-semibold">个人中心</Text>
          <Text size="sm" variant="muted" className="mt-1">
            查看当前登录账号的基本信息与权限。修改密码、偏好主题等可在系统设置中操作。
          </Text>
        </div>
      </div>

      <Separator className="my-8" />

      <div className="flex flex-col gap-6">
        <InfoRow label="用户 ID" value={user?.id != null ? String(user.id) : '—'} />
        <InfoRow label="登录名" value={user?.username?.trim() || '—'} />
        <InfoRow label="角色" value={rolesLine} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <Text className="shrink-0 text-xs font-semibold uppercase tracking-wider text-[color:var(--faint)] sm:w-28 sm:pt-0.5">
            权限码
          </Text>
          <div className="min-w-0 flex-1">
            <Text className="text-sm">
              共 <span className="font-semibold text-[color:var(--text)]">{permCount}</span> 项
            </Text>
            {permCount > 0 ? (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 font-mono text-xs leading-relaxed text-[color:var(--muted)]">
                {user!.permissions.map((p) => (
                  <div key={p}>{p}</div>
                ))}
              </div>
            ) : (
              <Text size="sm" variant="muted" className="mt-1">
                暂无权限码
              </Text>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button variant="secondary" onPress={() => navigate('/settings')}>
          打开系统设置
        </Button>
      </div>
    </motion.section>
  )
}
