package service

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"

	"new-admin/internal/model"
	"new-admin/internal/repository"
)

var (
	ErrPasskeyNoCredentials      = errors.New("no passkeys for user")
	ErrPasskeyCredentialNotFound = errors.New("passkey credential not found")
)

type webAuthnUser struct {
	id       uint64
	username string
	creds    []webauthn.Credential
}

func (u *webAuthnUser) WebAuthnID() []byte {
	b := make([]byte, 64)
	binary.BigEndian.PutUint64(b, u.id)
	return b
}

func (u *webAuthnUser) WebAuthnName() string {
	return u.username
}

func (u *webAuthnUser) WebAuthnDisplayName() string {
	return u.username
}

func (u *webAuthnUser) WebAuthnCredentials() []webauthn.Credential {
	return u.creds
}

func webAuthnUserIDFromSession(sessionUserID []byte) uint64 {
	if len(sessionUserID) < 8 {
		return 0
	}
	return binary.BigEndian.Uint64(sessionUserID[:8])
}

func newWebAuthnUser(u *model.User, creds []webauthn.Credential) *webAuthnUser {
	return &webAuthnUser{id: u.ID, username: u.Username, creds: creds}
}

// Passkey 通行密钥注册与登录。
type Passkey struct {
	w        *webauthn.WebAuthn
	sessions *PasskeySessionStore
	users    *repository.User
	creds    *repository.WebauthnCred
	auth     *Auth
}

func NewPasskey(w *webauthn.WebAuthn, sessions *PasskeySessionStore, users *repository.User, creds *repository.WebauthnCred, auth *Auth) *Passkey {
	return &Passkey{w: w, sessions: sessions, users: users, creds: creds, auth: auth}
}

func (p *Passkey) enabled() bool {
	return p != nil && p.w != nil && p.sessions != nil && p.creds != nil && p.auth != nil
}

// BeginLogin 返回 WebAuthn 断言选项；session 写入 Redis。
func (p *Passkey) BeginLogin(ctx context.Context, username string) (sessionKey string, assertion *protocol.CredentialAssertion, err error) {
	if !p.enabled() {
		return "", nil, errors.New("passkey not configured")
	}
	username = strings.TrimSpace(username)
	u, err := p.users.FindByUsername(ctx, username)
	if err != nil {
		return "", nil, err
	}
	if u == nil {
		return "", nil, ErrAuthInvalidCred
	}
	if u.Status != 1 {
		return "", nil, ErrAuthUserDisabled
	}
	credList, err := p.creds.ListCredentials(ctx, u.ID)
	if err != nil {
		return "", nil, err
	}
	if len(credList) == 0 {
		return "", nil, ErrPasskeyNoCredentials
	}
	wu := newWebAuthnUser(u, credList)
	assert, sess, err := p.w.BeginLogin(wu)
	if err != nil {
		return "", nil, err
	}
	key, err := p.sessions.Save(ctx, *sess)
	if err != nil {
		return "", nil, err
	}
	return key, assert, nil
}

// FinishLogin 校验断言并签发 JWT。
func (p *Passkey) FinishLogin(ctx context.Context, sessionKey string, credJSON []byte, meta ClientMeta) (*model.LoginResp, error) {
	if !p.enabled() {
		return nil, errors.New("passkey not configured")
	}
	sess, err := p.sessions.Take(ctx, sessionKey)
	if err != nil {
		return nil, err
	}
	uid := webAuthnUserIDFromSession(sess.UserID)
	if uid == 0 {
		return nil, errors.New("invalid session user")
	}
	u, err := p.users.FindByID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrAuthUserNotFound
	}
	if u.Status != 1 {
		return nil, ErrAuthUserDisabled
	}
	credList, err := p.creds.ListCredentials(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	wu := newWebAuthnUser(u, credList)
	parsed, err := protocol.ParseCredentialRequestResponseBytes(credJSON)
	if err != nil {
		return nil, err
	}
	cred, err := p.w.ValidateLogin(wu, sess, parsed)
	if err != nil {
		return nil, err
	}
	if err := p.creds.Upsert(ctx, u.ID, cred); err != nil {
		return nil, err
	}
	return p.auth.LoginWithVerifiedUser(ctx, u.ID, meta)
}

