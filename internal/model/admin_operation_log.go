package model

import "time"

// AdminOperationLog 与 migrations/000004 admin_operation_logs 一致。

type AdminOperationLog struct {
	ID         uint64    `gorm:"column:id;primaryKey"`
	UserID     uint64    `gorm:"column:user_id"`
	Username   string    `gorm:"column:username;size:64"`
	Method     string    `gorm:"column:method;size:16"`
	Path       string    `gorm:"column:path;size:512"`
	Query      string    `gorm:"column:query;size:2048"`
	IP         string    `gorm:"column:ip;size:64"`
	UserAgent  string    `gorm:"column:user_agent;size:512"`
	StatusCode int       `gorm:"column:status_code"`
	DurationMs uint32    `gorm:"column:duration_ms"`
	CreatedAt  time.Time `gorm:"column:created_at"`
}

func (AdminOperationLog) TableName() string {
	return "admin_operation_logs"
}

type AdminOperationLogListItem struct {
	ID         uint64    `json:"id"`
	UserID     uint64    `json:"user_id"`
	Username   string    `json:"username"`
	Method     string    `json:"method"`
	Path       string    `json:"path"`
	Query      string    `json:"query"`
	IP         string    `json:"ip"`
	UserAgent  string    `json:"user_agent"`
	StatusCode int       `json:"status_code"`
	DurationMs uint32    `json:"duration_ms"`
	CreatedAt  time.Time `json:"created_at"`
	Summary    string    `json:"summary"`
}

type AdminOperationLogListResp struct {
	List  []AdminOperationLogListItem `json:"list"`
	Total int64                       `json:"total"`
}
