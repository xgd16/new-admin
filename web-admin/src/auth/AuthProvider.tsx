import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { toast } from '@heroui/react'

import { ADMIN_API_PREFIX, apiRequest, setStoredToken, getStoredToken } from '../api/client'
import type { LoginData, MeData } from '../api/types'
import { AuthContext, type AuthCtx, type LogoutOptions } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getStoredToken())
  const [user, setUser] = useState<MeData | null>(null)
  const [bootstrapping, setBootstrapping] = useState(Boolean(getStoredToken()))

  const logout = useCallback((opts?: LogoutOptions) => {
    if (!opts?.skipToast) {
      toast.info('已退出登录')
    }
    setStoredToken(null)
    setTokenState(null)
    setUser(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const t = getStoredToken()
    if (!t) {
      setUser(null)
      return
    }
    const { envelope, httpStatus } = await apiRequest<MeData>(`${ADMIN_API_PREFIX}/auth/me`, {
      method: 'GET',
    })
    if (envelope.code === 0) {
      setUser(envelope.data)
      return
    }
    if (httpStatus === 401 || envelope.code === 40101) {
      toast.warning(envelope.message?.trim() || '登录已过期，请重新登录')
      logout({ skipToast: true })
      return
    }
    throw new Error(envelope.message || '加载用户信息失败')
  }, [logout])

  useEffect(() => {
    const t = getStoredToken()
    if (!t) {
      return
    }
    void (async () => {
      try {
        await refreshProfile()
      } catch {
        // 静默忽略：token 失效时 refreshProfile 会 logout
      } finally {
        setBootstrapping(false)
      }
    })()
  }, [refreshProfile])

  const login = useCallback(
    async (username: string, password: string, captchaId: string, captchaCode: string) => {
      const { envelope, httpStatus } = await apiRequest<LoginData>(`${ADMIN_API_PREFIX}/auth/login`, {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          username,
          password,
          captcha_id: captchaId,
          captcha_code: captchaCode.trim(),
        }),
      })
      if (envelope.code !== 0) {
        throw new Error(envelope.message || `登录失败 (${httpStatus})`)
      }
      const { access_token, user: u } = envelope.data
      setStoredToken(access_token)
      setTokenState(access_token)
      setUser(u)
      toast.success(`登录成功，欢迎 ${u.username}`)
    },
    [],
  )

  const value = useMemo(
    (): AuthCtx => ({
      token,
      user,
      bootstrapping,
      login,
      logout,
      refreshProfile,
    }),
    [bootstrapping, login, logout, refreshProfile, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
