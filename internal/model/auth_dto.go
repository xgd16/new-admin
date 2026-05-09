package model

type CaptchaResp struct {
	CaptchaID   string `json:"captcha_id"`
	ImageBase64 string `json:"image_base64"`
}

type LoginReq struct {
	Username    string `json:"username" binding:"required,min=1,max=64"`
	Password    string `json:"password" binding:"required,min=1,max=128"`
	CaptchaID   string `json:"captcha_id" binding:"required"`
	CaptchaCode string `json:"captcha_code" binding:"required,min=4,max=8"`
}

type LoginResp struct {
	AccessToken string       `json:"access_token"`
	TokenType   string       `json:"token_type"`
	ExpiresIn   int64        `json:"expires_in"`
	User        LoginUserDTO `json:"user"`
}

type LoginUserDTO struct {
	ID          uint64   `json:"id"`
	Username    string   `json:"username"`
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
}

type MeResp struct {
	ID          uint64   `json:"id"`
	Username    string   `json:"username"`
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
}
