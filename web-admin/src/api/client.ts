import type { ApiEnvelope } from './types'
import { TOKEN_STORAGE_KEY } from './types'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
  else localStorage.removeItem(TOKEN_STORAGE_KEY)
}

/** 后台 REST 路径前缀，须与 Go `internal/router` 中分组一致 */
export const ADMIN_API_PREFIX = '/admin/v1'

function apiOrigin(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  const base = (raw?.trim() || 'http://127.0.0.1:8080').replace(/\/$/, '')
  return base
}

/** 将相对路径（如 `/admin/v1/...`）拼成直连后端的完整 URL */
export function apiURL(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const p = path.startsWith('/') ? path : `/${path}`
  return `${apiOrigin()}${p}`
}

type RequestOpts = RequestInit & { skipAuth?: boolean }

export async function apiRequest<T>(path: string, init?: RequestOpts) {
  const url = apiURL(path)
  const headers = new Headers(init?.headers)
  const hasBody = init?.body !== undefined && init?.body !== null
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (!init?.skipAuth) {
    const t = getStoredToken()
    if (t) headers.set('Authorization', `Bearer ${t}`)
  }

  const res = await fetch(url, { ...init, headers })
  let envelope: ApiEnvelope<T>
  try {
    envelope = (await res.json()) as ApiEnvelope<T>
  } catch {
    throw new Error(`HTTP ${res.status}，响应非 JSON`)
  }
  return { envelope, httpStatus: res.status }
}
