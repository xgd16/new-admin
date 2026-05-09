package service

import (
	"context"
	"errors"
	"sort"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"new-admin/internal/model"
	"new-admin/internal/repository"
)

var (
	ErrSystemDuplicateUsername = errors.New("username already exists")
	ErrSystemDuplicateRoleCode = errors.New("role code already exists")
	ErrSystemUserNotFound      = errors.New("user not found")
	ErrSystemInvalidRole       = errors.New("invalid role id")
	ErrSystemInvalidPermission = errors.New("unknown permission code")
	ErrSystemCannotDisableSelf = errors.New("cannot disable yourself")
	ErrSystemRoleNotFound      = errors.New("role not found")
	ErrSystemWeakPassword      = errors.New("password must be at least 6 characters")
	ErrSystemBadRequest        = errors.New("invalid request")
)

type System struct {
	user *repository.User
	rbac *repository.RBAC
}

func NewSystem(user *repository.User, rbac *repository.RBAC) *System {
	return &System{user: user, rbac: rbac}
}

func uniqueUint64(ids []uint64) []uint64 {
	seen := map[uint64]struct{}{}
	var out []uint64
	for _, id := range ids {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

func uniqueStrings(codes []string) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, c := range codes {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		if _, ok := seen[c]; ok {
			continue
		}
		seen[c] = struct{}{}
		out = append(out, c)
	}
	sort.Strings(out)
	return out
}

func (s *System) ListUsers(ctx context.Context, page, pageSize int, params *model.SystemUserListParams) (*model.SystemUserListResp, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	total, err := s.user.CountListed(ctx, params)
	if err != nil {
		return nil, err
	}
	offset := (page - 1) * pageSize
	users, err := s.user.ListListed(ctx, offset, pageSize, params)
	if err != nil {
		return nil, err
	}
	list := make([]model.SystemUserListItem, 0, len(users))
	for _, u := range users {
		roles, err := s.rbac.RoleCodesByUserID(ctx, u.ID)
		if err != nil {
			return nil, err
		}
		list = append(list, model.SystemUserListItem{
			ID:          u.ID,
			Username:    u.Username,
			Status:      u.Status,
			Roles:       roles,
			LastLoginAt: u.LastLoginAt,
			CreatedAt:   u.CreatedAt,
		})
	}
	return &model.SystemUserListResp{List: list, Total: total}, nil
}

func (s *System) GetUser(ctx context.Context, id uint64) (*model.SystemUserDetailResp, error) {
	u, err := s.user.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrSystemUserNotFound
	}
	roles, err := s.rbac.RoleCodesByUserID(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	roleIDs, err := s.user.RoleIDsByUser(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	return &model.SystemUserDetailResp{
		ID:          u.ID,
		Username:    u.Username,
		Status:      u.Status,
		RoleIDs:     roleIDs,
		Roles:       roles,
		LastLoginAt: u.LastLoginAt,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}, nil
}

func (s *System) CreateUser(ctx context.Context, req *model.SystemUserCreateReq) (*model.SystemUserDetailResp, error) {
	dup, err := s.user.FindByUsername(ctx, req.Username)
	if err != nil {
		return nil, err
	}
	if dup != nil {
		return nil, ErrSystemDuplicateUsername
	}
	roleIDs := uniqueUint64(req.RoleIDs)
	ok, err := s.rbac.RoleIDsExist(ctx, roleIDs)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrSystemInvalidRole
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	status := req.Status
	if status != 0 && status != 1 {
		status = 1
	}
	u := &model.User{
		Username:     req.Username,
		PasswordHash: string(hash),
		Status:       status,
	}
	if err := s.user.Create(ctx, u); err != nil {
		return nil, err
	}
	if err := s.user.ReplaceUserRoles(ctx, u.ID, roleIDs); err != nil {
		return nil, err
	}
	return s.GetUser(ctx, u.ID)
}

func (s *System) UpdateUser(ctx context.Context, actorID, id uint64, req *model.SystemUserUpdateReq) (*model.SystemUserDetailResp, error) {
	u, err := s.user.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrSystemUserNotFound
	}
	fields := map[string]interface{}{}
	if req.Username != nil {
		t := strings.TrimSpace(*req.Username)
		if t == "" {
			return nil, ErrSystemBadRequest
		}
		other, err := s.user.FindByUsername(ctx, t)
		if err != nil {
			return nil, err
		}
		if other != nil && other.ID != id {
			return nil, ErrSystemDuplicateUsername
		}
		fields["username"] = t
	}
	if req.Password != nil && *req.Password != "" {
		if len(*req.Password) < 6 {
			return nil, ErrSystemWeakPassword
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		fields["password_hash"] = string(hash)
	}
	if req.Status != nil {
		if *req.Status != 0 && *req.Status != 1 {
			return nil, ErrSystemBadRequest
		}
		if *req.Status == 0 && actorID == id {
			return nil, ErrSystemCannotDisableSelf
		}
		fields["status"] = *req.Status
	}
	if len(fields) > 0 {
		if err := s.user.UpdateFields(ctx, id, fields); err != nil {
			return nil, err
		}
	}
	if req.RoleIDs != nil {
		roleIDs := uniqueUint64(*req.RoleIDs)
		if len(roleIDs) == 0 {
			return nil, ErrSystemInvalidRole
		}
		ok, err := s.rbac.RoleIDsExist(ctx, roleIDs)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrSystemInvalidRole
		}
		if err := s.user.ReplaceUserRoles(ctx, id, roleIDs); err != nil {
			return nil, err
		}
	}
	return s.GetUser(ctx, id)
}

func (s *System) ListRoles(ctx context.Context) ([]model.SystemRoleItem, error) {
	roles, err := s.rbac.ListRoles(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]model.SystemRoleItem, 0, len(roles))
	for _, r := range roles {
		codes, err := s.rbac.PermissionCodesByRoleID(ctx, r.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, model.SystemRoleItem{
			ID:              r.ID,
			Code:            r.Code,
			Name:            r.Name,
			PermissionCodes: codes,
		})
	}
	return out, nil
}

