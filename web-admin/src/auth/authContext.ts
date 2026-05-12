import { createContext, useContext } from 'react'

import type { MeData } from '../api/types'

export type LogoutOptions = {
  /** 为 true 时不弹 Toast（例如会话已过期并已提示） */
  skipToast?: boolean
}

export type AuthCtx = {
  token: string | null
  user: MeData | null
  bootstrapping: boolean
  login: (username: string, password: string, captchaId: string, captchaCode: string) => Promise<void>
  logout: (opts?: LogoutOptions) => void
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthCtx | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return value
}
