import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { Button, Modal, Popover, Text } from '@heroui/react'

import { useAuth } from '../auth/authContext'
import { MotionButton } from '../components/Motion'
import { AnimatePresence, motion, motionTokens } from '../components/motionConfig'
import {
  ADMIN_SIDEBAR_FOOTER_LINK,
  PROFILE_LEAF,
  dualSidebarSegmentForPath,
  filterNavByPermissions,
  getBackendNavRoot,
  groupHasActiveDescendant,
  type AdminNavLeaf,
  type AdminNavGroup,
  type AdminNavNode,
  type DualSidebarMainSegment,
  isNavGroup,
  navMetaForPath,
} from '../navigation/adminNav'
import { useSidebarCompact, useSidebarDualMenu, useSidebarFolded, useSidebarNavStyle } from '../prefs/workspace'
import { useTheme } from '../theme/themeContext'

export type AdminLayoutOutletContext = {
  setDashboardRefresh: (fn: (() => void) | null) => void
}

export function AdminLayout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [sidebarCompact] = useSidebarCompact()
  const [sidebarFolded, setSidebarFolded] = useSidebarFolded()
  const [sidebarDual] = useSidebarDualMenu()
  const [sidebarNavStyle] = useSidebarNavStyle()
  const location = useLocation()
  const pathname = location.pathname
  const pageMeta = navMetaForPath(pathname)
  const sidebarNavRoot = useMemo((): AdminNavGroup => {
    const root = getBackendNavRoot()
    return {
      ...root,
      children: filterNavByPermissions(root.children, user?.permissions),
    }
  }, [user?.permissions])
  const dashboardRefreshRef = useRef<(() => void) | null>(null)
  /** 非当前分组子路由时的展开状态（当前子路由恒展开） */
  const [groupManualOpen, setGroupManualOpen] = useState<Record<string, boolean>>({})
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const outletContext = useMemo(
    (): AdminLayoutOutletContext => ({
      setDashboardRefresh: (fn) => {
        dashboardRefreshRef.current = fn
      },
    }),
    [],
  )

  const sidebarIconRail = sidebarFolded && !sidebarDual
  const lgGridCols = sidebarDual
    ? 'lg:grid-cols-[auto_minmax(0,1fr)]'
    : sidebarIconRail
      ? 'lg:grid-cols-[4.75rem_minmax(0,1fr)]'
      : sidebarCompact
        ? 'lg:grid-cols-[13rem_minmax(0,1fr)]'
        : 'lg:grid-cols-[17rem_minmax(0,1fr)]'
  const asidePadRadius = sidebarIconRail
    ? 'rounded-xl p-2'
    : sidebarCompact
      ? 'rounded-xl p-3'
      : 'rounded-xl p-4'

  return (
    <main className={`app-shell admin-fixed-layout flex h-svh max-h-svh min-h-0 w-full flex-col overflow-hidden px-2 py-3 text-[color:var(--text)] sm:px-3 sm:py-5 lg:px-4 nav-style-${sidebarNavStyle}`}>
      <div className="orb orb-primary -left-32 top-10" />
      <div className="orb orb-cyan -right-24 top-24" />
      <div className="soft-grid pointer-events-none absolute inset-x-0 top-0 h-80 opacity-45" />

      <div
        className={`relative grid min-h-0 w-full min-w-0 max-w-none flex-1 grid-rows-1 gap-3 sm:gap-5 lg:items-stretch ${lgGridCols}`}
      >
        <motion.aside
          className={`glass-panel hidden h-full max-h-full min-h-0 lg:z-10 lg:flex lg:self-stretch ${sidebarDual ? 'flex-row overflow-hidden rounded-xl p-0' : `lg:flex-col lg:overflow-hidden ${asidePadRadius}`}`}
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={motionTokens.softSpring}
        >
          {sidebarDual ? (
            <DualColumnSidebar compact={sidebarCompact} navRoot={sidebarNavRoot} pathname={pathname} />
          ) : (
            <>
          {sidebarIconRail ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="grid size-10 place-items-center rounded-xl bg-[color:var(--accent)] text-lg text-white shadow-[0_16px_40px_var(--glow)]">
                <i className="ri-flashlight-line" />
              </div>
              <MotionButton
                type="button"
                title="展开完整菜单"
                aria-label="展开完整菜单"
                className="grid size-9 shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--text)]"
                onClick={() => setSidebarFolded(false)}
              >
                <i className="ri-menu-unfold-line text-lg" />
              </MotionButton>
            </div>
          ) : (
            <div className={`flex items-start justify-between gap-2 px-2 ${sidebarCompact ? 'py-2' : 'py-3'}`}>
              <div className={`flex min-w-0 flex-1 items-center ${sidebarCompact ? 'gap-2' : 'gap-3'}`}>
                <div
                  className={`grid place-items-center bg-[color:var(--accent)] text-white shadow-[0_16px_40px_var(--glow)] ${sidebarCompact ? 'size-9 rounded-xl text-lg' : 'size-11 rounded-xl text-xl'}`}
                >
                  <i className="ri-flashlight-line" />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className={`font-black tracking-[0.22em] ${sidebarCompact ? 'truncate text-xs' : 'text-lg'}`}>
                    NEXORA
                  </div>
                  {sidebarCompact ? null : (
                    <Text size="xs" variant="muted">
                      企业管理中枢
                    </Text>
                  )}
                </div>
              </div>
              <MotionButton
                type="button"
                title="仅显示图标"
                aria-label="左侧菜单仅显示图标"
                className={`hidden shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--text)] lg:grid ${sidebarCompact ? 'size-8' : 'size-9'}`}
                onClick={() => setSidebarFolded(true)}
              >
                <i className={sidebarCompact ? 'ri-menu-fold-line text-base' : 'ri-menu-fold-line text-lg'} />
              </MotionButton>
            </div>
          )}

          <nav
            className={`flex min-h-0 flex-1 flex-col ${sidebarIconRail ? 'mt-2' : sidebarCompact ? 'mt-4' : 'mt-6'}`}
          >
            <div
              className={`flex min-h-0 flex-1 flex-col overflow-y-auto pr-1 ${sidebarIconRail ? 'gap-1' : sidebarCompact ? 'gap-0.5' : 'gap-1'}`}
            >
              {sidebarNavRoot.children.map((node) =>
                isNavGroup(node) ? (
                  sidebarIconRail ? (
                    <SidebarRailGroup key={node.id} group={node} pathname={pathname} />
                  ) : (
                    <SidebarNavGroup
                      key={node.id}
                      compact={sidebarCompact}
                      group={node}
                      groupManualOpen={groupManualOpen}
                      pathname={pathname}
                      setGroupManualOpen={setGroupManualOpen}
                    />
                  )
                ) : sidebarIconRail ? (
                  <NavLink
                    key={node.path}
                    title={node.label}
                    aria-label={node.label}
                    className={({ isActive }) =>
                      `nav-item flex w-full items-center justify-center rounded-xl px-2 py-2.5 text-sm font-medium ${isActive ? 'nav-item-active' : ''}`
                    }
                    end={node.path === '/dashboard'}
                    to={node.path}
                  >
                    <i className={`${node.icon} text-lg`} />
                    <span className="sr-only">{node.label}</span>
                  </NavLink>
                ) : (
                  <NavLink
                    key={node.path}
                    className={({ isActive }) =>
                      `${sidebarCompact ? 'nav-item flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium' : 'nav-item flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium'} ${isActive ? 'nav-item-active' : ''}`
                    }
                    end={node.path === '/dashboard'}
                    to={node.path}
                  >
                    <i className={`${node.icon} ${sidebarCompact ? 'text-base' : 'text-lg'}`} />
                    <span>{node.label}</span>
                  </NavLink>
                ),
              )}
            </div>
            <div
              className={`shrink-0 border-t border-[color:var(--border)] ${sidebarIconRail ? 'mt-2 pt-2' : sidebarCompact ? 'mt-2 pt-2' : 'mt-3 pt-3'}`}
            >
              {sidebarIconRail ? (
                <NavLink
                  title={ADMIN_SIDEBAR_FOOTER_LINK.label}
                  aria-label={ADMIN_SIDEBAR_FOOTER_LINK.label}
                  className={({ isActive }) =>
                    `nav-item flex w-full items-center justify-center rounded-xl px-2 py-2.5 text-sm font-medium ${isActive ? 'nav-item-active' : ''}`
                  }
                  to={ADMIN_SIDEBAR_FOOTER_LINK.path}
                >
                  <i className={`${ADMIN_SIDEBAR_FOOTER_LINK.icon} text-lg`} />
                  <span className="sr-only">{ADMIN_SIDEBAR_FOOTER_LINK.label}</span>
                </NavLink>
              ) : (
                <NavLink
                  className={({ isActive }) =>
                    `${sidebarCompact ? 'nav-item flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium' : 'nav-item flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium'} ${isActive ? 'nav-item-active' : ''}`
                  }
                  to={ADMIN_SIDEBAR_FOOTER_LINK.path}
                >
                  <i className={`${ADMIN_SIDEBAR_FOOTER_LINK.icon} ${sidebarCompact ? 'text-base' : 'text-lg'}`} />
                  <span>{ADMIN_SIDEBAR_FOOTER_LINK.label}</span>
                </NavLink>
              )}
            </div>
          </nav>
            </>
          )}
        </motion.aside>

        <section
          className={`flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden ${sidebarCompact ? 'gap-2 sm:gap-4' : 'gap-3 sm:gap-5'}`}
        >
          <div className="shrink-0">
            <AdminHeader
              compact={sidebarCompact}
              logout={logout}
              onRefresh={() => dashboardRefreshRef.current?.()}
              pageMeta={pageMeta}
              theme={theme}
              toggleTheme={toggleTheme}
              user={user}
              mobileMenuOpen={mobileMenuOpen}
              setMobileMenuOpen={setMobileMenuOpen}
            />
          </div>

          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.nav
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={motionTokens.softSpring}
                className="shrink-0 overflow-hidden lg:hidden"
              >
                <div className="glass-panel -mx-1 mb-2 mt-1 flex flex-col gap-3 rounded-xl p-2">
                  <div className="flex items-center gap-2 px-2 pb-1 pt-1">
                    <i className={`${sidebarNavRoot.icon} text-base text-[color:var(--accent)]`} />
                    <span className="text-sm font-bold uppercase tracking-wider text-[color:var(--faint)]">
                      {sidebarNavRoot.label}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 px-1">
                    {sidebarNavRoot.children.map((node) => (
                      <div key={isNavGroup(node) ? node.id : node.path}>
                        {renderMobileNavNode(node, () => setMobileMenuOpen(false))}
                      </div>
                    ))}
                    <div className="border-t border-[color:var(--border)] pt-3">
                      <NavLink
                        className={({ isActive }) =>
                          `nav-item flex w-fit shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${isActive ? 'nav-item-active' : ''}`
                        }
                        onClick={() => setMobileMenuOpen(false)}
                        to={PROFILE_LEAF.path}
                      >
                        <i className={`${PROFILE_LEAF.icon} text-base`} />
                        <span>{PROFILE_LEAF.label}</span>
                      </NavLink>
                      <NavLink
                        className={({ isActive }) =>
                          `nav-item mt-2 flex w-fit shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${isActive ? 'nav-item-active' : ''}`
                        }
                        onClick={() => setMobileMenuOpen(false)}
                        to={ADMIN_SIDEBAR_FOOTER_LINK.path}
                      >
                        <i className={`${ADMIN_SIDEBAR_FOOTER_LINK.icon} text-base`} />
                        <span>{ADMIN_SIDEBAR_FOOTER_LINK.label}</span>
                      </NavLink>
                    </div>
                  </div>
                </div>
              </motion.nav>
            )}
          </AnimatePresence>

          <div className="admin-layout-outlet min-h-0 min-w-0 flex-1 overflow-auto">
            <Outlet context={outletContext} />
          </div>
        </section>
      </div>
    </main>
  )
}

