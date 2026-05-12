package model

import "encoding/json"

// PasskeyLoginBeginReq 通行密钥登录第一步：按用户名查找已绑定的凭据。
type PasskeyLoginBeginReq struct {
	Username string `json:"username" binding:"required,min=1,max=64"`
}

// PasskeyLoginBeginResp 返回 WebAuthn 断言选项与短时 session_key（Redis）。
type PasskeyLoginBeginResp struct {
	SessionKey string          `json:"session_key"`
	Options    json.RawMessage `json:"options"`
}

// PasskeyLoginFinishReq 客户端将 navigator.credentials.get() 的 JSON 放入 credential。
type PasskeyLoginFinishReq struct {
	SessionKey string          `json:"session_key" binding:"required"`
	Credential json.RawMessage `json:"credential" binding:"required"`
}

// PasskeyRegisterBeginResp 已登录用户绑定新通行密钥。
type PasskeyRegisterBeginResp struct {
	SessionKey string          `json:"session_key"`
	Options    json.RawMessage `json:"options"`
}

// PasskeyRegisterFinishReq 注册完成请求。
type PasskeyRegisterFinishReq struct {
	SessionKey string          `json:"session_key" binding:"required"`
	Credential json.RawMessage `json:"credential" binding:"required"`
}

// PasskeyCredentialItem 已绑定通行密钥展示项（多设备并列）。
type PasskeyCredentialItem struct {
	ID             uint64   `json:"id"`
	Transports     []string `json:"transports"`
	Attachment     string   `json:"attachment"`
	BackupEligible bool     `json:"backup_eligible"`
	BackupState    bool     `json:"backup_state"`
	SignCount      uint32   `json:"sign_count"`
	CreatedAt      string   `json:"created_at"`
	AAGUIDHex      string   `json:"aaguid_hex,omitempty"`
}

// PasskeyCredentialListResp GET /auth/passkey/credentials
type PasskeyCredentialListResp struct {
	List []PasskeyCredentialItem `json:"list"`
}
