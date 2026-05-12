package model

import "time"

type SystemUserListItem struct {
	ID          uint64     `json:"id"`
	Username    string     `json:"username"`
	Status      int8       `json:"status"`
	Roles       []string   `json:"roles"` // 展示名，与 roles.name 一致
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type SystemUserListResp struct {
	List  []SystemUserListItem `json:"list"`
	Total int64                `json:"total"`
}

// SystemUserListParams 后台用户列表筛选（query 解析）。
type SystemUserListParams struct {
	Keyword     string
	Status      *int8
	CreatedFrom *time.Time
	CreatedTo   *time.Time
	RoleID      *uint64
}

type SystemUserDetailResp struct {
	ID          uint64     `json:"id"`
	Username    string     `json:"username"`
	Status      int8       `json:"status"`
	RoleIDs     []uint64   `json:"role_ids"`
	Roles       []string   `json:"roles"` // 展示名，与 roles.name 一致
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type SystemUserCreateReq struct {
	Username string   `json:"username" binding:"required,min=1,max=64"`
	Password string   `json:"password" binding:"required,min=6,max=128"`
	RoleIDs  []uint64 `json:"role_ids" binding:"required,min=1"`
	Status   int8     `json:"status"`
}

type SystemUserUpdateReq struct {
	Username *string   `json:"username"`
	Password *string   `json:"password"`
	Status   *int8     `json:"status"`
	RoleIDs  *[]uint64 `json:"role_ids"`
}

type SystemRoleItem struct {
	ID              uint64   `json:"id"`
	Code            string   `json:"code"`
	Name            string   `json:"name"`
	PermissionCodes []string `json:"permission_codes"`
}

type SystemRoleCreateReq struct {
	Code            string   `json:"code" binding:"required,min=1,max=64"`
	Name            string   `json:"name" binding:"required,min=1,max=128"`
	PermissionCodes []string `json:"permission_codes"`
}

type SystemPermissionItem struct {
	ID   uint64 `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

type SystemUpdateRolePermissionsReq struct {
	PermissionCodes []string `json:"permission_codes"`
}
