package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"new-admin/internal/model"
)

type User struct {
	db *gorm.DB
}

func NewUser(db *gorm.DB) *User {
	return &User{db: db}
}

func (r *User) FindByUsername(ctx context.Context, username string) (*model.User, error) {
	var u model.User
	err := r.db.WithContext(ctx).Where("username = ?", username).First(&u).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *User) FindByID(ctx context.Context, id uint64) (*model.User, error) {
	var u model.User
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&u).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *User) Count(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.User{}).Count(&n).Error
	return n, err
}

func (r *User) CountByStatus(ctx context.Context, status int8) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.User{}).Where("status = ?", status).Count(&n).Error
	return n, err
}

func (r *User) List(ctx context.Context, offset, limit int) ([]model.User, error) {
	var list []model.User
	err := r.db.WithContext(ctx).Order("id ASC").Offset(offset).Limit(limit).Find(&list).Error
	return list, err
}

func (r *User) applySystemUserListFilters(db *gorm.DB, f *model.SystemUserListParams) *gorm.DB {
	if f == nil {
		return db
	}
	kw := strings.TrimSpace(f.Keyword)
	kw = strings.ReplaceAll(kw, "%", "")
	kw = strings.ReplaceAll(kw, "_", "")
	if kw != "" {
		pat := "%" + kw + "%"
		db = db.Where("username LIKE ?", pat)
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
	if f.RoleID != nil && *f.RoleID > 0 {
		db = db.Where(
			"EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = users.id AND ur.role_id = ?)",
			*f.RoleID,
		)
	}
	return db
}

// CountListed 按筛选统计后台用户数。
func (r *User) CountListed(ctx context.Context, f *model.SystemUserListParams) (int64, error) {
	var n int64
	q := r.applySystemUserListFilters(r.db.WithContext(ctx).Model(&model.User{}), f)
	err := q.Count(&n).Error
	return n, err
}

// ListListed 按筛选分页查询后台用户。
func (r *User) ListListed(ctx context.Context, offset, limit int, f *model.SystemUserListParams) ([]model.User, error) {
	var list []model.User
	q := r.applySystemUserListFilters(r.db.WithContext(ctx).Model(&model.User{}), f)
	err := q.Order("id ASC").Offset(offset).Limit(limit).Find(&list).Error
	return list, err
}

func (r *User) Create(ctx context.Context, u *model.User) error {
	return r.db.WithContext(ctx).Create(u).Error
}

func (r *User) UpdateFields(ctx context.Context, id uint64, fields map[string]interface{}) error {
	if len(fields) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Model(&model.User{}).Where("id = ?", id).Updates(fields).Error
}

func (r *User) UpdateLastLoginAt(ctx context.Context, id uint64, t time.Time) error {
	return r.db.WithContext(ctx).Model(&model.User{}).Where("id = ?", id).
		Update("last_login_at", t).Error
}

func (r *User) ReplaceUserRoles(ctx context.Context, userID uint64, roleIDs []uint64) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&model.UserRole{}).Error; err != nil {
			return err
		}
		for _, rid := range roleIDs {
			if err := tx.Create(&model.UserRole{UserID: userID, RoleID: rid}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *User) RoleIDsByUser(ctx context.Context, userID uint64) ([]uint64, error) {
	var ids []uint64
	err := r.db.WithContext(ctx).Model(&model.UserRole{}).
		Where("user_id = ?", userID).
		Order("role_id ASC").
		Pluck("role_id", &ids).Error
	return ids, err
}
