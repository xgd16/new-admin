package service

import (
	"context"
	"fmt"
	"runtime"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type HealthResp struct {
	Status string `json:"status"`
	GoVer  string `json:"go_version"`
	MySQL  string `json:"mysql"`
	Redis  string `json:"redis"`
}

type HealthService struct {
	db  *gorm.DB
	rdb *redis.Client
}

func NewHealthService(db *gorm.DB, rdb *redis.Client) *HealthService {
	return &HealthService{db: db, rdb: rdb}
}

func (s *HealthService) Check(ctx context.Context) HealthResp {
	resp := HealthResp{
		Status: "up",
		GoVer:  runtime.Version(),
	}

	resp.MySQL = pingMySQL(ctx, s.db)
	resp.Redis = pingRedis(ctx, s.rdb)
	return resp
}

func pingMySQL(ctx context.Context, db *gorm.DB) string {
	if db == nil {
		return "skipped"
	}
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Sprintf("error: %v", err)
	}
	if err := sqlDB.PingContext(ctx); err != nil {
		return fmt.Sprintf("error: %v", err)
	}
	return "ok"
}

func pingRedis(ctx context.Context, rdb *redis.Client) string {
	if rdb == nil {
		return "skipped"
	}
	if err := rdb.Ping(ctx).Err(); err != nil {
		return fmt.Sprintf("error: %v", err)
	}
	return "ok"
}
