import { ADMIN_API_PREFIX, apiRequest } from './client'
import type { PasskeyCredentialItem } from './types'

export async function fetchPasskeyCredentials(): Promise<PasskeyCredentialItem[]> {
  const { envelope, httpStatus } = await apiRequest<{ list: PasskeyCredentialItem[] }>(
    `${ADMIN_API_PREFIX}/auth/passkey/credentials`,
    { method: 'GET' },
  )
  if (envelope.code !== 0) {
    throw new Error(envelope.message || `加载通行密钥列表失败 (${httpStatus})`)
  }
  return envelope.data.list
}

export async function deletePasskeyCredential(id: number): Promise<void> {
  const { envelope, httpStatus } = await apiRequest<{ ok: boolean }>(
    `${ADMIN_API_PREFIX}/auth/passkey/credentials/${id}`,
    { method: 'DELETE' },
  )
  if (envelope.code !== 0) {
    throw new Error(envelope.message || `解绑失败 (${httpStatus})`)
  }
}
