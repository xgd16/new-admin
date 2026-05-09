package repository

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"new-admin/internal/model"
)

type FrontUser struct {
	db *gorm.DB
}

func NewFrontUser(db *gorm.DB) *FrontUser {
	return &FrontUser{db: db}
}

func (r *FrontUser) Count(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.FrontUser{}).Count(&n).Error
	return n, err
}

func (r *FrontUser) CountByStatus(ctx context.Context, status int8) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.FrontUser{}).Where("status = ?", status).Count(&n).Error
	return n, err
}

func (r *FrontUser) List(ctx context.Context, offset, limit int) ([]model.FrontUser, error) {
	var list []model.FrontUser
	err := r.db.WithContext(ctx).Order("id ASC").Offset(offset).Limit(limit).Find(&list).Error
	return list, err
}

func (r *FrontUser) applyListFilters(db *gorm.DB, f *model.FrontUserListParams) *gorm.DB {
	if f == nil {
		return db
	}
	kw := strings.TrimSpace(f.Keyword)
	kw = strings.ReplaceAll(kw, "%", "")
	kw = strings.ReplaceAll(kw, "_", "")
	if kw != "" {
		pat := "%" + kw + "%"
		db = db.Where("username LIKE ? OR nickname LIKE ? OR mobile LIKE ? OR email LIKE ?", pat, pat, pat, pat)
	}
	if f.Status != nil {
		db = db.Where("status = ?", *f.Status)
	}
	if f.CreatedFrom != nil {
		db = db.Where("created_at >= ?", *f.CreatedFrom)
	}
	if f.CreatedTo != nil {
		db = db.Where("created_at <= ?", *f.CreatedTo)
	}
	return db
}

// CountListed 按筛选条件计数（列表接口 total）。
func (r *FrontUser) CountListed(ctx context.Context, f *model.FrontUserListParams) (int64, error) {
	var n int64
	q := r.applyListFilters(r.db.WithContext(ctx).Model(&model.FrontUser{}), f)
	err := q.Count(&n).Error
	return n, err
}

// ListListed 按筛选条件分页查询。
func (r *FrontUser) ListListed(ctx context.Context, offset, limit int, f *model.FrontUserListParams) ([]model.FrontUser, error) {
	var list []model.FrontUser
	q := r.applyListFilters(r.db.WithContext(ctx).Model(&model.FrontUser{}), f)
	err := q.Order("id ASC").Offset(offset).Limit(limit).Find(&list).Error
	return list, err
}

func (r *FrontUser) FindByID(ctx context.Context, id uint64) (*model.FrontUser, error) {
	var u model.FrontUser
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&u).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *FrontUser) FindByUsername(ctx context.Context, username string) (*model.FrontUser, error) {
	return r.findOne(ctx, "username = ?", username)
}

func (r *FrontUser) FindByMobile(ctx context.Context, mobile string) (*model.FrontUser, error) {
	return r.findOne(ctx, "mobile = ?", mobile)
}

func (r *FrontUser) FindByEmail(ctx context.Context, email string) (*model.FrontUser, error) {
	return r.findOne(ctx, "email = ?", email)
}

func (r *FrontUser) Create(ctx context.Context, u *model.FrontUser) error {
	return r.db.WithContext(ctx).Create(u).Error
}

func (r *FrontUser) UpdateFields(ctx context.Context, id uint64, fields map[string]interface{}) error {
	if len(fields) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Model(&model.FrontUser{}).Where("id = ?", id).Updates(fields).Error
}

func (r *FrontUser) findOne(ctx context.Context, query string, args ...interface{}) (*model.FrontUser, error) {
	var u model.FrontUser
	err := r.db.WithContext(ctx).Where(query, args...).First(&u).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}
