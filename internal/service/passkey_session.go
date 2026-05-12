package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const (
	webauthnRedisKeyPrefix = "new-admin:webauthn:sess:"
	webauthnSessionTTL     = 5 * time.Minute
)

// PasskeySessionStore 在 Redis 中存放 WebAuthn SessionData（一次性消费）。
type PasskeySessionStore struct {
	rdb *redis.Client
}

func NewPasskeySessionStore(rdb *redis.Client) *PasskeySessionStore {
	if rdb == nil {
		return nil
	}
	return &PasskeySessionStore{rdb: rdb}
}

func (s *PasskeySessionStore) Save(ctx context.Context, data webauthn.SessionData) (id string, err error) {
	if s == nil || s.rdb == nil {
		return "", errors.New("webauthn session store unavailable")
	}
	b, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	id = uuid.NewString()
	key := webauthnRedisKeyPrefix + id
	if err := s.rdb.Set(ctx, key, b, webauthnSessionTTL).Err(); err != nil {
		return "", err
	}
	return id, nil
}

// Take 读取并删除会话（防重放）。
func (s *PasskeySessionStore) Take(ctx context.Context, id string) (webauthn.SessionData, error) {
	var zero webauthn.SessionData
	if s == nil || s.rdb == nil {
		return zero, errors.New("webauthn session store unavailable")
	}
	id = strings.TrimSpace(id)
	if id == "" || len(id) > 64 {
		return zero, errors.New("invalid session id")
	}
	key := webauthnRedisKeyPrefix + id
	b, err := s.rdb.GetDel(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return zero, fmt.Errorf("session expired or unknown")
		}
		return zero, err
	}
	var data webauthn.SessionData
	if err := json.Unmarshal(b, &data); err != nil {
		return zero, err
	}
	return data, nil
}
