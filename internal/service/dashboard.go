package service

import (
	"context"
	"fmt"

	"new-admin/internal/model"
	"new-admin/internal/repository"
)

type Dashboard struct {
	user  *repository.User
	rbac  *repository.RBAC
	front *repository.FrontUser
}

func NewDashboard(user *repository.User, rbac *repository.RBAC, front *repository.FrontUser) *Dashboard {
	return &Dashboard{user: user, rbac: rbac, front: front}
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
				Hint:  fmt.Sprintf("启用 %d", frontEnabled),
				Icon:  "ri-user-heart-line",
				Tone:  "var(--warning)",
			},
		},
	}, nil
}
