import { createContext, useContext } from 'react'

import type { PaletteId } from './palette'

export type ThemeMode = 'light' | 'dark'

/** 浅色 / 深色 / 跟随系统（顶栏切换时会写入明确的浅色或深色） */
export type ThemePreference = ThemeMode | 'system'

export type ThemeContextValue = {
  /** 当前生效的明暗（含「跟随系统」解析结果） */
  theme: ThemeMode
  themePreference: ThemePreference
  setThemePreference: (pref: ThemePreference) => void
  toggleTheme: () => void
  /** 配色预设（与明暗独立组合） */
  paletteId: PaletteId
  setPaletteId: (id: PaletteId) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return value
}
