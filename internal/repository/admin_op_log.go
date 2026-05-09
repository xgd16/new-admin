package repository

import (
	"context"

	"gorm.io/gorm"

	"new-admin/internal/model"
)

type AdminOpLog struct {
	db *gorm.DB
}

func NewAdminOpLog(db *gorm.DB) *AdminOpLog {
	return &AdminOpLog{db: db}
}

func (r *AdminOpLog) Insert(ctx context.Context, row *model.AdminOperationLog) error {
	return r.db.WithContext(ctx).Create(row).Error
}

func (r *AdminOpLog) Count(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.AdminOperationLog{}).Count(&n).Error
	return n, err
}

func (r *AdminOpLog) ListDesc(ctx context.Context, offset, limit int) ([]model.AdminOperationLog, error) {
	var list []model.AdminOperationLog
	err := r.db.WithContext(ctx).Order("id DESC").Offset(offset).Limit(limit).Find(&list).Error
	return list, err
}

// ListDescLimited 按 id 倒序取最新至多 limit 条（用于导出等场景）。
func (r *AdminOpLog) ListDescLimited(ctx context.Context, limit int) ([]model.AdminOperationLog, error) {
	if limit < 1 {
		limit = 1
	}
	var list []model.AdminOperationLog
	err := r.db.WithContext(ctx).Order("id DESC").Limit(limit).Find(&list).Error
	return list, err
}