// BeginRegistration 已登录用户绑定新通行密钥。
func (p *Passkey) BeginRegistration(ctx context.Context, userID uint64) (sessionKey string, creation *protocol.CredentialCreation, err error) {
	if !p.enabled() {
		return "", nil, errors.New("passkey not configured")
	}
	u, err := p.users.FindByID(ctx, userID)
	if err != nil {
		return "", nil, err
	}
	if u == nil {
		return "", nil, ErrAuthUserNotFound
	}
	if u.Status != 1 {
		return "", nil, ErrAuthUserDisabled
	}
	credList, err := p.creds.ListCredentials(ctx, u.ID)
	if err != nil {
		return "", nil, err
	}
	wu := newWebAuthnUser(u, credList)
	create, sess, err := p.w.BeginRegistration(wu)
	if err != nil {
		return "", nil, err
	}
	key, err := p.sessions.Save(ctx, *sess)
	if err != nil {
		return "", nil, err
	}
	return key, create, nil
}

// FinishRegistration 持久化新凭据。
func (p *Passkey) FinishRegistration(ctx context.Context, userID uint64, sessionKey string, credJSON []byte) error {
	if !p.enabled() {
		return errors.New("passkey not configured")
	}
	sess, err := p.sessions.Take(ctx, sessionKey)
	if err != nil {
		return err
	}
	if webAuthnUserIDFromSession(sess.UserID) != userID {
		return errors.New("session user mismatch")
	}
	u, err := p.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if u == nil {
		return ErrAuthUserNotFound
	}
	credList, err := p.creds.ListCredentials(ctx, u.ID)
	if err != nil {
		return err
	}
	wu := newWebAuthnUser(u, credList)
	parsed, err := protocol.ParseCredentialCreationResponseBytes(credJSON)
	if err != nil {
		return err
	}
	cred, err := p.w.CreateCredential(wu, sess, parsed)
	if err != nil {
		return err
	}
	return p.creds.Upsert(ctx, u.ID, cred)
}

// ListCredentialItems 已绑定通行密钥列表（支持多设备绑定）。
func (p *Passkey) ListCredentialItems(ctx context.Context, userID uint64) ([]model.PasskeyCredentialItem, error) {
	if !p.enabled() {
		return nil, errors.New("passkey not configured")
	}
	rows, err := p.creds.ListRowsForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]model.PasskeyCredentialItem, 0, len(rows))
	for i := range rows {
		var c webauthn.Credential
		if err := json.Unmarshal(rows[i].CredentialJSON, &c); err != nil {
			return nil, err
		}
		transports := make([]string, len(c.Transport))
		for j, t := range c.Transport {
			transports[j] = string(t)
		}
		aaguidHex := ""
		if len(c.Authenticator.AAGUID) > 0 {
			aaguidHex = fmt.Sprintf("%x", c.Authenticator.AAGUID)
		}
		out = append(out, model.PasskeyCredentialItem{
			ID:             rows[i].ID,
			Transports:     transports,
			Attachment:     string(c.Authenticator.Attachment),
			BackupEligible: c.Flags.BackupEligible,
			BackupState:    c.Flags.BackupState,
			SignCount:      rows[i].SignCount,
			CreatedAt:      rows[i].CreatedAt.Format(time.RFC3339Nano),
			AAGUIDHex:      aaguidHex,
		})
	}
	return out, nil
}

// DeleteCredential 解绑一条通行密钥（按 webauthn_credentials 表主键，且须属于当前用户）。
func (p *Passkey) DeleteCredential(ctx context.Context, userID uint64, credentialTableID uint64) error {
	if !p.enabled() {
		return errors.New("passkey not configured")
	}
	err := p.creds.DeleteByUserAndID(ctx, userID, credentialTableID)
	if err != nil {
		if errors.Is(err, repository.ErrWebauthnCredentialNotFound) {
			return ErrPasskeyCredentialNotFound
		}
		return err
	}
	return nil
}

// CountByUser 返回已绑定通行密钥数量。
func (p *Passkey) CountByUser(ctx context.Context, userID uint64) (int64, error) {
	if p == nil || p.creds == nil {
		return 0, nil
	}
	return p.creds.CountByUserID(ctx, userID)
}
