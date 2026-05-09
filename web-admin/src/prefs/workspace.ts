import { useEffect, useState } from 'react'

export const PREFS_CHANGED_EVENT = 'new-admin-prefs-changed'

export const TABLE_PAGE_SIZE_KEY = 'new_admin_table_page_size'
export const ALLOWED_PAGE_SIZES = [10, 15, 20, 50] as const
export type TablePageSize = (typeof ALLOWED_PAGE_SIZES)[number]

export const REDUCE_MOTION_KEY = 'new_admin_reduce_motion'

/** 桌面端左侧栏紧凑布局（更小留白与字号） */
export const SIDEBAR_COMPACT_KEY = 'new_admin_sidebar_compact'

/** 桌面端左侧菜单仅显示图标窄栏（仅 lg+；移动端不受影响） */
export const SIDEBAR_FOLDED_KEY = 'new_admin_sidebar_folded'

/** 滚动条：overlay 完全隐藏滚动条仍可滚动；visible 始终显示便于发现可滚动区域 */
export const SCROLLBAR_PREF_KEY = 'new_admin_scrollbar_pref'

export type ScrollbarPref = 'overlay' | 'visible'

export function getTablePageSize(): TablePageSize {
  const raw = localStorage.getItem(TABLE_PAGE_SIZE_KEY)
  const n = raw ? Number.parseInt(raw, 10) : NaN
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n) ? (n as TablePageSize) : 10
}

export function setTablePageSize(size: TablePageSize): void {
  localStorage.setItem(TABLE_PAGE_SIZE_KEY, String(size))
  window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT))
}

export function useTablePageSize(): TablePageSize {
  const [size, setSize] = useState(getTablePageSize)
  useEffect(() => {
    const sync = () => setSize(getTablePageSize())
    window.addEventListener(PREFS_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return size
}

export function getReduceMotion(): boolean {
  return localStorage.getItem(REDUCE_MOTION_KEY) === '1'
}

export function applyReduceMotionToDocument(on: boolean): void {
  document.documentElement.dataset.reduceMotion = on ? 'true' : 'false'
}

export function setReduceMotion(on: boolean): void {
  if (on) localStorage.setItem(REDUCE_MOTION_KEY, '1')
  else localStorage.removeItem(REDUCE_MOTION_KEY)
  applyReduceMotionToDocument(on)
  window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT))
}

/** 首屏前调用，避免开关开启时出现过渡闪烁 */
export function applyReduceMotionFromStorage(): void {
  applyReduceMotionToDocument(getReduceMotion())
}

export function useReduceMotionPref(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(getReduceMotion)
  useEffect(() => {
    const sync = () => setOn(getReduceMotion())
    window.addEventListener(PREFS_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return [on, setReduceMotion]
}

export function getSidebarCompact(): boolean {
  return localStorage.getItem(SIDEBAR_COMPACT_KEY) === '1'
}

export function setSidebarCompact(on: boolean): void {
  if (on) localStorage.setItem(SIDEBAR_COMPACT_KEY, '1')
  else localStorage.removeItem(SIDEBAR_COMPACT_KEY)
  window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT))
}

export function useSidebarCompact(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(getSidebarCompact)
  useEffect(() => {
    const sync = () => setOn(getSidebarCompact())
    window.addEventListener(PREFS_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return [on, setSidebarCompact]
}

export function getSidebarFolded(): boolean {
  return localStorage.getItem(SIDEBAR_FOLDED_KEY) === '1'
}

export function setSidebarFolded(on: boolean): void {
  if (on) localStorage.setItem(SIDEBAR_FOLDED_KEY, '1')
  else localStorage.removeItem(SIDEBAR_FOLDED_KEY)
  window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT))
}

export function useSidebarFolded(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(getSidebarFolded)
  useEffect(() => {
    const sync = () => setOn(getSidebarFolded())
    window.addEventListener(PREFS_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return [on, setSidebarFolded]
}

export function getScrollbarPref(): ScrollbarPref {
  const raw = localStorage.getItem(SCROLLBAR_PREF_KEY)
  if (raw === 'visible' || raw === 'overlay') return raw
  return 'overlay'
}

export function applyScrollbarPrefToDocument(pref: ScrollbarPref): void {
  document.documentElement.dataset.scrollbar = pref
}

export function setScrollbarPref(pref: ScrollbarPref): void {
  localStorage.setItem(SCROLLBAR_PREF_KEY, pref)
  applyScrollbarPrefToDocument(pref)
  window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT))
}

/** 首屏前调用，与主题脚本一致避免样式闪烁 */
export function applyScrollbarPrefFromStorage(): void {
  applyScrollbarPrefToDocument(getScrollbarPref())
}

export function useScrollbarPref(): [ScrollbarPref, (pref: ScrollbarPref) => void] {
  const [pref, setPref] = useState(getScrollbarPref)
  useEffect(() => {
    const sync = () => setPref(getScrollbarPref())
    window.addEventListener(PREFS_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return [pref, setScrollbarPref]
}
