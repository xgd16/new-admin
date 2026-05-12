import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import { CalendarDate } from '@internationalized/date'
import { Alert, Button, DateRangePicker, Input, Label, ListBox, RangeCalendar, Select, Separator, Spinner, Text } from '@heroui/react'
import type { RangeValue } from '@react-types/shared'
import { DateInput, DateSegment, Group } from 'react-aria-components'

import { ADMIN_API_PREFIX, apiRequest } from '../api/client'
import { ERR_FORBIDDEN, type FrontUserDetailResp, type FrontUserListItem, type FrontUserListResp } from '../api/types'
import { useAuth } from '../auth/authContext'
import { PageToolbar } from '../components/PageToolbar'
import { ListPaginationFooter } from '../components/ListPaginationFooter'
import { ResponsiveDataTable } from '../components/ResponsiveDataTable'
import { AnimatePresence, motion, motionTokens } from '../components/motionConfig'
import type { AdminLayoutOutletContext } from '../layouts/AdminLayout'
import { useTablePageSize } from '../prefs/workspace'

function StatusSelect({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <Select
      id={id}
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

export function FrontUsersPage() {
  const { user, refreshProfile } = useAuth()
  const { setDashboardRefresh } = useOutletContext<AdminLayoutOutletContext>()
  const canRead = user?.permissions?.includes('front:user:read')
  const canWrite = user?.permissions?.includes('front:user:write')
  const pageSize = useTablePageSize()

  const [page, setPage] = useState(1)
  const [prevPageSize, setPrevPageSize] = useState(pageSize)
  if (pageSize !== prevPageSize) {
    setPrevPageSize(pageSize)
    setPage(1)
  }
  const [list, setList] = useState<FrontUserListResp['list']>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [draftQ, setDraftQ] = useState('')
  const [draftStatus, setDraftStatus] = useState<'all' | '0' | '1'>('all')
  const [draftRange, setDraftRange] = useState<RangeValue<CalendarDate> | null>(null)

  const [appliedQ, setAppliedQ] = useState('')
  const [appliedStatus, setAppliedStatus] = useState<'all' | '0' | '1'>('all')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  /** 重置时递增，强制 DateRangePicker 卸载重建，避免受控值清空后内部 segment 仍残留 */
  const [dateRangePickerKey, setDateRangePickerKey] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [createUsername, setCreateUsername] = useState('')
  const [createNickname, setCreateNickname] = useState('')
  const [createMobile, setCreateMobile] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createStatus, setCreateStatus] = useState(1)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editNickname, setEditNickname] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editStatus, setEditStatus] = useState(1)
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    if (!canRead) {
      setLoading(false)
      setList([])
      setTotal(0)
      setListError('当前账号缺少 front:user:read 权限')
      return
    }
    setLoading(true)
    setListError(null)
    const qs = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    const q = appliedQ.trim()
    if (q) qs.set('q', q)
    if (appliedStatus !== 'all') qs.set('status', appliedStatus)
    if (appliedFrom) qs.set('created_from', appliedFrom)
    if (appliedTo) qs.set('created_to', appliedTo)
    const { envelope, httpStatus } = await apiRequest<FrontUserListResp>(
      `${ADMIN_API_PREFIX}/front/users?${qs.toString()}`,
      { method: 'GET' },
    )
    setLoading(false)
    if (envelope.code === 0) {
      setList(envelope.data.list)
      setTotal(envelope.data.total)
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setListError('无权查看前台用户列表')
      setList([])
      setTotal(0)
      return
    }
    setListError(envelope.message || '加载失败')
  }, [canRead, page, pageSize, appliedQ, appliedStatus, appliedFrom, appliedTo])

  useEffect(() => {
    setDashboardRefresh(() => loadUsers)
    return () => setDashboardRefresh(null)
  }, [loadUsers, setDashboardRefresh])

  useEffect(() => {
    void refreshProfile().catch(() => {})
  }, [refreshProfile])

  useEffect(() => {
    const t = window.setTimeout(() => void loadUsers(), 0)
    return () => window.clearTimeout(t)
  }, [loadUsers])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const applySearch = () => {
    setAppliedQ(draftQ)
    setAppliedStatus(draftStatus)
    setAppliedFrom(draftRange?.start != null ? draftRange.start.toString() : '')
    setAppliedTo(draftRange?.end != null ? draftRange.end.toString() : '')
    setPage(1)
  }

  const resetFilters = () => {
    setDraftQ('')
    setDraftStatus('all')
    setDraftRange(null)
    setDateRangePickerKey((k) => k + 1)
    setAppliedQ('')
    setAppliedStatus('all')
    setAppliedFrom('')
    setAppliedTo('')
    setPage(1)
  }

  const openCreate = () => {
    setCreateError(null)
    setCreateUsername('')
    setCreateNickname('')
    setCreateMobile('')
    setCreateEmail('')
    setCreateStatus(1)
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!createUsername.trim()) {
      setCreateError('请填写用户名')
      return
    }
    setCreateBusy(true)
    setCreateError(null)
    const { envelope, httpStatus } = await apiRequest<FrontUserDetailResp>(`${ADMIN_API_PREFIX}/front/users`, {
      method: 'POST',
      body: JSON.stringify({
        username: createUsername.trim(),
        nickname: createNickname.trim(),
        mobile: createMobile.trim(),
        email: createEmail.trim(),
        status: createStatus,
      }),
    })
    setCreateBusy(false)
    if (envelope.code === 0) {
      setCreateOpen(false)
      void loadUsers()
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setCreateError('无权创建前台用户')
      return
    }
    setCreateError(envelope.message || '创建失败')
  }

  const openEdit = async (id: number) => {
    setEditError(null)
    setEditId(id)
    setEditOpen(true)
    setEditBusy(true)
    const { envelope, httpStatus } = await apiRequest<FrontUserDetailResp>(`${ADMIN_API_PREFIX}/front/users/${id}`, {
      method: 'GET',
    })
    setEditBusy(false)
    if (envelope.code === 0) {
      const d = envelope.data
      setEditUsername(d.username)
      setEditNickname(d.nickname)
      setEditMobile(d.mobile)
      setEditEmail(d.email)
      setEditStatus(d.status)
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setEditError('无权查看该前台用户')
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
    setEditBusy(true)
    setEditError(null)
    const { envelope, httpStatus } = await apiRequest<FrontUserDetailResp>(`${ADMIN_API_PREFIX}/front/users/${editId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        username: editUsername.trim(),
        nickname: editNickname.trim(),
        mobile: editMobile.trim(),
        email: editEmail.trim(),
        status: editStatus,
      }),
    })
    setEditBusy(false)
    if (envelope.code === 0) {
      setEditOpen(false)
      void loadUsers()
      return
    }
    if (httpStatus === 403 || envelope.code === ERR_FORBIDDEN) {
      setEditError('无权修改前台用户')
      return
    }
    setEditError(envelope.message || '保存失败')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageToolbar
        title="前台用户管理"
        description={`front:user:read / write · 共 ${total} 人`}
        action={
          canWrite ? (
          <Button variant="primary" onPress={openCreate}>
            <i className="ri-user-add-line" />
            新建前台用户
          </Button>
          ) : null
        }
      />

      <section className="glass-card flex flex-col gap-4 rounded-xl p-4 sm:p-5">
        <Text className="text-sm font-semibold">筛选</Text>
        <div className="grid gap-4 lg:grid-cols-12 lg:items-end">
          <div className="flex flex-col gap-2 lg:col-span-4">
            <Label htmlFor="fu-filter-q">关键词</Label>
            <Input
              id="fu-filter-q"
              placeholder="用户名 / 昵称 / 手机 / 邮箱"
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              fullWidth
            />
          </div>
          <div className="flex flex-col gap-2 lg:col-span-3">
            <Label htmlFor="fu-filter-status">状态</Label>
            <Select
              id="fu-filter-status"
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
          <div className="flex min-w-0 flex-col gap-2 lg:col-span-5">
            <Label htmlFor="fu-filter-range">创建时间</Label>
            <DateRangePicker
              key={dateRangePickerKey}
              id="fu-filter-range"
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
        <ResponsiveDataTable<FrontUserListItem>
          columns={[
            {
              id: 'id',
              header: 'ID',
              cellClassName: 'tabular-nums text-[color:var(--muted)]',
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
              id: 'nickname',
              header: '昵称',
              cellClassName: 'text-[color:var(--muted)]',
              render: (row) => row.nickname || '-',
            },
            {
              id: 'mobile',
              header: '手机号',
              cellClassName: 'text-[color:var(--muted)]',
              render: (row) => row.mobile || '-',
            },
            {
              id: 'email',
              header: '邮箱',
              cellClassName: 'text-[color:var(--muted)]',
              render: (row) => row.email || '-',
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
              id: 'created_at',
              header: '创建时间',
              cellClassName: 'text-[color:var(--muted)]',
              render: (row) => (row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '-'),
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
                    -
                  </Text>
                ),
            },
          ]}
          rows={list}
          rowKey={(row) => row.id}
          minTableWidth="760px"
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

      <FrontUserModal
        title="新建前台用户"
        idPrefix="fu-create"
        open={createOpen}
        busy={createBusy}
        error={createError}
        username={createUsername}
        nickname={createNickname}
        mobile={createMobile}
        email={createEmail}
        status={createStatus}
        onOpenChange={setCreateOpen}
        onUsernameChange={setCreateUsername}
        onNicknameChange={setCreateNickname}
        onMobileChange={setCreateMobile}
        onEmailChange={setCreateEmail}
        onStatusChange={setCreateStatus}
        onSubmit={() => void submitCreate()}
      />

      <FrontUserModal
        title={editId != null ? `编辑前台用户 #${editId}` : '编辑前台用户'}
        idPrefix="fu-edit"
        open={editOpen}
        busy={editBusy}
        loadingDetail={editBusy && !editUsername}
        error={editError}
        username={editUsername}
        nickname={editNickname}
        mobile={editMobile}
        email={editEmail}
        status={editStatus}
        onOpenChange={setEditOpen}
        onUsernameChange={setEditUsername}
        onNicknameChange={setEditNickname}
        onMobileChange={setEditMobile}
        onEmailChange={setEditEmail}
        onStatusChange={setEditStatus}
        onSubmit={() => void submitEdit()}
      />
    </div>
  )
}

function FrontUserModal({
  title,
  idPrefix,
  open,
  busy,
  loadingDetail = false,
  error,
  username,
  nickname,
  mobile,
  email,
  status,
  onOpenChange,
  onUsernameChange,
  onNicknameChange,
  onMobileChange,
  onEmailChange,
  onStatusChange,
  onSubmit,
}: {
  title: string
  idPrefix: string
  open: boolean
  busy: boolean
  /** 编辑页拉取详情中（与系统用户弹窗一致） */
  loadingDetail?: boolean
  error: string | null
  username: string
  nickname: string
  mobile: string
  email: string
  status: number
  onOpenChange: (open: boolean) => void
  onUsernameChange: (value: string) => void
  onNicknameChange: (value: string) => void
  onMobileChange: (value: string) => void
  onEmailChange: (value: string) => void
  onStatusChange: (value: number) => void
  onSubmit: () => void
}) {
  const submitLabel = idPrefix === 'fu-create' ? '创建' : '保存'

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" {...motionTokens.modalBackdrop}>
          <motion.div className="glass-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl p-5 shadow-xl sm:p-6" {...motionTokens.modalPanel}>
            <Text className="text-lg font-bold">{title}</Text>
            <Separator className="my-4" />
            <AnimatePresence>
              {error ? (
                <motion.div className="mb-4" {...motionTokens.item} exit={{ opacity: 0, y: -8 }}>
                  <Alert status="danger">
                    <Alert.Content>
                      <Alert.Description>{error}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                </motion.div>
              ) : null}
            </AnimatePresence>
            {loadingDetail ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${idPrefix}-username`}>用户名</Label>
                    <Input
                      id={`${idPrefix}-username`}
                      value={username}
                      onChange={(e) => onUsernameChange(e.target.value)}
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${idPrefix}-nickname`}>昵称</Label>
                    <Input
                      id={`${idPrefix}-nickname`}
                      value={nickname}
                      onChange={(e) => onNicknameChange(e.target.value)}
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${idPrefix}-mobile`}>手机号</Label>
                      <Input
                        id={`${idPrefix}-mobile`}
                        value={mobile}
                        onChange={(e) => onMobileChange(e.target.value)}
                        disabled={busy}
                        fullWidth
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${idPrefix}-email`}>邮箱</Label>
                      <Input
                        id={`${idPrefix}-email`}
                        value={email}
                        onChange={(e) => onEmailChange(e.target.value)}
                        disabled={busy}
                        fullWidth
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${idPrefix}-status`}>状态</Label>
                    <StatusSelect id={`${idPrefix}-status`} value={status} disabled={busy} onChange={onStatusChange} />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="secondary" isDisabled={busy} onPress={() => onOpenChange(false)}>
                    取消
                  </Button>
                  <Button variant="primary" isDisabled={busy} onPress={onSubmit}>
                    {busy ? <i className="ri-loader-4-line animate-spin" /> : null}
                    {submitLabel}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
