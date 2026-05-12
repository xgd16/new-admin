/** 与后端 pkg/response 一致 */
export type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

export const TOKEN_STORAGE_KEY = 'new_admin_access_token'

export type LoginUser = {
  id: number
  username: string
  roles: string[]
  permissions: string[]
}

export type LoginData = {
  access_token: string
  token_type: string
  expires_in: number
  user: LoginUser
}

export type CaptchaResp = {
  captcha_id: string
  image_base64: string
}

export type MeData = LoginUser

/** 与 pkg/errcode.Forbidden 一致 */
export const ERR_FORBIDDEN = 40301

export type SystemUserListItem = {
  id: number
  username: string
  status: number
  roles: string[]
  last_login_at?: string | null
  created_at: string
}

export type SystemUserListResp = {
  list: SystemUserListItem[]
  total: number
}

export type SystemUserDetailResp = {
  id: number
  username: string
  status: number
  role_ids: number[]
  roles: string[]
  last_login_at?: string | null
  created_at: string
  updated_at: string
}

export type SystemRoleItem = {
  id: number
  code: string
  name: string
  permission_codes: string[]
}

export type SystemPermissionItem = {
  id: number
  code: string
  name: string
}

export type FrontUserListItem = {
  id: number
  username: string
  nickname: string
  mobile: string
  email: string
  status: number
  created_at: string
}

export type FrontUserListResp = {
  list: FrontUserListItem[]
  total: number
}

export type FrontUserDetailResp = {
  id: number
  username: string
  nickname: string
  mobile: string
  email: string
  status: number
  created_at: string
  updated_at: string
}

export type OperationLogListItem = {
  id: number
  user_id: number
  username: string
  /** 中文操作摘要（由服务端根据方法与路由推导） */
  summary: string
  method: string
  path: string
  query: string
  ip: string
  user_agent: string
  status_code: number
  duration_ms: number
  created_at: string
}

export type OperationLogListResp = {
  list: OperationLogListItem[]
  total: number
}

export type OperationLogStatCountItem = {
  key: string
  count: number
}

export type OperationLogStatDayItem = {
  date: string
  count: number
}

export type OperationLogStatUserItem = {
  user_id: number
  username: string
  count: number
}

export type OperationLogStatsResp = {
  days: number
  since: string
  total_in_range: number
  avg_duration_ms: number
  by_method: OperationLogStatCountItem[]
  by_status_bucket: OperationLogStatCountItem[]
  by_day: OperationLogStatDayItem[]
  top_users: OperationLogStatUserItem[]
}
