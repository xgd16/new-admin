package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/go-webauthn/webauthn/webauthn"
	"gorm.io/gorm"

	"new-admin/internal/model"
)

// ErrWebauthnCredentialNotFound 无匹配行（用户与 DB id 不一致或已删除）。
var ErrWebauthnCredentialNotFound = errors.New("webauthn credential not found")

type WebauthnCred struct {
	db *gorm.DB
}

func NewWebauthnCred(db *gorm.DB) *WebauthnCred {
	return &WebauthnCred{db: db}
}

// ListRowsForUser 按创建时间倒序返回表行（含 DB id，便于列表与删除）。
func (r *WebauthnCred) ListRowsForUser(ctx context.Context, userID uint64) ([]model.WebauthnCredentialRow, error) {
	var rows []model.WebauthnCredentialRow
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&rows).Error
	return rows, err
}

// DeleteByUserAndID 删除属于某用户的指定凭据记录。
func (r *WebauthnCred) DeleteByUserAndID(ctx context.Context, userID uint64, id uint64) error {
	res := r.db.WithContext(ctx).
		Where("user_id = ? AND id = ?", userID, id).
		Delete(&model.WebauthnCredentialRow{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrWebauthnCredentialNotFound
	}
	return nil
}

// ListCredentials 加载用户全部通行密钥凭据。
func (r *WebauthnCred) ListCredentials(ctx context.Context, userID uint64) ([]webauthn.Credential, error) {
	var rows []model.WebauthnCredentialRow
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]webauthn.Credential, 0, len(rows))
	for i := range rows {
		var c webauthn.Credential
		if err := json.Unmarshal(rows[i].CredentialJSON, &c); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

func (r *WebauthnCred) Upsert(ctx context.Context, userID uint64, cred *webauthn.Credential) error {
	b, err := json.Marshal(cred)
	if err != nil {
		return err
	}
	row := model.WebauthnCredentialRow{
		UserID:         userID,
		CredentialID:   cred.ID,
		CredentialJSON: b,
		SignCount:      cred.Authenticator.SignCount,
	}
	var existing model.WebauthnCredentialRow
	err = r.db.WithContext(ctx).Where("credential_id = ?", cred.ID).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return r.db.WithContext(ctx).Create(&row).Error
	}
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Model(&model.WebauthnCredentialRow{}).
		Where("credential_id = ?", cred.ID).
		Updates(map[string]interface{}{
			"credential_json": row.CredentialJSON,
			"sign_count":      row.SignCount,
		}).Error
}

func (r *WebauthnCred) CountByUserID(ctx context.Context, userID uint64) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.WebauthnCredentialRow{}).Where("user_id = ?", userID).Count(&n).Error
	return n, err
}
