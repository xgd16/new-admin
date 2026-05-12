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

// DashboardUserStats 用户维度汇总（近 N 日新增 + 按日趋势）。
type DashboardUserStats struct {
	Days            int                `json:"days"`
	FrontNewInRange int64              `json:"front_new_in_range"`
	AdminNewInRange int64              `json:"admin_new_in_range"`
	FrontNewByDay   []DashboardStatDay `json:"front_new_by_day"`
	AdminNewByDay   []DashboardStatDay `json:"admin_new_by_day"`
}

type DashboardOverviewResp struct {
	Title     string              `json:"title"`
	Message   string              `json:"message"`
	Metrics   []DashboardMetric   `json:"metrics"`
	UserStats *DashboardUserStats `json:"user_stats"`
}
