package service

import (
	"context"
	"errors"
	"strings"

	"new-admin/internal/model"
	"new-admin/internal/repository"
)

var (
	ErrFrontUserNotFound          = errors.New("front user not found")
	ErrFrontUserDuplicateUsername = errors.New("front username already exists")
	ErrFrontUserDuplicateMobile   = errors.New("front user mobile already exists")
	ErrFrontUserDuplicateEmail    = errors.New("front user email already exists")
	ErrFrontUserBadRequest        = errors.New("invalid front user request")
)

type FrontUser struct {
	repo *repository.FrontUser
}

func NewFrontUser(repo *repository.FrontUser) *FrontUser {
	return &FrontUser{repo: repo}
}

func frontUserDetail(u *model.FrontUser) *model.FrontUserDetailResp {
	return &model.FrontUserDetailResp{
		ID:        u.ID,
		Username:  u.Username,
		Nickname:  u.Nickname,
		Mobile:    u.Mobile,
		Email:     u.Email,
		Status:    u.Status,
		CreatedAt: u.CreatedAt,
		UpdatedAt: u.UpdatedAt,
	}
}

func (s *FrontUser) List(ctx context.Context, page, pageSize int, params *model.FrontUserListParams) (*model.FrontUserListResp, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	total, err := s.repo.CountListed(ctx, params)
	if err != nil {
		return nil, err
	}
	users, err := s.repo.ListListed(ctx, (page-1)*pageSize, pageSize, params)
	if err != nil {
		return nil, err
	}
	list := make([]model.FrontUserListItem, 0, len(users))
	for _, u := range users {
		list = append(list, model.FrontUserListItem{
			ID:        u.ID,
			Username:  u.Username,
			Nickname:  u.Nickname,
			Mobile:    u.Mobile,
			Email:     u.Email,
			Status:    u.Status,
			CreatedAt: u.CreatedAt,
		})
	}
	return &model.FrontUserListResp{List: list, Total: total}, nil
}

func (s *FrontUser) Get(ctx context.Context, id uint64) (*model.FrontUserDetailResp, error) {
	u, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrFrontUserNotFound
	}
	return frontUserDetail(u), nil
}

func (s *FrontUser) Create(ctx context.Context, req *model.FrontUserCreateReq) (*model.FrontUserDetailResp, error) {
	username := strings.TrimSpace(req.Username)
	nickname := strings.TrimSpace(req.Nickname)
	mobile := strings.TrimSpace(req.Mobile)
	email := strings.TrimSpace(req.Email)
	if username == "" {
		return nil, ErrFrontUserBadRequest
	}
	if err := s.ensureUnique(ctx, 0, username, mobile, email); err != nil {
		return nil, err
	}
	status := req.Status
	if status != 0 && status != 1 {
		status = 1
	}
	u := &model.FrontUser{
		Username: username,
		Nickname: nickname,
		Mobile:   mobile,
		Email:    email,
		Status:   status,
	}
	if err := s.repo.Create(ctx, u); err != nil {
		return nil, err
	}
	return s.Get(ctx, u.ID)
}

func (s *FrontUser) Update(ctx context.Context, id uint64, req *model.FrontUserUpdateReq) (*model.FrontUserDetailResp, error) {
	u, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrFrontUserNotFound
	}
	username := u.Username
	mobile := u.Mobile
	email := u.Email
	fields := map[string]interface{}{}
	if req.Username != nil {
		username = strings.TrimSpace(*req.Username)
		if username == "" {
			return nil, ErrFrontUserBadRequest
		}
		fields["username"] = username
	}
	if req.Nickname != nil {
		fields["nickname"] = strings.TrimSpace(*req.Nickname)
	}
	if req.Mobile != nil {
		mobile = strings.TrimSpace(*req.Mobile)
		fields["mobile"] = mobile
	}
	if req.Email != nil {
		email = strings.TrimSpace(*req.Email)
		fields["email"] = email
	}
	if req.Status != nil {
		if *req.Status != 0 && *req.Status != 1 {
			return nil, ErrFrontUserBadRequest
		}
		fields["status"] = *req.Status
	}
	if err := s.ensureUnique(ctx, id, username, mobile, email); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateFields(ctx, id, fields); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *FrontUser) ensureUnique(ctx context.Context, selfID uint64, username, mobile, email string) error {
	if username != "" {
		u, err := s.repo.FindByUsername(ctx, username)
		if err != nil {
			return err
		}
		if u != nil && u.ID != selfID {
			return ErrFrontUserDuplicateUsername
		}
	}
	if mobile != "" {
		u, err := s.repo.FindByMobile(ctx, mobile)
		if err != nil {
			return err
		}
		if u != nil && u.ID != selfID {
			return ErrFrontUserDuplicateMobile
		}
	}
	if email != "" {
		u, err := s.repo.FindByEmail(ctx, email)
		if err != nil {
			return err
		}
		if u != nil && u.ID != selfID {
			return ErrFrontUserDuplicateEmail
		}
	}
	return nil
}
