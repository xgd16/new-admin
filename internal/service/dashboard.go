package service

import (
	"context"
	"fmt"
	"time"

	"new-admin/internal/model"
	"new-admin/internal/repository"
)

// 与操作日志统计默认窗口一致，便于运营对比「注册」与「操作」趋势。
const dashboardUserTrendDays = 14

type Dashboard struct {
	user  *repository.User
	rbac  *repository.RBAC
	front *repository.FrontUser
}

func NewDashboard(user *repository.User, rbac *repository.RBAC, front *repository.FrontUser) *Dashboard {
	return &Dashboard{user: user, rbac: rbac, front: front}
}

func dashboardDayKeys(since, endDay time.Time) []string {
	loc := since.Location()
	since0 := time.Date(since.Year(), since.Month(), since.Day(), 0, 0, 0, 0, loc)
	end0 := time.Date(endDay.Year(), endDay.Month(), endDay.Day(), 0, 0, 0, 0, loc)
	var keys []string
	for d := since0; !d.After(end0); d = d.AddDate(0, 0, 1) {
		keys = append(keys, d.Format("2006-01-02"))
	}
	return keys
}

func fillDashboardByDay(raw []model.DashboardStatDay, dayKeys []string) []model.DashboardStatDay {
	m := make(map[string]int64, len(raw))
	for _, x := range raw {
		m[x.Date] = x.Count
	}
	out := make([]model.DashboardStatDay, 0, len(dayKeys))
	for _, d := range dayKeys {
		out = append(out, model.DashboardStatDay{Date: d, Count: m[d]})
	}
	return out
}

func (s *Dashboard) Overview(ctx context.Context) (*model.DashboardOverviewResp, error) {
	adminTotal, err := s.user.Count(ctx)
	if err != nil {
		return nil, err
	}
	adminEnabled, err := s.user.CountByStatus(ctx, 1)
	if err != nil {
		return nil, err
	}
	roleCount, err := s.rbac.CountRoles(ctx)
	if err != nil {
		return nil, err
	}
	permCount, err := s.rbac.CountPermissions(ctx)
	if err != nil {
		return nil, err
	}
	frontTotal, err := s.front.Count(ctx)
	if err != nil {
		return nil, err
	}
	frontEnabled, err := s.front.CountByStatus(ctx, 1)
	if err != nil {
		return nil, err
	}
	frontDisabled := frontTotal - frontEnabled
	if frontDisabled < 0 {
		frontDisabled = 0
	}

	now := time.Now().In(time.Local)
	loc := now.Location()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	startOfYesterday := startOfToday.AddDate(0, 0, -1)
	since := startOfToday.AddDate(0, 0, -dashboardUserTrendDays)

	frontNew, err := s.front.CountCreatedSince(ctx, since)
	if err != nil {
		return nil, err
	}
	frontNewToday, err := s.front.CountCreatedInRange(ctx, startOfToday, startOfToday.AddDate(0, 0, 1))
	if err != nil {
		return nil, err
	}
	frontNewYesterday, err := s.front.CountCreatedInRange(ctx, startOfYesterday, startOfToday)
	if err != nil {
		return nil, err
	}
	frontByDayRaw, err := s.front.StatsCreatedByDaySince(ctx, since)
	if err != nil {
		return nil, err
	}
	dayKeys := dashboardDayKeys(since, startOfToday)
	frontByDay := fillDashboardByDay(frontByDayRaw, dayKeys)

	hintTrend := fmt.Sprintf("最近 %d 个自然日", len(dayKeys))
	hintFrontUser := fmt.Sprintf("启用 %d · 停用 %d", frontEnabled, frontDisabled)

	return &model.DashboardOverviewResp{
		Title:   "控制台",
		Message: "以下统计来自当前数据库实时汇总；需 dashboard:view 权限。",
		Metrics: []model.DashboardMetric{
			{
				Label: "后台用户",
				Value: fmt.Sprintf("%d", adminTotal),
				Hint:  fmt.Sprintf("启用 %d", adminEnabled),
				Icon:  "ri-admin-line",
				Tone:  "var(--accent)",
			},
			{
				Label: "角色",
				Value: fmt.Sprintf("%d", roleCount),
				Hint:  "RBAC 角色",
				Icon:  "ri-shield-user-line",
				Tone:  "var(--accent-2)",
			},
			{
				Label: "权限项",
				Value: fmt.Sprintf("%d", permCount),
				Hint:  "可分配权限",
				Icon:  "ri-lock-star-line",
				Tone:  "var(--accent-3)",
			},
			{
				Label: "前台用户",
				Value: fmt.Sprintf("%d", frontTotal),
				Hint:  hintFrontUser,
				Icon:  "ri-user-heart-line",
				Tone:  "var(--warning)",
			},
			{
				Label: "前台·今日新增",
				Value: fmt.Sprintf("%d", frontNewToday),
				Hint:  "按注册时间（本地日）",
				Icon:  "ri-calendar-todo-line",
				Tone:  "var(--accent)",
			},
			{
				Label: "前台·昨日新增",
				Value: fmt.Sprintf("%d", frontNewYesterday),
				Hint:  "按注册时间（本地日）",
				Icon:  "ri-calendar-line",
				Tone:  "var(--accent-2)",
			},
			{
				Label: "前台·近窗新增",
				Value: fmt.Sprintf("%d", frontNew),
				Hint:  hintTrend,
				Icon:  "ri-line-chart-line",
				Tone:  "var(--accent-3)",
			},
		},
		UserStats: &model.DashboardUserStats{
			Days:              len(dayKeys),
			FrontTotal:        frontTotal,
			FrontEnabled:      frontEnabled,
			FrontDisabled:     frontDisabled,
			FrontNewInRange:   frontNew,
			FrontNewToday:     frontNewToday,
			FrontNewYesterday: frontNewYesterday,
			FrontNewByDay:     frontByDay,
		},
	}, nil
}
