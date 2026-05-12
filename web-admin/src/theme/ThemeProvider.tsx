import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { ThemeContext, type ThemeMode, type ThemePreference } from './themeContext'
import { PALETTE_STORAGE_KEY, readStoredPaletteId, type PaletteId } from './palette'

const PREF_KEY = 'new_admin_theme_pref'
const LEGACY_KEY = 'new_admin_theme'

function readPreference(): ThemePreference {
  const pref = window.localStorage.getItem(PREF_KEY)
  if (pref === 'light' || pref === 'dark' || pref === 'system') return pref
  const legacy = window.localStorage.getItem(LEGACY_KEY)
  if (legacy === 'light' || legacy === 'dark') {
    window.localStorage.setItem(PREF_KEY, legacy)
    return legacy
  }
  return 'system'
}

function resolveEffectiveTheme(pref: ThemePreference): ThemeMode {
  if (pref === 'light') return 'light'
  if (pref === 'dark') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readPreference())
  const [paletteId, setPaletteState] = useState<PaletteId>(() => readStoredPaletteId())
  /** 仅在 preference === 'system' 时用于订阅系统主题变化后触发重算 */
  const [systemEpoch, setSystemEpoch] = useState(0)

  useEffect(() => {
    if (preference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemEpoch((n) => n + 1)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  const theme = useMemo(() => {
    // systemEpoch：仅在 preference === 'system' 时随 OS 主题变化递增，用于触发重新解析
    void systemEpoch
    return resolveEffectiveTheme(preference)
  }, [preference, systemEpoch])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.palette = paletteId
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    window.localStorage.setItem(PREF_KEY, preference)
    window.localStorage.setItem(PALETTE_STORAGE_KEY, paletteId)
  }, [theme, preference, paletteId])

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setPreference(pref)
  }, [])

  const setPaletteId = useCallback((id: PaletteId) => {
    setPaletteState(id)
  }, [])

  const toggleTheme = useCallback(() => {
    setPreference((prevPref) => {
      const cur = resolveEffectiveTheme(prevPref)
      return cur === 'dark' ? 'light' : 'dark'
    })
  }, [])

  const value = useMemo(
    () => ({
      theme,
      themePreference: preference,
      setThemePreference,
      toggleTheme,
      paletteId,
      setPaletteId,
    }),
    [theme, preference, setThemePreference, toggleTheme, paletteId, setPaletteId],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
