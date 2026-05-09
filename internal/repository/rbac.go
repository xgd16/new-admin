package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"new-admin/internal/model"
)

type RBAC struct {
	db *gorm.DB
}

func NewRBAC(db *gorm.DB) *RBAC {
	return &RBAC{db: db}
}

func (r *RBAC) RoleCodesByUserID(ctx context.Context, userID uint64) ([]string, error) {
	var codes []string
	err := r.db.WithContext(ctx).Raw(`
SELECT DISTINCT r.code FROM roles r
INNER JOIN user_roles ur ON ur.role_id = r.id
WHERE ur.user_id = ?
ORDER BY r.code`, userID).Scan(&codes).Error
	return codes, err
}

func (r *RBAC) PermissionCodesByUserID(ctx context.Context, userID uint64) ([]string, error) {
	var codes []string
	err := r.db.WithContext(ctx).Raw(`
SELECT DISTINCT p.code FROM permissions p
INNER JOIN role_permissions rp ON rp.permission_id = p.id
INNER JOIN user_roles ur ON ur.role_id = rp.role_id
WHERE ur.user_id = ?
ORDER BY p.code`, userID).Scan(&codes).Error
	return codes, err
}

func (r *RBAC) UserHasPermission(ctx context.Context, userID uint64, perm string) (bool, error) {
	var n int64
	err := r.db.WithContext(ctx).Raw(`
SELECT COUNT(*) FROM permissions p
INNER JOIN role_permissions rp ON rp.permission_id = p.id
INNER JOIN user_roles ur ON ur.role_id = rp.role_id
WHERE ur.user_id = ? AND p.code = ?
`, userID, perm).Scan(&n).Error
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

func (r *RBAC) CountRoles(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.Role{}).Count(&n).Error
	return n, err
}

func (r *RBAC) CountPermissions(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.Permission{}).Count(&n).Error
	return n, err
}

func (r *RBAC) ListRoles(ctx context.Context) ([]model.Role, error) {
	var roles []model.Role
	err := r.db.WithContext(ctx).Order("id ASC").Find(&roles).Error
	return roles, err
}

func (r *RBAC) FindRoleByID(ctx context.Context, id uint64) (*model.Role, error) {
	var role model.Role
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&role).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &role, nil
}

func (r *RBAC) FindRoleByCode(ctx context.Context, code string) (*model.Role, error) {
	var role model.Role
	err := r.db.WithContext(ctx).Where("code = ?", code).First(&role).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &role, nil
}

func (r *RBAC) CreateRole(ctx context.Context, role *model.Role, permissionIDs []uint64) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(role).Error; err != nil {
			return err
		}
		for _, pid := range permissionIDs {
			if err := tx.Create(&model.RolePermission{RoleID: role.ID, PermissionID: pid}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *RBAC) ListPermissions(ctx context.Context) ([]model.Permission, error) {
	var list []model.Permission
	err := r.db.WithContext(ctx).Order("code ASC").Find(&list).Error
	return list, err
}

func (r *RBAC) PermissionCodesByRoleID(ctx context.Context, roleID uint64) ([]string, error) {
	var codes []string
	err := r.db.WithContext(ctx).Raw(`
SELECT p.code FROM permissions p
INNER JOIN role_permissions rp ON rp.permission_id = p.id
WHERE rp.role_id = ?
ORDER BY p.code`, roleID).Scan(&codes).Error
	return codes, err
}

func (r *RBAC) RoleIDsExist(ctx context.Context, ids []uint64) (bool, error) {
	if len(ids) == 0 {
		return true, nil
	}
	var n int64
	err := r.db.WithContext(ctx).Model(&model.Role{}).Where("id IN ?", ids).Count(&n).Error
	if err != nil {
		return false, err
	}
	return n == int64(len(ids)), nil
}

func (r *RBAC) PermissionIDMapByCodes(ctx context.Context, codes []string) (map[string]uint64, error) {
	if len(codes) == 0 {
		return map[string]uint64{}, nil
	}
	var perms []model.Permission
	if err := r.db.WithContext(ctx).Where("code IN ?", codes).Find(&perms).Error; err != nil {
		return nil, err
	}
	m := make(map[string]uint64, len(perms))
	for _, p := range perms {
		m[p.Code] = p.ID
	}
	return m, nil
}

func (r *RBAC) ReplaceRolePermissions(ctx context.Context, roleID uint64, permissionIDs []uint64) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", roleID).Delete(&model.RolePermission{}).Error; err != nil {
			return err
		}
		for _, pid := range permissionIDs {
			if err := tx.Create(&model.RolePermission{RoleID: roleID, PermissionID: pid}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
