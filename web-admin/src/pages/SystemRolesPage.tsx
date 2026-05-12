import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import {
  Alert,
  Button,
  Checkbox,
  Input,
  Label,
  ListBox,
  Modal,
  Separator,
  Spinner,
  Text,
} from '@heroui/react'

import { ADMIN_API_PREFIX, apiRequest } from '../api/client'
import { ERR_FORBIDDEN, type SystemPermissionItem, type SystemRoleItem } from '../api/types'
import { useAuth } from '../auth/authContext'
import { PageToolbar } from '../components/PageToolbar'
import { AnimatePresence, motion, motionTokens } from '../components/motionConfig'
import type { AdminLayoutOutletContext } from '../layouts/AdminLayout'

function permGroupLabel(code: string): string {
  const i = code.indexOf(':')
  return i === -1 ? '其他' : code.slice(0, i)
}

export function SystemRolesPage() {
  const { refreshProfile, user } = useAuth()
  const { setDashboardRefresh } = useOutletContext<AdminLayoutOutletContext>()
  const canRead = user?.permissions?.includes('system:role:read')
  const canWrite = user?.permissions?.includes('system:role:write')

  const [roles, setRoles] = useState<SystemRoleItem[]>([])
  const [permissions, setPermissions] = useState<SystemPermissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [draftCodes, setDraftCodes] = useState<Set<string>>(new Set())
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createCode, setCreateCode] = useState('')
  const [createName, setCreateName] = useState('')
  const [createPermissionCodes, setCreatePermissionCodes] = useState<Set<string>>(new Set())
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  )

  const groupedPermissions = useMemo(() => {
    const m = new Map<string, SystemPermissionItem[]>()
    for (const p of permissions) {
      const g = permGroupLabel(p.code)
      const arr = m.get(g) ?? []
      arr.push(p)
      m.set(g, arr)
    }
    const keys = [...m.keys()].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    return keys.map((k) => ({ group: k, items: (m.get(k) ?? []).sort((a, b) => a.code.localeCompare(b.code)) }))
  }, [permissions])

  const loadAll = useCallback(async () => {
    if (!canRead) {
      setLoading(false)
      setRoles([])
      setPermissions([])
      setLoadError('当前账号缺少 system:role:read 权限')
      return
    }
    setLoading(true)
    setLoadError(null)
    const [rRes, pRes] = await Promise.all([
      apiRequest<SystemRoleItem[]>(`${ADMIN_API_PREFIX}/system/roles`, { method: 'GET' }),
      apiRequest<SystemPermissionItem[]>(`${ADMIN_API_PREFIX}/system/permissions`, { method: 'GET' }),
    ])
    setLoading(false)

    if (rRes.envelope.code !== 0) {
      if (rRes.httpStatus === 403 || rRes.envelope.code === ERR_FORBIDDEN) {
        setLoadError('无权读取角色列表')
      } else {
        setLoadError(rRes.envelope.message || '加载角色失败')
      }
      setRoles([])
      setPermissions([])
      return
    }
    if (pRes.envelope.code !== 0) {
      if (pRes.httpStatus === 403 || pRes.envelope.code === ERR_FORBIDDEN) {
        setLoadError('无权读取权限列表')
      } else {
        setLoadError(pRes.envelope.message || '加载权限失败')
      }
      setRoles([])
      setPermissions([])
      return
    }

    const rList = rRes.envelope.data
    const pList = pRes.envelope.data
    setRoles(rList)
    setPermissions(pList)
    setSelectedRoleId((prev) => {
      if (prev != null && rList.some((x) => x.id === prev)) return prev
      return rList[0]?.id ?? null
    })
  }, [canRead])

  useEffect(() => {
    setDashboardRefresh(() => loadAll)
    return () => setDashboardRefresh(null)
  }, [loadAll, setDashboardRefresh])

  useEffect(() => {
    void refreshProfile().catch(() => {})
  }, [refreshProfile])

  useEffect(() => {
    const t = window.setTimeout(() => void loadAll(), 0)
    return () => window.clearTimeout(t)
  }, [loadAll])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!selectedRole) {
        setDraftCodes(new Set())
        return
      }
      setDraftCodes(new Set(selectedRole.permission_codes ?? []))
      setSaveError(null)
    }, 0)
    return () => window.clearTimeout(t)
  }, [selectedRole])

  const toggleCode = (code: string, on: boolean) => {
    setDraftCodes((prev) => {
      const n = new Set(prev)
      if (on) n.add(code)
      else n.delete(code)
      return n
    })
  }

  const openCreate = () => {
    setCreateCode('')
    setCreateName('')
    setCreatePermissionCodes(new Set())
    setCreateError(null)
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    const code = createCode.trim()
    const name = createName.trim()
    if (!code || !name) {
      setCreateError('请填写角色名称和角色编码')
      return
    }
    setCreateBusy(true)
    setCreateError(null)
    const { envelope, httpStatus } = await apiRequest<SystemRoleItem>(`${ADMIN_API_PREFIX}/system/roles`, {
      method: 'POST',
      body: JSON.stringify({
        code,
        name,
        permission_codes: Array.from(createPermissionCodes),
      }),
    })
    setCreateBusy(false)
    if (envelope.code === 0) {
      const created = envelope.data
      setRoles((prev) => [...prev, created])
      setSelectedRoleId(created.id)
      setDraftCodes(new Set(created.permission_codes ?? []))
      setCreateOpen(false)
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setCreateError('无权创建角色')
      return
    }
    setCreateError(envelope.message || '创建角色失败')
  }

  const savePermissions = async () => {
    if (selectedRoleId == null) return
    setSaveBusy(true)
    setSaveError(null)
    const { envelope, httpStatus } = await apiRequest<SystemRoleItem>(
      `${ADMIN_API_PREFIX}/system/roles/${selectedRoleId}/permissions`,
      {
        method: 'PATCH',
        body: JSON.stringify({ permission_codes: Array.from(draftCodes) }),
      },
    )
    setSaveBusy(false)
    if (envelope.code === 0) {
      const updated = envelope.data
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      void refreshProfile().catch(() => {})
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setSaveError('无权修改角色权限')
      return
    }
    setSaveError(envelope.message || '保存失败')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageToolbar
        title="角色与权限"
        description="system:role:read 查看 · system:role:write 保存权限绑定"
        action={
          canWrite ? (
          <Button variant="primary" onPress={openCreate}>
            <i className="ri-shield-user-line" />
            新建角色
          </Button>
          ) : null
        }
      />

      <AnimatePresence>
        {loadError ? (
          <motion.div {...motionTokens.item} exit={{ opacity: 0, y: -8 }}>
            <Alert status="danger">
              <Alert.Content>
                <Alert.Title>加载异常</Alert.Title>
                <Alert.Description>{loadError}</Alert.Description>
              </Alert.Content>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" className="glass-card flex justify-center rounded-xl py-16" {...motionTokens.panel}>
            <Spinner size="lg" />
          </motion.div>
        ) : (
        <motion.div
          key="content"
          className="grid items-start gap-3 sm:gap-4 lg:grid-cols-[minmax(11rem,13rem)_minmax(0,1fr)] xl:grid-cols-[minmax(12rem,14rem)_minmax(0,1fr)]"
          {...motionTokens.list}
        >
          <motion.article className="glass-card self-start rounded-xl p-3 sm:p-4" {...motionTokens.item}>
            <div className="mb-4 border-b border-border pb-3">
              <Text className="font-bold">角色</Text>
            </div>
            {roles.length === 0 ? (
              <Text size="sm" variant="muted">
                无角色数据
              </Text>
            ) : (
              <ListBox
                aria-label="角色列表"
                className="flex flex-col gap-1.5"
                selectedKeys={selectedRoleId == null ? [] : [String(selectedRoleId)]}
                selectionMode="single"
                onSelectionChange={(keys) => {
                  if (keys === 'all') return
                  const next = Array.from(keys)[0]
                  if (next != null) setSelectedRoleId(Number(next))
                }}
              >
                {roles.map((r) => (
                  <ListBox.Item
                    id={String(r.id)}
                    key={r.id}
                    textValue={`${r.name} ${r.code}`}
                    className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                      r.id === selectedRoleId
                        ? 'bg-accent-soft text-(--accent) ring-2 ring-(--accent)/25'
                        : 'hover:bg-(--surface-strong)'
                    }`}
                  >
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-muted">{r.code}</div>
                  </ListBox.Item>
                ))}
              </ListBox>
            )}
          </motion.article>

          <motion.article className="glass-card rounded-xl p-4 sm:p-5" {...motionTokens.item}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <Text className="block font-bold">{selectedRole ? selectedRole.name : '请选择角色'}</Text>
                {selectedRole ? (
                  <Text size="sm" variant="muted" className="block">
                    已选 {draftCodes.size} 项权限 · 共 {permissions.length} 项可配置
                  </Text>
                ) : null}
              </div>
              {canWrite && selectedRole ? (
                <Button variant="primary" isDisabled={saveBusy} onPress={() => void savePermissions()}>
                  {saveBusy ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-save-3-line" />}
                  保存
                </Button>
              ) : null}
            </div>

            <AnimatePresence>
              {saveError ? (
                <motion.div className="mb-4" {...motionTokens.item} exit={{ opacity: 0, y: -8 }}>
                  <Alert status="danger">
                    <Alert.Content>
                      <Alert.Description>{saveError}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {!canWrite && selectedRole ? (
              <Text className="mb-4" size="sm" variant="muted">
                当前账号无 system:role:write，仅可查看。
              </Text>
            ) : null}

            <Separator className="mb-4" />

            {!selectedRole ? (
              <Text variant="muted">在左侧选择一个角色以配置权限。</Text>
            ) : (
              <motion.div className="-m-1 flex max-h-[min(70vh,40rem)] flex-col gap-5 overflow-y-auto p-1 pr-2" {...motionTokens.list}>
                {groupedPermissions.map(({ group, items }) => (
                  <motion.div key={group} {...motionTokens.item}>
                    <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                      {group}
                    </Text>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((p) => (
                        <motion.div
                          key={p.id}
                          className={`rounded-xl border border-border p-3 text-sm ${
                            !canWrite ? 'cursor-not-allowed opacity-70' : ''
                          }`}
                          whileHover={canWrite ? { y: -2 } : undefined}
                          whileTap={canWrite ? { scale: 0.98 } : undefined}
                          transition={motionTokens.spring}
                        >
                          <Checkbox
                            isSelected={draftCodes.has(p.code)}
                            isDisabled={!canWrite || saveBusy}
                            onChange={(on) => toggleCode(p.code, on)}
                          >
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            <Checkbox.Content>
                              <span className="block font-medium">{p.name}</span>
                              <span className="mt-0.5 block font-mono text-xs text-muted">
                                {p.code}
                              </span>
                            </Checkbox.Content>
                          </Checkbox>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.article>
        </motion.div>
        )}
      </AnimatePresence>

      <Modal isOpen={createOpen} onOpenChange={setCreateOpen}>
        {/* DialogTrigger 需要 Trigger 子节点；实际打开仍由工具栏 Button + openCreate 控制 */}
        <Modal.Trigger
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none fixed left-0 top-0 size-0 overflow-hidden border-0 p-0 opacity-0"
        >
          {'\u00a0'}
        </Modal.Trigger>
        <Modal.Backdrop>
          <Modal.Container size="lg" placement="center" scroll="inside">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>新建角色</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
              <AnimatePresence>
                {createError ? (
                  <motion.div className="mb-4" {...motionTokens.item} exit={{ opacity: 0, y: -8 }}>
                    <Alert status="danger">
                      <Alert.Content>
                        <Alert.Description>{createError}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sr-create-name">角色名称</Label>
                  <Input
                    id="sr-create-name"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    disabled={createBusy}
                    fullWidth
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sr-create-code">角色编码</Label>
                  <Input
                    id="sr-create-code"
                    value={createCode}
                    onChange={(e) => setCreateCode(e.target.value)}
                    disabled={createBusy}
                    placeholder="例如 ops_admin"
                    fullWidth
                  />
                  <Text size="xs" variant="muted">
                    编码用于系统识别，创建后请保持稳定。
                  </Text>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>初始权限</Label>
                  <div className="flex max-h-56 flex-col gap-3 overflow-y-auto rounded-xl border border-border p-3">
                    {groupedPermissions.length === 0 ? (
                      <Text size="sm" variant="muted">
                        暂无可选权限
                      </Text>
                    ) : (
                      groupedPermissions.map(({ group, items }) => (
                        <div key={group}>
                          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                            {group}
                          </Text>
                          <div className="flex flex-col gap-2">
                            {items.map((p) => (
                              <Checkbox
                                key={p.id}
                                isSelected={createPermissionCodes.has(p.code)}
                                isDisabled={createBusy}
                                onChange={(on) =>
                                    setCreatePermissionCodes((prev) => {
                                      const next = new Set(prev)
                                      if (on) next.add(p.code)
                                      else next.delete(p.code)
                                      return next
                                    })
                                }
                              >
                                <Checkbox.Control>
                                  <Checkbox.Indicator />
                                </Checkbox.Control>
                                <Checkbox.Content>
                                  <span className="block font-medium">{p.name}</span>
                                  <span className="mt-0.5 block font-mono text-xs text-muted">
                                    {p.code}
                                  </span>
                                </Checkbox.Content>
                              </Checkbox>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" isDisabled={createBusy} onPress={() => setCreateOpen(false)}>
                  取消
                </Button>
                <Button variant="primary" isDisabled={createBusy} onPress={() => void submitCreate()}>
                  {createBusy ? <i className="ri-loader-4-line animate-spin" /> : null}
                  创建
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  )
}
