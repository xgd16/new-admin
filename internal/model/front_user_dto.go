package model

import "time"

type FrontUserListItem struct {
	ID        uint64    `json:"id"`
	Username  string    `json:"username"`
	Nickname  string    `json:"nickname"`
	Mobile    string    `json:"mobile"`
	Email     string    `json:"email"`
	Status    int8      `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type FrontUserListResp struct {
	List  []FrontUserListItem `json:"list"`
	Total int64               `json:"total"`
}

// FrontUserListParams 列表查询筛选（query 解析后传入 service / repository）。
type FrontUserListParams struct {
	Keyword     string
	Status      *int8 // nil 表示不限
	CreatedFrom *time.Time
	CreatedTo   *time.Time
}

type FrontUserDetailResp struct {
	ID        uint64    `json:"id"`
	Username  string    `json:"username"`
	Nickname  string    `json:"nickname"`
	Mobile    string    `json:"mobile"`
	Email     string    `json:"email"`
	Status    int8      `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type FrontUserCreateReq struct {
	Username string `json:"username" binding:"required,min=1,max=64"`
	Nickname string `json:"nickname" binding:"max=128"`
	Mobile   string `json:"mobile" binding:"max=32"`
	Email    string `json:"email" binding:"max=128"`
	Status   int8   `json:"status"`
}

type FrontUserUpdateReq struct {
	Username *string `json:"username"`
	Nickname *string `json:"nickname"`
	Mobile   *string `json:"mobile"`
	Email    *string `json:"email"`
	Status   *int8   `json:"status"`
}
