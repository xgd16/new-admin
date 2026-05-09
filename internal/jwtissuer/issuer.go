package jwtissuer

import (
	"fmt"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID   uint64 `json:"uid"`
	Username string `json:"usr"`
	jwtlib.RegisteredClaims
}

type Issuer struct {
	secret     []byte
	ttl        time.Duration
	issuerName string
}

func New(secret string, ttl time.Duration, issuer string) (*Issuer, error) {
	if len(secret) == 0 {
		return nil, fmt.Errorf("jwt secret is empty")
	}
	if ttl <= 0 {
		return nil, fmt.Errorf("jwt ttl must be positive")
	}
	if issuer == "" {
		issuer = "new-admin"
	}
	return &Issuer{
		secret:     []byte(secret),
		ttl:        ttl,
		issuerName: issuer,
	}, nil
}

func (i *Issuer) Sign(userID uint64, username string) (token string, exp time.Time, err error) {
	now := time.Now()
	exp = now.Add(i.ttl)
	claims := Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwtlib.RegisteredClaims{
			ExpiresAt: jwtlib.NewNumericDate(exp),
			IssuedAt:  jwtlib.NewNumericDate(now),
			NotBefore: jwtlib.NewNumericDate(now),
			Issuer:    i.issuerName,
			Subject:   fmt.Sprintf("%d", userID),
		},
	}
	t := jwtlib.NewWithClaims(jwtlib.SigningMethodHS256, &claims)
	token, err = t.SignedString(i.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return token, exp, nil
}

func (i *Issuer) Parse(tokenStr string) (*Claims, error) {
	tok, err := jwtlib.ParseWithClaims(tokenStr, &Claims{}, func(t *jwtlib.Token) (any, error) {
		if _, ok := t.Method.(*jwtlib.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return i.secret, nil
	})
	if err != nil || tok == nil {
		return nil, fmt.Errorf("parse jwt: %w", err)
	}
	claims, ok := tok.Claims.(*Claims)
	if !ok || !tok.Valid {
		return nil, fmt.Errorf("invalid jwt claims")
	}
	return claims, nil
}
