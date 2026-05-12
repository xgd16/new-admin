import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import { CalendarDate } from '@internationalized/date'
import { Alert, Button, DateRangePicker, Input, Label, ListBox, RangeCalendar, Select, Separator, Spinner, Text } from '@heroui/react'
import type { RangeValue } from '@react-types/shared'
import { DateInput, DateSegment, Group } from 'react-aria-components'

import { ADMIN_API_PREFIX, apiRequest } from '../api/client'
import {
  ERR_FORBIDDEN,
  type SystemRoleItem,
  type SystemUserDetailResp,
  type SystemUserListItem,
  type SystemUserListResp,
} from '../api/types'
import { useAuth } from '../auth/authContext'
import { PageToolbar } from '../components/PageToolbar'
import { ListPaginationFooter } from '../components/ListPaginationFooter'
import { ResponsiveDataTable } from '../components/ResponsiveDataTable'
import { AnimatePresence, motion, motionTokens } from '../components/motionConfig'
import type { AdminLayoutOutletContext } from '../layouts/AdminLayout'
import { useTablePageSize } from '../prefs/workspace'

function StatusSelect({
  id,
  'aria-labelledby': ariaLabelledBy,
  value,
  disabled,
  onChange,
}: {
  id: string
  'aria-labelledby'?: string
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <Select
      id={id}
      aria-labelledby={ariaLabelledBy}
      selectedKey={String(value)}
      isDisabled={disabled}
      onSelectionChange={(key) => {
        if (key != null) onChange(Number(key))
      }}
      fullWidth
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="1" textValue="启用">
            启用
          </ListBox.Item>
          <ListBox.Item id="0" textValue="禁用">
            禁用
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

function RoleSelect({
  id,
  'aria-labelledby': ariaLabelledBy,
  roles,
  value,
  disabled,
  onChange,
}: {
  id: string
  'aria-labelledby'?: string
  roles: SystemRoleItem[]
  value: number | null
  disabled?: boolean
  onChange: (value: number | null) => void
}) {
  if (roles.length === 0) {
    return (
      <div className="rounded-xl border border-border p-3">
        <Text size="sm" variant="muted">
          无法加载角色列表（需 system:role:read）
        </Text>
      </div>
    )
  }

  return (
    <Select
      id={id}
      aria-labelledby={ariaLabelledBy}
      selectedKey={value == null ? undefined : String(value)}
      isDisabled={disabled}
      onSelectionChange={(key) => {
        onChange(key == null ? null : Number(key))
      }}
      fullWidth
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {roles.map((r) => (
            <ListBox.Item key={r.id} id={String(r.id)} textValue={`${r.name} ${r.code}`}>
              <div className="flex flex-col">
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted">{r.code}</span>
              </div>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

export function SystemUsersPage() {
  const { user, refreshProfile } = useAuth()
  const { setDashboardRefresh } = useOutletContext<AdminLayoutOutletContext>()
  const canRead = user?.permissions?.includes('system:user:read')
  const canWrite = user?.permissions?.includes('system:user:write')
  const pageSize = useTablePageSize()

  const [page, setPage] = useState(1)
  const [prevPageSize, setPrevPageSize] = useState(pageSize)
  if (pageSize !== prevPageSize) {
    setPrevPageSize(pageSize)
    setPage(1)
  }
  const [list, setList] = useState<SystemUserListResp['list']>([])
  const [total, setTotal] = useState(0)
  const [rolesCatalog, setRolesCatalog] = useState<SystemRoleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [draftQ, setDraftQ] = useState('')
  const [draftStatus, setDraftStatus] = useState<'all' | '0' | '1'>('all')
  const [draftRoleKey, setDraftRoleKey] = useState<string>('all')
  const [draftRange, setDraftRange] = useState<RangeValue<CalendarDate> | null>(null)

  const [appliedQ, setAppliedQ] = useState('')
  const [appliedStatus, setAppliedStatus] = useState<'all' | '0' | '1'>('all')
  const [appliedRoleId, setAppliedRoleId] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  const [dateRangePickerKey, setDateRangePickerKey] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createStatus, setCreateStatus] = useState(1)
  const [createRoleIds, setCreateRoleIds] = useState<Set<number>>(new Set())
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editStatus, setEditStatus] = useState(1)
  const [editRoleIds, setEditRoleIds] = useState<Set<number>>(new Set())
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editLastLoginText, setEditLastLoginText] = useState<string | null>(null)

  const loadRolesCatalog = useCallback(async () => {
    const { envelope, httpStatus } = await apiRequest<SystemRoleItem[]>(`${ADMIN_API_PREFIX}/system/roles`, {
      method: 'GET',
    })
    if (envelope.code === 0 && Array.isArray(envelope.data)) {
      setRolesCatalog(envelope.data)
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setRolesCatalog([])
    }
  }, [])

  const loadUsers = useCallback(async () => {
    if (!canRead) {
      setLoading(false)
      setList([])
      setTotal(0)
      setListError('当前账号缺少 system:user:read 权限')
      return
    }
    setLoading(true)
    setListError(null)
    const qs = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    const q = appliedQ.trim()
    if (q) qs.set('q', q)
    if (appliedStatus !== 'all') qs.set('status', appliedStatus)
    if (appliedRoleId) qs.set('role_id', appliedRoleId)
    if (appliedFrom) qs.set('created_from', appliedFrom)
    if (appliedTo) qs.set('created_to', appliedTo)
    const { envelope, httpStatus } = await apiRequest<SystemUserListResp>(
      `${ADMIN_API_PREFIX}/system/users?${qs.toString()}`,
      { method: 'GET' },
    )
    setLoading(false)
    if (envelope.code === 0) {
      setList(envelope.data.list)
      setTotal(envelope.data.total)
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setListError('无权查看用户列表')
      setList([])
      setTotal(0)
      return
    }
    setListError(envelope.message || '加载失败')
  }, [canRead, page, pageSize, appliedQ, appliedStatus, appliedRoleId, appliedFrom, appliedTo])

  useEffect(() => {
    setDashboardRefresh(() => loadUsers)
    return () => setDashboardRefresh(null)
  }, [loadUsers, setDashboardRefresh])

  useEffect(() => {
    void refreshProfile().catch(() => {})
  }, [refreshProfile])

  useEffect(() => {
    const t = window.setTimeout(() => void loadRolesCatalog(), 0)
    return () => window.clearTimeout(t)
  }, [loadRolesCatalog])

  useEffect(() => {
    const t = window.setTimeout(() => void loadUsers(), 0)
    return () => window.clearTimeout(t)
  }, [loadUsers])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const applySearch = () => {
    setAppliedQ(draftQ)
    setAppliedStatus(draftStatus)
    setAppliedRoleId(draftRoleKey === 'all' ? '' : draftRoleKey)
    setAppliedFrom(draftRange?.start != null ? draftRange.start.toString() : '')
    setAppliedTo(draftRange?.end != null ? draftRange.end.toString() : '')
    setPage(1)
  }

  const resetFilters = () => {
    setDraftQ('')
    setDraftStatus('all')
    setDraftRoleKey('all')
    setDraftRange(null)
    setDateRangePickerKey((k) => k + 1)
    setAppliedQ('')
    setAppliedStatus('all')
    setAppliedRoleId('')
    setAppliedFrom('')
    setAppliedTo('')
    setPage(1)
  }

  const openCreate = () => {
    setCreateError(null)
    setCreateUsername('')
    setCreatePassword('')
    setCreateStatus(1)
    setCreateRoleIds(new Set())
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    const rid = Array.from(createRoleIds)
    if (!createUsername.trim() || createPassword.length < 6 || rid.length === 0) {
      setCreateError('请填写用户名、至少 6 位密码，并选择至少一个角色')
      return
    }
    setCreateBusy(true)
    setCreateError(null)
    const { envelope, httpStatus } = await apiRequest<SystemUserDetailResp>(`${ADMIN_API_PREFIX}/system/users`, {
      method: 'POST',
      body: JSON.stringify({
        username: createUsername.trim(),
        password: createPassword,
        status: createStatus,
        role_ids: rid,
      }),
    })
    setCreateBusy(false)
    if (envelope.code === 0) {
      setCreateOpen(false)
      void loadUsers()
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setCreateError('无权创建用户')
      return
    }
    setCreateError(envelope.message || '创建失败')
  }

  const openEdit = async (id: number) => {
    setEditError(null)
    setEditId(id)
    setEditOpen(true)
    setEditLastLoginText(null)
    setEditBusy(true)
    const { envelope, httpStatus } = await apiRequest<SystemUserDetailResp>(
      `${ADMIN_API_PREFIX}/system/users/${id}`,
      { method: 'GET' },
    )
    setEditBusy(false)
    if (envelope.code === 0) {
      const d = envelope.data
      setEditUsername(d.username)
      setEditPassword('')
      setEditStatus(d.status)
      setEditRoleIds(new Set(d.role_ids))
      setEditLastLoginText(d.last_login_at ? new Date(d.last_login_at).toLocaleString('zh-CN') : '从未登录')
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setEditError('无权查看该用户')
      return
    }
    setEditError(envelope.message || '加载用户失败')
  }

  const submitEdit = async () => {
    if (editId == null) return
    if (!editUsername.trim()) {
      setEditError('用户名不能为空')
      return
    }
    if (editRoleIds.size === 0) {
      setEditError('至少选择一个角色')
      return
    }
    const body: Record<string, unknown> = {
      username: editUsername.trim(),
      status: editStatus,
      role_ids: Array.from(editRoleIds),
    }
    if (editPassword.trim()) body.password = editPassword.trim()
    setEditBusy(true)
    setEditError(null)
    const { envelope, httpStatus } = await apiRequest<SystemUserDetailResp>(
      `${ADMIN_API_PREFIX}/system/users/${editId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    )
    setEditBusy(false)
    if (envelope.code === 0) {
      setEditOpen(false)
      void loadUsers()
      void refreshProfile().catch(() => {})
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setEditError('无权修改用户')
      return
    }
    setEditError(envelope.message || '保存失败')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageToolbar
        title="用户管理"
        description={`system:user:read / write · 共 ${total} 人`}
        action={
          canWrite ? (
          <Button variant="primary" onPress={openCreate}>
            <i className="ri-user-add-line" />
            新建用户
          </Button>
          ) : null
        }
      />

      <section className="glass-card flex flex-col gap-4 rounded-xl p-4 sm:p-5">
        <Text className="text-sm font-semibold">筛选</Text>
        <div className="grid gap-4 lg:grid-cols-12 lg:items-end">
          <div className="flex flex-col gap-2 lg:col-span-3">
            <Label htmlFor="su-filter-q">关键词</Label>
            <Input
              id="su-filter-q"
              placeholder="用户名"
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              fullWidth
            />
          </div>
          <div className="flex flex-col gap-2 lg:col-span-2">
            <Label id="su-filter-status-label" htmlFor="su-filter-status">
              状态
            </Label>
            <Select
              id="su-filter-status"
              aria-labelledby="su-filter-status-label"
              selectedKey={draftStatus}
              onSelectionChange={(key) => {
                if (key == null) return
                setDraftStatus(key as 'all' | '0' | '1')
              }}
              fullWidth
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="all" textValue="全部">
                    全部
                  </ListBox.Item>
                  <ListBox.Item id="1" textValue="启用">
                    启用
                  </ListBox.Item>
                  <ListBox.Item id="0" textValue="禁用">
                    禁用
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div className="flex flex-col gap-2 lg:col-span-3">
            <Label id="su-filter-role-label" htmlFor="su-filter-role">
              角色
            </Label>
            <Select
              id="su-filter-role"
              aria-labelledby="su-filter-role-label"
              selectedKey={draftRoleKey}
              isDisabled={rolesCatalog.length === 0}
              onSelectionChange={(key) => {
                if (key == null) return
                setDraftRoleKey(String(key))
              }}
              fullWidth
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="all" textValue="全部角色">
                    全部角色
                  </ListBox.Item>
                  {rolesCatalog.map((r) => (
                    <ListBox.Item key={r.id} id={String(r.id)} textValue={`${r.name} ${r.code}`}>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-muted">{r.code}</span>
                      </div>
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-2 lg:col-span-4">
            <Label htmlFor="su-filter-range">创建时间</Label>
            <DateRangePicker
              key={dateRangePickerKey}
              id="su-filter-range"
              value={draftRange ?? undefined}
              onChange={(v) => setDraftRange(v ?? null)}
              granularity="day"
              aria-label="按创建日期范围筛选"
              className="min-w-0 w-full max-w-full"
            >
              <Group className="group flex min-h-9 w-full min-w-0 flex-wrap items-stretch rounded-field border border-(--color-field-border) bg-field px-1.5 shadow-field outline-none transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:bg-field-hover focus-within:border-(--color-field-border-focus) focus-within:bg-(--color-field-focus) focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-0">
                <DateInput slot="start" className="inline-flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 px-1 py-1 text-sm outline-none">
                  {(segment) => <DateSegment segment={segment} className="rounded px-0.5 text-field-foreground tabular-nums outline-none focus:bg-accent focus:text-white" />}
                </DateInput>
                <DateRangePicker.RangeSeparator className="flex items-center px-1 text-field-placeholder">至</DateRangePicker.RangeSeparator>
                <DateInput slot="end" className="inline-flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 px-1 py-1 text-sm outline-none">
                  {(segment) => <DateSegment segment={segment} className="rounded px-0.5 text-field-foreground tabular-nums outline-none focus:bg-accent focus:text-white" />}
                </DateInput>
                <DateRangePicker.Trigger className="my-auto ms-auto grid size-7 shrink-0 place-items-center rounded-md border-0 bg-transparent text-field-foreground outline-none transition-colors hover:bg-field-hover focus-visible:bg-field-hover focus-visible:ring-2 focus-visible:ring-focus">
                  <DateRangePicker.TriggerIndicator />
                </DateRangePicker.Trigger>
              </Group>
              <DateRangePicker.Popover>
                <RangeCalendar>
                  <RangeCalendar.Header className="flex items-center justify-between gap-2 px-2 pt-2">
                    <RangeCalendar.NavButton slot="previous" />
                    <RangeCalendar.Heading />
                    <RangeCalendar.NavButton slot="next" />
                  </RangeCalendar.Header>
                  <RangeCalendar.Grid className="px-2 pb-2">
                    <RangeCalendar.GridHeader>
                      {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                    </RangeCalendar.GridHeader>
                    <RangeCalendar.GridBody>
                      {(date) => <RangeCalendar.Cell date={date} />}
                    </RangeCalendar.GridBody>
                  </RangeCalendar.Grid>
                </RangeCalendar>
              </DateRangePicker.Popover>
            </DateRangePicker>
          </div>
          <div className="flex flex-wrap gap-2 lg:col-span-12">
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
      </section>

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
        <ResponsiveDataTable<SystemUserListItem>
          columns={[
            {
              id: 'id',
              header: 'ID',
              cellClassName: 'tabular-nums text-muted',
              render: (row) => row.id,
            },
            {
              id: 'username',
              header: '用户名',
              mobile: 'title',
              cellClassName: 'font-medium',
              render: (row) => row.username,
            },
            {
              id: 'status',
              header: '状态',
              render: (row) => (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    row.status === 1
                      ? 'bg-accent-soft text-(--accent)'
                      : 'bg-(--danger)/10 text-(--danger)'
                  }`}
                >
                  {row.status === 1 ? '启用' : '禁用'}
                </span>
              ),
            },
            {
              id: 'roles',
              header: '角色',
              cellClassName: 'max-w-[12rem] text-muted',
              render: (row) => <span className="line-clamp-2">{row.roles?.join(', ') || '—'}</span>,
            },
            {
              id: 'created_at',
              header: '创建时间',
              cellClassName: 'text-muted',
              render: (row) => (row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '—'),
            },
            {
              id: 'last_login_at',
              header: '最后登录',
              cellClassName: 'text-muted',
              render: (row) => (row.last_login_at ? new Date(row.last_login_at).toLocaleString('zh-CN') : '—'),
            },
            {
              id: 'actions',
              header: '操作',
              headerClassName: 'text-right',
              cellClassName: 'text-right',
              mobile: 'actions',
              render: (row) =>
                canWrite ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="编辑"
                    className="flex w-full min-h-11 items-center justify-center sm:inline-flex sm:min-h-9 sm:w-auto"
                    onPress={() => void openEdit(row.id)}
                  >
                    <i className="ri-edit-line text-lg" />
                  </Button>
                ) : (
                  <Text size="sm" variant="muted">
                    —
                  </Text>
                ),
            },
          ]}
          rows={list}
          rowKey={(row) => row.id}
          minTableWidth="640px"
          loading={loading}
          emptyText="暂无数据"
        />
        <ListPaginationFooter
          loading={loading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </motion.article>

      <AnimatePresence>
        {createOpen ? (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" {...motionTokens.modalBackdrop}>
            <motion.div className="glass-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl p-5 shadow-xl sm:p-6" {...motionTokens.modalPanel}>
            <Text className="text-lg font-bold">新建用户</Text>
            <Separator className="my-4" />
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
                <Label htmlFor="su-create-user">用户名</Label>
                <Input
                  id="su-create-user"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  disabled={createBusy}
                  fullWidth
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="su-create-pass">密码（至少 6 位）</Label>
                <Input
                  id="su-create-pass"
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  disabled={createBusy}
                  fullWidth
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label id="su-create-status-label" htmlFor="su-create-status">
                  状态
                </Label>
                <StatusSelect
                  id="su-create-status"
                  aria-labelledby="su-create-status-label"
                  value={createStatus}
                  disabled={createBusy}
                  onChange={setCreateStatus}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label id="su-create-role-label" htmlFor="su-create-role">
                  角色（单选必选）
                </Label>
                <RoleSelect
                  id="su-create-role"
                  aria-labelledby="su-create-role-label"
                  roles={rolesCatalog}
                  value={Array.from(createRoleIds)[0] ?? null}
                  disabled={createBusy}
                  onChange={(roleID) => setCreateRoleIds(roleID == null ? new Set() : new Set([roleID]))}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" isDisabled={createBusy} onPress={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button variant="primary" isDisabled={createBusy} onPress={() => void submitCreate()}>
                {createBusy ? <i className="ri-loader-4-line animate-spin" /> : null}
                创建
              </Button>
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editOpen ? (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" {...motionTokens.modalBackdrop}>
            <motion.div className="glass-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl p-5 shadow-xl sm:p-6" {...motionTokens.modalPanel}>
            <Text className="text-lg font-bold">编辑用户 {editId != null ? `#${editId}` : ''}</Text>
            <Separator className="my-4" />
            <AnimatePresence>
              {editError ? (
                <motion.div className="mb-4" {...motionTokens.item} exit={{ opacity: 0, y: -8 }}>
                  <Alert status="danger">
                    <Alert.Content>
                      <Alert.Description>{editError}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                </motion.div>
              ) : null}
            </AnimatePresence>
            {editBusy && !editUsername ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1 rounded-xl border border-border bg-(--surface-strong)/40 px-3 py-2">
                    <Text size="sm" variant="muted">
                      最后登录
                    </Text>
                    <Text className="font-medium">{editLastLoginText ?? '—'}</Text>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="su-edit-user">用户名</Label>
                    <Input
                      id="su-edit-user"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      disabled={editBusy}
                      fullWidth
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="su-edit-pass">新密码（留空则不修改）</Label>
                    <Input
                      id="su-edit-pass"
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      disabled={editBusy}
                      fullWidth
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label id="su-edit-status-label" htmlFor="su-edit-status">
                      状态
                    </Label>
                    <StatusSelect
                      id="su-edit-status"
                      aria-labelledby="su-edit-status-label"
                      value={editStatus}
                      disabled={editBusy}
                      onChange={setEditStatus}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label id="su-edit-role-label" htmlFor="su-edit-role">
                      角色（单选）
                    </Label>
                    <RoleSelect
                      id="su-edit-role"
                      aria-labelledby="su-edit-role-label"
                      roles={rolesCatalog}
                      value={Array.from(editRoleIds)[0] ?? null}
                      disabled={editBusy}
                      onChange={(roleID) => setEditRoleIds(roleID == null ? new Set() : new Set([roleID]))}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="secondary" isDisabled={editBusy} onPress={() => setEditOpen(false)}>
                    取消
                  </Button>
                  <Button variant="primary" isDisabled={editBusy} onPress={() => void submitEdit()}>
                    {editBusy ? <i className="ri-loader-4-line animate-spin" /> : null}
                    保存
                  </Button>
                </div>
              </>
            )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
