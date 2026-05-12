export type AdminNavLeaf = {
  path: string
  label: string
  icon: string
  titleEn: string
  subtitle: string
  /** 任一权限满足则显示；未设置则登录即可见 */
  requiresAny?: string[]
}

export type AdminNavGroup = {
  id: string
  label: string
  icon: string
  children: AdminNavNode[]
}

export type AdminNavNode = AdminNavLeaf | AdminNavGroup

export function isNavGroup(node: AdminNavNode): node is AdminNavGroup {
  return 'children' in node && Array.isArray(node.children)
}

export function pathMatchesLeaf(pathname: string, leafPath: string): boolean {
  return pathname === leafPath || pathname.startsWith(`${leafPath}/`)
}

export function groupHasActiveDescendant(g: AdminNavGroup, pathname: string): boolean {
  return g.children.some((c) =>
    isNavGroup(c) ? groupHasActiveDescendant(c, pathname) : pathMatchesLeaf(pathname, c.path),
  )
}

/** 双栏侧栏：当前路由对应的一级主菜单段（用于右侧子菜单） */
export type DualSidebarMainSegment =
  | { kind: 'leaf'; leaf: AdminNavLeaf }
  | { kind: 'group'; group: AdminNavGroup }
  | { kind: 'footer' }

export function dualSidebarSegmentForPath(nodes: AdminNavNode[], pathname: string): DualSidebarMainSegment {
  if (pathMatchesLeaf(pathname, ADMIN_SIDEBAR_FOOTER_LINK.path)) {
    return { kind: 'footer' }
  }
  for (const n of nodes) {
    if (!isNavGroup(n)) {
      if (pathMatchesLeaf(pathname, n.path)) return { kind: 'leaf', leaf: n }
    } else if (groupHasActiveDescendant(n, pathname)) {
      return { kind: 'group', group: n }
    }
  }
  const first = nodes[0]
  if (!first) return { kind: 'footer' }
  if (!isNavGroup(first)) return { kind: 'leaf', leaf: first }
  return { kind: 'group', group: first }
}

/** 固定在侧边栏底部的入口（不参与分组折叠树） */
export const ADMIN_SIDEBAR_FOOTER_LINK: AdminNavLeaf = {
  path: '/settings',
  label: '系统设置',
  icon: 'ri-settings-3-line',
  titleEn: 'Settings',
  subtitle: '外观、列表分页、滚动条与动效等本地偏好',
}

/** 后台管理菜单（仅保留已对接后端的路由，其余业务页待实现后再加） */
export const ADMIN_NAV: AdminNavNode[] = [
  {
    id: 'backend',
    label: '后台管理',
    icon: 'ri-building-2-line',
    children: [
      {
        path: '/dashboard',
        label: '总览',
        icon: 'ri-dashboard-3-line',
        titleEn: 'Overview',
        subtitle: '工作台总览与接口健康',
      },
      {
        id: 'front',
        label: '前台业务',
        icon: 'ri-store-2-line',
        children: [
          {
            path: '/front/users',
            label: '前台用户',
            icon: 'ri-user-smile-line',
            titleEn: 'Front Users',
            subtitle: '前台用户资料、状态与联系方式管理',
          },
        ],
      },
      {
        id: 'system',
        label: '系统与安全',
        icon: 'ri-shield-keyhole-line',
        children: [
          {
            path: '/system/users',
            label: '用户管理',
            icon: 'ri-team-line',
            titleEn: 'Users',
            subtitle: '后台账号、状态与角色分配',
          },
          {
            path: '/system/roles',
            label: '角色与权限',
            icon: 'ri-lock-2-line',
            titleEn: 'Roles',
            subtitle: 'RBAC 角色与权限码配置',
          },
          {
            path: '/system/operation-logs',
            label: '操作日志',
            icon: 'ri-file-list-3-line',
            titleEn: 'Audit Log',
            subtitle: '后台写操作与登录记录',
            requiresAny: ['system:audit:read'],
          },
        ],
      },
    ],
  },
]

export function getBackendNavRoot(): AdminNavGroup {
  const root = ADMIN_NAV[0]
  if (!isNavGroup(root)) {
    throw new Error('ADMIN_NAV[0] 必须为后台分组')
  }
  return root
}

function walkLeaves(nodes: AdminNavNode[], out: AdminNavLeaf[]) {
  for (const n of nodes) {
    if (isNavGroup(n)) walkLeaves(n.children, out)
    else out.push(n)
  }
}

/** 扁平化所有可路由叶子（用于 meta 解析等） */
export function flattenNavLeaves(nodes: AdminNavNode[] = ADMIN_NAV): AdminNavLeaf[] {
  const out: AdminNavLeaf[] = []
  walkLeaves(nodes, out)
  out.push(ADMIN_SIDEBAR_FOOTER_LINK)
  return out
}

export function navVisibleForPermissions(perms: string[] | undefined, leaf: AdminNavLeaf): boolean {
  if (!leaf.requiresAny?.length) return true
  const p = perms ?? []
  return leaf.requiresAny.some((code) => p.includes(code))
}

/** 按权限裁剪菜单树（不改变原始 ADMIN_NAV） */
export function filterNavByPermissions(nodes: AdminNavNode[], perms: string[] | undefined): AdminNavNode[] {
  const out: AdminNavNode[] = []
  for (const n of nodes) {
    if (isNavGroup(n)) {
      const kids = filterNavByPermissions(n.children, perms)
      if (kids.length === 0) continue
      out.push({ ...n, children: kids })
    } else if (navVisibleForPermissions(perms, n)) {
      out.push(n)
    }
  }
  return out
}

export function navMetaForPath(pathname: string): AdminNavLeaf {
  const leaves = flattenNavLeaves()
  const hit = leaves.find((n) => pathname === n.path || pathname.startsWith(`${n.path}/`))
  return hit ?? leaves[0]
}
