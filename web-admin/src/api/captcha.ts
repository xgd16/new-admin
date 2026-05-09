import { ADMIN_API_PREFIX, apiRequest } from './client'
import type { CaptchaResp } from './types'

export async function fetchLoginCaptcha(): Promise<CaptchaResp> {
  const { envelope, httpStatus } = await apiRequest<CaptchaResp>(`${ADMIN_API_PREFIX}/auth/captcha`, {
    method: 'GET',
    skipAuth: true,
  })
  if (envelope.code !== 0) {
    throw new Error(envelope.message || `HTTP ${httpStatus}`)
  }
  return envelope.data
}
