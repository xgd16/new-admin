package service

import (
	"context"
	"errors"
	"time"

	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"new-admin/internal/jwtissuer"
	"new-admin/internal/model"
	"new-admin/internal/repository"
)

var (
	ErrAuthInvalidCred   = errors.New("invalid credential")
	ErrAuthUserDisabled  = errors.New("user disabled")
	ErrAuthUserNotFound  = errors.New("user not found")
)

type Auth struct {
	user   *repository.User
	rbac   *repository.RBAC
	jwt    *jwtissuer.Issuer
	ttl    time.Duration
	logger *zap.Logger
	audit  *Audit
}

func NewAuth(logger *zap.Logger, jwtIss *jwtissuer.Issuer, user *repository.User, rbac *repository.RBAC, ttl time.Duration, audit *Audit) *Auth {
	return &Auth{
		user:   user,
		rbac:   rbac,
		jwt:    jwtIss,
		ttl:    ttl,
		logger: logger,
		audit:  audit,
	}
}

func (s *Auth) Login(ctx context.Context, username, password string, meta ClientMeta) (*model.LoginResp, error) {
	start := time.Now()
	meta = NormalizeClientMeta(meta)
	u, err := s.user.FindByUsername(ctx, username)
	if err != nil {
		s.logger.Warn("login_db", zap.String("username", username), zap.Error(err))
		return nil, err
	}
	if u == nil {
		return nil, ErrAuthInvalidCred
	}
	if u.Status != 1 {
		return nil, ErrAuthUserDisabled
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, ErrAuthInvalidCred
	}
	roles, err := s.rbac.RoleCodesByUserID(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	perms, err := s.rbac.PermissionCodesByUserID(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	tokenStr, _, err := s.jwt.Sign(u.ID, u.Username)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if err := s.user.UpdateLastLoginAt(ctx, u.ID, now); err != nil {
		s.logger.Warn("last_login_update", zap.Uint64("user_id", u.ID), zap.Error(err))
	}
	if s.audit != nil {
		s.audit.RecordLoginSuccess(u.ID, u.Username, meta, 200, time.Since(start))
	}
	return &model.LoginResp{
		AccessToken: tokenStr,
		TokenType:   "Bearer",
		ExpiresIn:   int64(s.ttl / time.Second),
		User: model.LoginUserDTO{
			ID:          u.ID,
			Username:    u.Username,
			Roles:       roles,
			Permissions: perms,
		},
	}, nil
}

func (s *Auth) Profile(ctx context.Context, userID uint64) (*model.MeResp, error) {
	u, err := s.user.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrAuthUserNotFound
	}
	if u.Status != 1 {
		return nil, ErrAuthUserDisabled
	}
	roles, err := s.rbac.RoleCodesByUserID(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	perms, err := s.rbac.PermissionCodesByUserID(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	return &model.MeResp{
		ID:          u.ID,
		Username:    u.Username,
		Roles:       roles,
		Permissions: perms,
	}, nil
}
