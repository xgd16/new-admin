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

// OperationLogStatsResp 时间窗口内聚合统计（用于操作日志页看板）。
type OperationLogStatsResp struct {
	Days           int                  `json:"days"`
	Since          time.Time            `json:"since"`
	TotalInRange   int64                `json:"total_in_range"`
	AvgDurationMs  float64              `json:"avg_duration_ms"`
	ByMethod       []OpLogStatCountItem `json:"by_method"`
	ByStatusBucket []OpLogStatCountItem `json:"by_status_bucket"`
	ByDay          []OpLogStatDayItem   `json:"by_day"`
	TopUsers       []OpLogStatUserItem  `json:"top_users"`
}

type OpLogStatCountItem struct {
	Key   string `json:"key"`
	Count int64  `json:"count"`
}

type OpLogStatDayItem struct {
	Date  string `json:"date"` // YYYY-MM-DD
	Count int64  `json:"count"`
}

type OpLogStatUserItem struct {
	UserID   uint64 `json:"user_id"`
	Username string `json:"username"`
	Count    int64  `json:"count"`
}
