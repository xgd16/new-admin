/** 与 go-webauthn `protocol.URLEncodedBase64` 及浏览器 Credential JSON 对齐 */

export function base64URLToBuffer(input: string): ArrayBuffer {
  // go-webauthn 使用 RawURLEncoding（无 padding）；atob 需要标准 Base64 且长度合法
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(padLen)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function bufferToBase64URL(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function credentialRequestOptionsFromServerPK(
  pk: Record<string, unknown>,
): PublicKeyCredentialRequestOptions {
  const challenge = base64URLToBuffer(String(pk.challenge))
  const allowCredentials = (
    pk.allowCredentials as Array<Record<string, unknown>> | undefined
  )?.map((c) => ({
    type: c.type as PublicKeyCredentialType,
    id: base64URLToBuffer(String(c.id)),
    transports: c.transports as AuthenticatorTransport[] | undefined,
  }))
  return {
    challenge,
    timeout: pk.timeout as number | undefined,
    rpId: pk.rpId as string | undefined,
    allowCredentials,
    userVerification: pk.userVerification as UserVerificationRequirement | undefined,
    extensions: pk.extensions as AuthenticationExtensionsClientInputs | undefined,
  }
}

/** 后端 JSON：`CredentialAssertion`（含 `publicKey` 成员） */
export function getPasskeyRequest(
  serverBody: Record<string, unknown>,
): CredentialRequestOptions {
  const mediation = serverBody.mediation as CredentialMediationRequirement | undefined
  const publicKeyRaw = serverBody.publicKey as Record<string, unknown>
  return {
    publicKey: credentialRequestOptionsFromServerPK(publicKeyRaw),
    mediation: mediation ?? undefined,
  }
}

function credentialCreationOptionsFromServerPK(
  pk: Record<string, unknown>,
): PublicKeyCredentialCreationOptions {
  const rp = pk.rp as { id: string; name: string }
  const userObj = pk.user as { id: string; name: string; displayName: string }
  const challenge = base64URLToBuffer(String(pk.challenge))
  const user: PublicKeyCredentialUserEntity = {
    id: base64URLToBuffer(String(userObj.id)),
    name: String(userObj.name),
    displayName: String(userObj.displayName),
  }
  const pubKeyCredParams = (
    pk.pubKeyCredParams as Array<{ type: string; alg: number }>
  ).map((p) => ({
    type: p.type as PublicKeyCredentialType,
    alg: p.alg,
  }))
  const excludeCredentials = (
    pk.excludeCredentials as Array<Record<string, unknown>> | undefined
  )?.map((c) => ({
    type: c.type as PublicKeyCredentialType,
    id: base64URLToBuffer(String(c.id)),
    transports: c.transports as AuthenticatorTransport[] | undefined,
  }))
  return {
    rp,
    user,
    challenge,
    pubKeyCredParams,
    timeout: pk.timeout as number | undefined,
    excludeCredentials,
    authenticatorSelection: pk.authenticatorSelection as AuthenticatorSelectionCriteria | undefined,
    attestation: pk.attestation as AttestationConveyancePreference | undefined,
    extensions: pk.extensions as AuthenticationExtensionsClientInputs | undefined,
  }
}

/** 后端 JSON：`CredentialCreation`（可能含 `mediation`，浏览器类型定义中 create 选项无此项，此处放宽以便透传） */
export function getPasskeyCreation(
  serverBody: Record<string, unknown>,
): CredentialCreationOptions & { mediation?: CredentialMediationRequirement } {
  const mediation = serverBody.mediation as CredentialMediationRequirement | undefined
  const publicKeyRaw = serverBody.publicKey as Record<string, unknown>
  return {
    publicKey: credentialCreationOptionsFromServerPK(publicKeyRaw),
    mediation: mediation ?? undefined,
  }
}

export function publicKeyCredentialToAssertionJSON(
  cred: PublicKeyCredential,
): Record<string, unknown> {
  const resp = cred.response as AuthenticatorAssertionResponse
  const response: Record<string, unknown> = {
    clientDataJSON: bufferToBase64URL(resp.clientDataJSON),
    authenticatorData: bufferToBase64URL(resp.authenticatorData),
    signature: bufferToBase64URL(resp.signature),
  }
  if (resp.userHandle && resp.userHandle.byteLength > 0) {
    response.userHandle = bufferToBase64URL(resp.userHandle)
  }
  const out: Record<string, unknown> = {
    id: cred.id,
    rawId: bufferToBase64URL(cred.rawId),
    type: cred.type,
    response,
  }
  if (cred.authenticatorAttachment) {
    out.authenticatorAttachment = cred.authenticatorAttachment
  }
  return out
}

export function publicKeyCredentialToAttestationJSON(
  cred: PublicKeyCredential,
): Record<string, unknown> {
  const resp = cred.response as AuthenticatorAttestationResponse
  const response: Record<string, unknown> = {
    clientDataJSON: bufferToBase64URL(resp.clientDataJSON),
    attestationObject: bufferToBase64URL(resp.attestationObject),
  }
  const transports =
    typeof resp.getTransports === 'function' ? resp.getTransports() : undefined
  if (transports?.length) {
    response.transports = transports
  }
  const out: Record<string, unknown> = {
    id: cred.id,
    rawId: bufferToBase64URL(cred.rawId),
    type: cred.type,
    response,
  }
  if (cred.authenticatorAttachment) {
    out.authenticatorAttachment = cred.authenticatorAttachment
  }
  return out
}

export function webAuthnSupported(): boolean {
  return typeof window !== 'undefined' && window.PublicKeyCredential !== undefined
}