function DualColumnSidebar({
  navRoot,
  pathname,
  compact,
}: {
  navRoot: AdminNavGroup
  pathname: string
  compact: boolean
}) {
  const pathSegment = useMemo(
    () => dualSidebarSegmentForPath(navRoot.children, pathname),
    [navRoot.children, pathname],
  )
  const [segmentOverride, setSegmentOverride] = useState<DualSidebarMainSegment | null>(null)
  useEffect(() => {
    setSegmentOverride(null)
  }, [pathname])

  const seg = segmentOverride ?? pathSegment
  /** 仅有多级子项的分组才展开右栏；一级叶子与底部「系统设置」均为单入口，避免重复子栏 */
  const showSubColumn = seg.kind === 'group'
  const subColWidth = compact ? 'w-[10.5rem]' : 'w-[13rem]'
  const mainRailW = 'w-[5.5rem] shrink-0'
  const mainRailBtn =
    'nav-item flex w-full flex-col items-center gap-0.5 rounded-xl px-1.5 py-2 text-center text-sm font-medium outline-none transition'
  const mainRailLabel = 'max-w-[4.75rem] truncate text-center text-[10px] font-semibold leading-tight'

  return (
    <>
      <div
        className={`flex h-full shrink-0 flex-col border-e pb-2 pl-3 pr-2.5 pt-3.5 transition-colors duration-300 ${mainRailW} ${showSubColumn ? 'border-[color:var(--border)]' : 'border-transparent'}`}
      >
        <div className="flex shrink-0 justify-center">
          <div className="grid size-10 place-items-center rounded-xl bg-[color:var(--accent)] text-lg text-white shadow-[0_16px_40px_var(--glow)]">
            <i className="ri-flashlight-line" />
          </div>
        </div>
        <nav className="mt-3 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto py-1">
          {navRoot.children.map((node) =>
            isNavGroup(node) ? (
              <MotionButton
                key={node.id}
                type="button"
                title={node.label}
                aria-label={node.label}
                aria-current={seg.kind === 'group' && seg.group.id === node.id ? 'true' : undefined}
                className={`${mainRailBtn} ${seg.kind === 'group' && seg.group.id === node.id ? 'nav-item-active' : ''}`}
                onClick={() => setSegmentOverride({ kind: 'group', group: node })}
              >
                <i className={`${node.icon} text-lg`} />
                <span className={mainRailLabel}>{node.label}</span>
              </MotionButton>
            ) : (
              <NavLink
                key={node.path}
                title={node.label}
                aria-label={node.label}
                className={({ isActive }) => `${mainRailBtn} ${isActive ? 'nav-item-active' : ''}`}
                end={node.path === '/dashboard'}
                to={node.path}
              >
                <i className={`${node.icon} text-lg`} />
                <span className={mainRailLabel}>{node.label}</span>
              </NavLink>
            ),
          )}
        </nav>
        <div className="mt-auto shrink-0 border-t border-[color:var(--border)] pt-2">
          <NavLink
            title={ADMIN_SIDEBAR_FOOTER_LINK.label}
            aria-label={ADMIN_SIDEBAR_FOOTER_LINK.label}
            className={({ isActive }) => `${mainRailBtn} ${isActive ? 'nav-item-active' : ''}`}
            to={ADMIN_SIDEBAR_FOOTER_LINK.path}
          >
            <i className={`${ADMIN_SIDEBAR_FOOTER_LINK.icon} text-lg`} />
            <span className={mainRailLabel}>{ADMIN_SIDEBAR_FOOTER_LINK.label}</span>
          </NavLink>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {showSubColumn ? (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: compact ? 168 : 208, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={motionTokens.softSpring}
            className="flex h-full shrink-0 overflow-hidden"
          >
            <div className={`flex h-full min-w-0 ${subColWidth} shrink-0 flex-col ${compact ? 'py-2' : 'py-3'}`}>
              <div className="shrink-0 border-b border-[color:var(--border)] px-3 pb-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-[color:var(--faint)]">
                  {seg.group.label}
                </Text>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 pr-1">
                <RailFlyoutSection nodes={seg.group.children} pathname={pathname} />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

function RailFlyoutSection({ nodes, pathname }: { nodes: AdminNavNode[]; pathname: string }) {
  const leafCls =
    'nav-item flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left !text-sm font-medium'
  const leafIconCls = 'text-base opacity-90'

  return (
    <div className="flex flex-col gap-0.5">
      {nodes.map((node) =>
        isNavGroup(node) ? (
          <div key={node.id} className="flex flex-col gap-0.5 pt-1 first:pt-0">
            <div className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-[color:var(--faint)]">
              {node.label}
            </div>
            <RailFlyoutSection nodes={node.children} pathname={pathname} />
          </div>
        ) : (
          <NavLink
            key={node.path}
            className={({ isActive }) => `${leafCls} ${isActive ? 'nav-item-active' : ''}`}
            end={node.path === '/dashboard'}
            to={node.path}
          >
            <i className={`${node.icon} ${leafIconCls}`} />
            <span className="min-w-0 truncate">{node.label}</span>
          </NavLink>
        ),
      )}
    </div>
  )
}

function SidebarRailGroup({ group, pathname }: { group: AdminNavGroup; pathname: string }) {
  const hasActive = groupHasActiveDescendant(group, pathname)

  return (
    <div className="w-full min-w-0">
      <Popover>
      <Popover.Trigger
        className={`nav-item flex w-full cursor-pointer items-center justify-center rounded-xl px-2 py-2.5 text-sm font-medium outline-none transition ${hasActive ? 'nav-item-active' : ''}`}
      >
        <i className={`${group.icon} text-lg`} />
        <span className="sr-only">{group.label}</span>
      </Popover.Trigger>
      <Popover.Content
        offset={10}
        placement="right top"
        className="max-h-[min(70vh,28rem)] overflow-hidden rounded-xl p-0 shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      >
        <Popover.Dialog className="glass-panel min-w-[13.75rem] max-w-[min(90vw,18rem)] outline-none">
          <div className="border-b border-[color:var(--border)] px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--faint)]">
              {group.label}
            </span>
          </div>
          <div className="max-h-[min(60vh,22rem)] overflow-y-auto p-2">
            <RailFlyoutSection nodes={group.children} pathname={pathname} />
          </div>
        </Popover.Dialog>
      </Popover.Content>
      </Popover>
    </div>
  )
}

function renderMobileNavNode(node: AdminNavNode, onNav: () => void): ReactNode {
  if (!isNavGroup(node)) {
    return (
      <NavLink
        className={({ isActive }) =>
          `nav-item flex w-fit shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${isActive ? 'nav-item-active' : ''}`
        }
        onClick={onNav}
        end={node.path === '/dashboard'}
        to={node.path}
      >
        <i className={`${node.icon} text-base`} />
        <span>{node.label}</span>
      </NavLink>
    )
  }
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="px-1 text-sm font-bold uppercase tracking-wider text-[color:var(--faint)]">
        {node.label}
      </span>
      <div className="flex flex-wrap gap-2">{node.children.map((c) => renderMobileNavNode(c, onNav))}</div>
    </div>
  )
}

function SidebarNavGroup({
  compact,
  group,
  pathname,
  groupManualOpen,
  setGroupManualOpen,
}: {
  compact: boolean
  group: AdminNavGroup
  pathname: string
  groupManualOpen: Record<string, boolean>
  setGroupManualOpen: Dispatch<SetStateAction<Record<string, boolean>>>
}) {
  const hasActive = groupHasActiveDescendant(group, pathname)
  const expanded = hasActive || (groupManualOpen[group.id] ?? false)

  const rowCls = compact
    ? 'nav-item flex w-full items-center justify-between gap-1 rounded-xl px-2 py-2 text-left !text-sm !font-medium'
    : 'nav-item flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left !text-sm !font-medium'
  const iconCls = compact ? 'text-base' : 'text-lg'
  const arrowCls = compact ? 'text-base' : 'text-lg'
  const innerCls = compact ? 'flex items-center gap-2' : 'flex items-center gap-3'
  const nestCls = compact
    ? 'ml-1 flex flex-col gap-0.5 overflow-hidden border-l border-[color:var(--border)] pl-2 pr-1'
    : 'ml-2 flex flex-col gap-1 overflow-hidden border-l border-[color:var(--border)] pl-3 pr-2'
  const leafCls = compact
    ? 'nav-item flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left !text-sm font-medium'
    : 'nav-item flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left !text-sm font-medium'
  const leafIconCls = 'text-base opacity-90'

  return (
    <div className={compact ? 'flex flex-col gap-0.5' : 'flex flex-col gap-1'}>
      <MotionButton
        className={`${rowCls} ${hasActive ? 'nav-item-active' : ''}`}
        type="button"
        aria-expanded={expanded}
        onClick={() => {
          if (hasActive) return
          setGroupManualOpen((prev) => ({ ...prev, [group.id]: !expanded }))
        }}
      >
        <span className={innerCls}>
          <i className={`${group.icon} ${iconCls}`} />
          <span>{group.label}</span>
        </span>
        <i
          className={`ri-arrow-down-s-line transition-transform ${arrowCls} ${expanded ? 'rotate-180' : ''} ${hasActive ? 'opacity-50' : ''}`}
        />
      </MotionButton>
      <AnimatePresence initial={false}>
        {expanded ? (
        <motion.div
          className={nestCls}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={motionTokens.softSpring}
        >
          {group.children.map((child) =>
            isNavGroup(child) ? (
              <SidebarNavGroup
                key={child.id}
                compact={compact}
                group={child}
                groupManualOpen={groupManualOpen}
                pathname={pathname}
                setGroupManualOpen={setGroupManualOpen}
              />
            ) : (
              <NavLink
                key={child.path}
                className={({ isActive }) => `${leafCls} ${isActive ? 'nav-item-active' : ''}`}
                end={child.path === '/dashboard'}
                to={child.path}
              >
                <i className={`${child.icon} ${leafIconCls}`} />
                <span className="min-w-0 truncate">{child.label}</span>
              </NavLink>
            ),
          )}
        </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function AdminHeader({
  compact,
  user,
  theme,
  toggleTheme,
  logout,
  onRefresh,
  pageMeta,
  mobileMenuOpen,
  setMobileMenuOpen,
}: {
  compact: boolean
  user: ReturnType<typeof useAuth>['user']
  theme: 'light' | 'dark'
  toggleTheme: () => void
  logout: ReturnType<typeof useAuth>['logout']
  onRefresh: () => void
  pageMeta: AdminNavLeaf
  mobileMenuOpen: boolean
  setMobileMenuOpen: Dispatch<SetStateAction<boolean>>
}) {
  const headerSurface = compact
    ? 'glass-panel flex items-center justify-between gap-2 rounded-xl px-3 py-2 sm:gap-3 sm:rounded-xl sm:px-3.5 sm:py-2'
    : 'glass-panel flex items-center justify-between gap-4 rounded-xl px-4 py-3 sm:px-5'
  const brandGap = compact ? 'gap-2' : 'gap-3'
  const mobileLogo = compact
    ? 'grid size-8 shrink-0 place-items-center rounded-lg bg-[color:var(--accent)] text-white lg:hidden'
    : 'grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--accent)] text-white lg:hidden'
  const mobileLogoIcon = compact ? 'ri-flashlight-line text-base' : 'ri-flashlight-line text-lg'
  const titleCls = compact
    ? 'text-lg font-black tracking-tight sm:text-xl'
    : 'text-xl font-black tracking-tight sm:text-2xl'
  const badgeCls = compact
    ? 'rounded bg-[color:var(--accent)]/10 px-1.5 py-px text-[10px] font-semibold leading-tight text-[color:var(--accent)]'
    : 'rounded-md bg-[color:var(--accent)]/10 px-2 py-0.5 text-xs font-semibold text-[color:var(--accent)]'
  const toolbarWrap = compact ? 'flex shrink-0 items-center gap-1.5 sm:gap-3' : 'flex shrink-0 items-center gap-2 sm:gap-4'
  const iconBtnWrap = compact ? 'flex items-center gap-0.5 sm:gap-1.5' : 'flex items-center gap-1 sm:gap-2'
  const iconBtn = compact
    ? 'grid size-8 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--text)]'
    : 'grid size-9 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--text)]'
  const iconBtnGlyph = compact ? 'text-base' : 'text-lg'
  const divider = compact ? 'hidden h-6 w-px bg-[color:var(--border)] sm:block' : 'hidden h-8 w-px bg-[color:var(--border)] sm:block'
  const userCluster = compact ? 'flex items-center gap-2' : 'flex items-center gap-3'
  const userNameCls = compact ? 'text-xs font-bold leading-tight' : 'text-sm font-bold leading-tight'
  const userRolesCls = compact ? 'text-[10px] leading-tight' : 'text-xs leading-tight'
  const avatar = compact
    ? 'grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-2)] text-xs font-bold text-white shadow-sm ring-2 ring-white/20'
    : 'grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-2)] text-sm font-bold text-white shadow-sm ring-2 ring-white/20'
  const logoutBtn = compact
    ? 'grid size-8 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--danger)]/10 hover:text-[color:var(--danger)]'
    : 'grid size-9 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--danger)]/10 hover:text-[color:var(--danger)]'
  const titleTransition = { duration: 0.14 } as const
  const titleAccentTransition = { duration: 0.12, delay: 0.02 } as const
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  return (
    <>
      <motion.header
        className={headerSurface}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={motionTokens.softSpring}
      >
      <div className={`flex min-w-0 items-center ${brandGap}`}>
        <MotionButton
          className={mobileLogo}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Mobile Menu"
        >
          <i className={mobileMenuOpen ? 'ri-close-line text-lg' : mobileLogoIcon} />
        </MotionButton>
        <div className="min-w-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${pageMeta.titleEn}-${pageMeta.label}`}
              className="flex min-w-0 flex-col gap-1"
              initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -3, filter: 'blur(2px)' }}
              transition={titleTransition}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 sm:gap-x-3">
                <Text className={`${titleCls} shrink-0`}>{pageMeta.titleEn}</Text>
                <span
                  className="hidden shrink-0 select-none text-sm leading-none text-[color:var(--faint)] sm:inline"
                  aria-hidden
                >
                  ·
                </span>
                <Text className={`${badgeCls} hidden shrink-0 sm:inline`}>{pageMeta.label}</Text>
              </div>
              {compact ? null : (
                <motion.div
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={titleAccentTransition}
                >
                  <Text className="block truncate" size="xs" variant="muted">
                    {pageMeta.subtitle}
                  </Text>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className={toolbarWrap}>
        <div className={iconBtnWrap}>
          <MotionButton className={iconBtn} onClick={onRefresh} title="刷新当前页">
            <i className={`ri-refresh-line ${iconBtnGlyph}`} />
          </MotionButton>
          <MotionButton className={iconBtn} onClick={toggleTheme} title="切换主题">
            <i
              className={
                theme === 'dark'
                  ? `ri-moon-clear-line ${iconBtnGlyph}`
                  : `ri-sun-line ${iconBtnGlyph}`
              }
            />
          </MotionButton>
        </div>

        <div className={divider} />

        <div className={`${userCluster} items-center`}>
          <NavLink
            to="/profile"
            title="个人中心"
            aria-label="个人中心"
            className={`flex min-w-0 items-center rounded-xl py-1 pl-1 pr-2 no-underline outline-none transition hover:bg-[color:var(--surface-soft)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] ${compact ? 'gap-2' : 'gap-3'}`}
          >
            <div className="hidden min-w-0 flex-col items-end gap-0.5 sm:flex">
              <Text className={userNameCls}>{user?.username || 'Admin'}</Text>
              <Text className={userRolesCls} variant="muted">
                {user?.roles?.length ? user.roles.join(' · ') : '暂无角色'}
              </Text>
            </div>
            <div className={avatar}>{(user?.username || 'A').slice(0, 1).toUpperCase()}</div>
          </NavLink>
          <MotionButton
            className={logoutBtn}
            onClick={() => setLogoutConfirmOpen(true)}
            title="退出登录"
            aria-label="退出登录"
          >
            <i className={`ri-logout-box-r-line ${iconBtnGlyph}`} />
          </MotionButton>
        </div>
      </div>
    </motion.header>

      <Modal isOpen={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <Modal.Backdrop isDismissable={false}>
          <Modal.Container size="sm" placement="center">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>退出登录</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Text size="sm" variant="muted">
                  确定要退出当前账号吗？未保存的编辑将丢失。
                </Text>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => setLogoutConfirmOpen(false)}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  onPress={() => {
                    setLogoutConfirmOpen(false)
                    logout()
                  }}
                >
                  退出登录
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  )
}
