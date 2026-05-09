package model

type DashboardMetric struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Hint  string `json:"hint"`
	Icon  string `json:"icon"`
	Tone  string `json:"tone"`
}

type DashboardOverviewResp struct {
	Title   string            `json:"title"`
	Message string            `json:"message"`
	Metrics []DashboardMetric `json:"metrics"`
}