func (s *System) GetRole(ctx context.Context, id uint64) (*model.SystemRoleItem, error) {
	role, err := s.rbac.FindRoleByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if role == nil {
		return nil, ErrSystemRoleNotFound
	}
	codes, err := s.rbac.PermissionCodesByRoleID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &model.SystemRoleItem{
		ID:              role.ID,
		Code:            role.Code,
		Name:            role.Name,
		PermissionCodes: codes,
	}, nil
}

func (s *System) CreateRole(ctx context.Context, req *model.SystemRoleCreateReq) (*model.SystemRoleItem, error) {
	code := strings.TrimSpace(req.Code)
	name := strings.TrimSpace(req.Name)
	if code == "" || name == "" {
		return nil, ErrSystemBadRequest
	}
	dup, err := s.rbac.FindRoleByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	if dup != nil {
		return nil, ErrSystemDuplicateRoleCode
	}
	codes := uniqueStrings(req.PermissionCodes)
	idMap, err := s.rbac.PermissionIDMapByCodes(ctx, codes)
	if err != nil {
		return nil, err
	}
	for _, c := range codes {
		if _, ok := idMap[c]; !ok {
			return nil, ErrSystemInvalidPermission
		}
	}
	ids := make([]uint64, 0, len(codes))
	for _, c := range codes {
		ids = append(ids, idMap[c])
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	role := &model.Role{Code: code, Name: name}
	if err := s.rbac.CreateRole(ctx, role, ids); err != nil {
		return nil, err
	}
	return s.GetRole(ctx, role.ID)
}

func (s *System) ListPermissions(ctx context.Context) ([]model.SystemPermissionItem, error) {
	perms, err := s.rbac.ListPermissions(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]model.SystemPermissionItem, 0, len(perms))
	for _, p := range perms {
		out = append(out, model.SystemPermissionItem{ID: p.ID, Code: p.Code, Name: p.Name})
	}
	return out, nil
}

func (s *System) UpdateRolePermissions(ctx context.Context, roleID uint64, codes []string) (*model.SystemRoleItem, error) {
	role, err := s.rbac.FindRoleByID(ctx, roleID)
	if err != nil {
		return nil, err
	}
	if role == nil {
		return nil, ErrSystemRoleNotFound
	}
	uq := uniqueStrings(codes)
	idMap, err := s.rbac.PermissionIDMapByCodes(ctx, uq)
	if err != nil {
		return nil, err
	}
	for _, c := range uq {
		if _, ok := idMap[c]; !ok {
			return nil, ErrSystemInvalidPermission
		}
	}
	ids := make([]uint64, 0, len(uq))
	for _, c := range uq {
		ids = append(ids, idMap[c])
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	if err := s.rbac.ReplaceRolePermissions(ctx, roleID, ids); err != nil {
		return nil, err
	}
	return s.GetRole(ctx, roleID)
}
