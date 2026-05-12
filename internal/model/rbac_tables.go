package model

import "time"

// 与 migrations/000002 表结构对齐，供 GORM 查询使用。

type User struct {
	ID           uint64     `gorm:"column:id;primaryKey"`
	Username     string     `gorm:"column:username"`
	PasswordHash string     `gorm:"column:password_hash"`
	Status       int8       `gorm:"column:status"`
	LastLoginAt  *time.Time `gorm:"column:last_login_at"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (User) TableName() string {
	return "users"
}

type Role struct {
	ID        uint64 `gorm:"column:id;primaryKey"`
	Code      string `gorm:"column:code"`
	Name      string `gorm:"column:name"`
	CreatedAt time.Time
}

func (Role) TableName() string {
	return "roles"
}

type Permission struct {
	ID        uint64 `gorm:"column:id;primaryKey"`
	Code      string `gorm:"column:code"`
	Name      string `gorm:"column:name"`
	CreatedAt time.Time
}

func (Permission) TableName() string {
	return "permissions"
}

type UserRole struct {
	UserID uint64 `gorm:"column:user_id;primaryKey"`
	RoleID uint64 `gorm:"column:role_id;primaryKey"`
}

func (UserRole) TableName() string {
	return "user_roles"
}

type RolePermission struct {
	RoleID       uint64 `gorm:"column:role_id;primaryKey"`
	PermissionID uint64 `gorm:"column:permission_id;primaryKey"`
}

func (RolePermission) TableName() string {
	return "role_permissions"
}

type FrontUser struct {
	ID        uint64 `gorm:"column:id;primaryKey"`
	Username  string `gorm:"column:username"`
	Nickname  string `gorm:"column:nickname"`
	Mobile    string `gorm:"column:mobile"`
	Email     string `gorm:"column:email"`
	Status    int8   `gorm:"column:status"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (FrontUser) TableName() string {
	return "front_users"
}


// WebauthnCredentialRow 表 webauthn_credentials（migrations/000005）。
type WebauthnCredentialRow struct {
	ID             uint64    `gorm:"column:id;primaryKey;autoIncrement"`
	UserID         uint64    `gorm:"column:user_id;index:idx_webauthn_cred_user"`
	CredentialID   []byte    `gorm:"column:credential_id;uniqueIndex:uk_webauthn_credential_id;size:1023"`
	CredentialJSON []byte    `gorm:"column:credential_json;type:json"`
	SignCount      uint32    `gorm:"column:sign_count"`
	CreatedAt      time.Time `gorm:"column:created_at"`
}

func (WebauthnCredentialRow) TableName() string { return "webauthn_credentials" }
