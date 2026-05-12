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
import {
  getPasskeyCreation,
  getPasskeyRequest,
  publicKeyCredentialToAssertionJSON,
  publicKeyCredentialToAttestationJSON,
  webAuthnSupported,
} from './webauthnClient'
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

  const loginWithPasskey = useCallback(async (username: string) => {
    const u = username.trim()
    if (!u) throw new Error('请输入用户名')
    if (!webAuthnSupported()) throw new Error('当前浏览器不支持通行密钥')
    const begin = await apiRequest<{ session_key: string; options: Record<string, unknown> }>(
      `${ADMIN_API_PREFIX}/auth/passkey/login/begin`,
      {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ username: u }),
      },
    )
    if (begin.envelope.code !== 0) {
      throw new Error(begin.envelope.message || '无法开始通行密钥登录')
    }
    const { session_key: sessionKey, options: optRaw } = begin.envelope.data
    const req = getPasskeyRequest(optRaw)
    const rawCred = await navigator.credentials.get(req)
    if (!rawCred || !(rawCred instanceof PublicKeyCredential)) {
      throw new Error('未获得通行密钥（可能已取消）')
    }
    const credential = publicKeyCredentialToAssertionJSON(rawCred)
    const finish = await apiRequest<LoginData>(`${ADMIN_API_PREFIX}/auth/passkey/login/finish`, {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ session_key: sessionKey, credential }),
    })
    if (finish.envelope.code !== 0) {
      throw new Error(finish.envelope.message || '通行密钥验证失败')
    }
    const { access_token, user: usr } = finish.envelope.data
    setStoredToken(access_token)
    setTokenState(access_token)
    setUser(usr)
    toast.success(`登录成功，欢迎 ${usr.username}`)
  }, [])

  const registerPasskey = useCallback(async () => {
    if (!webAuthnSupported()) throw new Error('当前浏览器不支持通行密钥')
    const begin = await apiRequest<{ session_key: string; options: Record<string, unknown> }>(
      `${ADMIN_API_PREFIX}/auth/passkey/register/begin`,
      { method: 'POST', body: JSON.stringify({}) },
    )
    if (begin.envelope.code !== 0) {
      throw new Error(begin.envelope.message || '无法开始绑定通行密钥')
    }
    const { session_key: sessionKey, options: optRaw } = begin.envelope.data
    const req = getPasskeyCreation(optRaw)
    const rawCred = await navigator.credentials.create(req)
    if (!rawCred || !(rawCred instanceof PublicKeyCredential)) {
      throw new Error('未完成通行密钥创建（可能已取消）')
    }
    const credential = publicKeyCredentialToAttestationJSON(rawCred)
    const finish = await apiRequest<{ ok: boolean }>(
      `${ADMIN_API_PREFIX}/auth/passkey/register/finish`,
      {
        method: 'POST',
        body: JSON.stringify({ session_key: sessionKey, credential }),
      },
    )
    if (finish.envelope.code !== 0) {
      throw new Error(finish.envelope.message || '绑定通行密钥失败')
    }
    toast.success('已绑定通行密钥，之后可在登录页使用该设备登录')
  }, [])

  const value = useMemo(
    (): AuthCtx => ({
      token,
      user,
      bootstrapping,
      login,
      loginWithPasskey,
      registerPasskey,
      logout,
      refreshProfile,
    }),
    [bootstrapping, login, loginWithPasskey, logout, refreshProfile, registerPasskey, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
