import { apiURL, getStoredToken } from './client'
import type { ApiEnvelope } from './types'

/** 与后端导出命名一致：英文功能名 + 本地时间到秒（YYYY-MM-DD_HH-mm-ss） */
export function buildExportFilename(englishSlug: string, ext: string): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  const safeExt = ext.replace(/^\./, '')
  return `${englishSlug}_${date}_${time}.${safeExt}`
}

export type ApiDownloadOptions = RequestInit & {
  /** 当跨域未暴露 Content-Disposition 等导致无法解析时使用 */
  fallbackFilename?: string
}

/** 触发浏览器下载二进制 Blob（如 xlsx）。 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download.bin'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function parseContentDisposition(header: string | null): string | undefined {
  if (!header) return undefined
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)
  if (star?.[1]) {
    const raw = star[1].trim().replace(/^["']|["']$/g, '')
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  const quoted = /filename\s*=\s*"((?:\\.|[^"\\])*)"/i.exec(header)
  if (quoted?.[1]) return quoted[1].replace(/\\(.)/g, '$1')
  const plain = /filename\s*=\s*([^;\s]+)/i.exec(header)
  if (plain?.[1]) return plain[1].replace(/^"|"$/g, '')
  return undefined
}

export type ApiDownloadResult =
  | { ok: true; blob: Blob; filename: string }
  | { ok: false; message: string; httpStatus: number }

/**
 * 请求返回文件流的接口（非 JSON 的 2xx 响应体视为文件）。
 * 失败且 Content-Type 为 JSON 时解析 `pkg/response` 信封中的 message。
 */
export async function apiDownloadBinary(path: string, init?: ApiDownloadOptions): Promise<ApiDownloadResult> {
  const { fallbackFilename, ...reqInit } = init ?? {}
  const url = apiURL(path)
  const headers = new Headers(reqInit.headers)
  const token = getStoredToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url, { ...reqInit, headers })
  const ct = res.headers.get('Content-Type') || ''

  if (!res.ok) {
    if (ct.includes('application/json')) {
      try {
        const env = (await res.json()) as ApiEnvelope<unknown>
        return { ok: false, message: env.message || `HTTP ${res.status}`, httpStatus: res.status }
      } catch {
        return { ok: false, message: `HTTP ${res.status}`, httpStatus: res.status }
      }
    }
    return { ok: false, message: `HTTP ${res.status}`, httpStatus: res.status }
  }

  if (ct.includes('application/json')) {
    try {
      const env = (await res.json()) as ApiEnvelope<unknown>
      return { ok: false, message: env.message || '服务端返回 JSON 而非文件', httpStatus: res.status }
    } catch {
      return { ok: false, message: '服务端返回 JSON 而非文件', httpStatus: res.status }
    }
  }

  const parsed = parseContentDisposition(res.headers.get('Content-Disposition'))
  const filename =
    (parsed && parsed.length > 0 ? parsed : null) ??
    fallbackFilename ??
    'download.bin'
  const blob = await res.blob()
  return { ok: true, blob, filename }
}
