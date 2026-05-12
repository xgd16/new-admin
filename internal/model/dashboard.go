package model

type DashboardMetric struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Hint  string `json:"hint"`
	Icon  string `json:"icon"`
	Tone  string `json:"tone"`
}

type DashboardStatDay struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// DashboardUserStats 前台用户维度汇总（仅 front_users；含按日趋势与短周期对比）。
type DashboardUserStats struct {
	Days              int                `json:"days"`
	FrontTotal        int64              `json:"front_total"`
	FrontEnabled      int64              `json:"front_enabled"`
	FrontDisabled     int64              `json:"front_disabled"`
	FrontNewInRange   int64              `json:"front_new_in_range"`
	FrontNewToday     int64              `json:"front_new_today"`
	FrontNewYesterday int64              `json:"front_new_yesterday"`
	FrontNewByDay     []DashboardStatDay `json:"front_new_by_day"`
}

type DashboardOverviewResp struct {
	Title     string              `json:"title"`
	Message   string              `json:"message"`
	Metrics   []DashboardMetric   `json:"metrics"`
	UserStats *DashboardUserStats `json:"user_stats"`
}
