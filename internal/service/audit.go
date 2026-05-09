package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.uber.org/zap"

	"new-admin/internal/model"
	"new-admin/internal/repository"
	"new-admin/pkg/xlsx"
)

const auditInsertTimeout = 3 * time.Second

const (
	exportOpLogsDefault       = 10_000
	exportOpLogsHardMax       = 50_000
	exportOpLogsFilenameTime  = "2006-01-02_15-04-05" // 本地时间，精确到秒
	exportOpLogXLSXTimeLayout = "2006-01-02 15:04:05" // 表格「时间」列：YYYY-MM-DD HH:mm:ss
)

func clampExportOpLogLimit(n int) int {
	if n < 1 {
		return exportOpLogsDefault
	}
	if n > exportOpLogsHardMax {
		return exportOpLogsHardMax
	}
	return n
}

type Audit struct {
	repo *repository.AdminOpLog
	log  *zap.Logger
}

func NewAudit(repo *repository.AdminOpLog, log *zap.Logger) *Audit {
	if log == nil {
		log = zap.NewNop()
	}
	return &Audit{repo: repo, log: log.Named("audit")}
}

func clampStr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// RecordDetached 异步写入，避免拖慢接口；失败仅打日志。
func (s *Audit) RecordDetached(row *model.AdminOperationLog) {
	if s == nil || s.repo == nil {
		return
	}
	copyRow := *row
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), auditInsertTimeout)
		defer cancel()
		if err := s.repo.Insert(ctx, &copyRow); err != nil {
			s.log.Warn("audit_insert_failed", zap.Error(err))
		}
	}()
}

func (s *Audit) RecordLoginSuccess(userID uint64, username string, meta ClientMeta, statusCode int, d time.Duration) {
	if s == nil {
		return
	}
	ms := uint32(d.Milliseconds())
	if ms == 0 {
		ms = 1
	}
	s.RecordDetached(&model.AdminOperationLog{
		UserID:     userID,
		Username:   clampStr(username, 64),
		Method:     "POST",
		Path:       "/admin/v1/auth/login",
		Query:      "",
		IP:         clampStr(meta.IP, 64),
		UserAgent:  clampStr(meta.UserAgent, 512),
		StatusCode: statusCode,
		DurationMs: ms,
	})
}

func (s *Audit) ListLogs(ctx context.Context, page, pageSize int) (*model.AdminOperationLogListResp, error) {
	if s == nil || s.repo == nil {
		return &model.AdminOperationLogListResp{List: []model.AdminOperationLogListItem{}, Total: 0}, nil
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	total, err := s.repo.Count(ctx)
	if err != nil {
		return nil, err
	}
	offset := (page - 1) * pageSize
	logs, err := s.repo.ListDesc(ctx, offset, pageSize)
	if err != nil {
		return nil, err
	}
	items := make([]model.AdminOperationLogListItem, 0, len(logs))
	for _, e := range logs {
		items = append(items, model.AdminOperationLogListItem{
			ID:         e.ID,
			UserID:     e.UserID,
			Username:   e.Username,
			Method:     e.Method,
			Path:       e.Path,
			Query:      e.Query,
			IP:         e.IP,
			UserAgent:  e.UserAgent,
			StatusCode: e.StatusCode,
			DurationMs: e.DurationMs,
			CreatedAt:  e.CreatedAt,
			Summary:    OpLogSummary(e.Method, e.Path),
		})
	}
	return &model.AdminOperationLogListResp{List: items, Total: total}, nil
}

// ExportOperationLogsXLSX 将最近至多 limit 条操作日志导出为 xlsx；limit 会被限制在合理范围内。
func (s *Audit) ExportOperationLogsXLSX(ctx context.Context, limit int) ([]byte, string, error) {
	if s == nil || s.repo == nil {
		return nil, "", errors.New("audit: nil")
	}
	limit = clampExportOpLogLimit(limit)
	logs, err := s.repo.ListDescLimited(ctx, limit)
	if err != nil {
		return nil, "", err
	}
	wb, err := xlsx.NewBuilder("操作日志")
	if err != nil {
		return nil, "", err
	}
	header := []any{"ID", "用户ID", "用户名", "操作摘要", "方法", "路径", "查询串", "IP", "User-Agent", "HTTP状态", "耗时(ms)", "时间"}
	if err := wb.AppendRow(header); err != nil {
		return nil, "", err
	}
	for _, e := range logs {
		row := []any{
			e.ID,
			e.UserID,
			e.Username,
			OpLogSummary(e.Method, e.Path),
			e.Method,
			e.Path,
			e.Query,
			e.IP,
			e.UserAgent,
			e.StatusCode,
			e.DurationMs,
			e.CreatedAt.In(time.Local).Format(exportOpLogXLSXTimeLayout),
		}
		if err := wb.AppendRow(row); err != nil {
			return nil, "", err
		}
	}
	data, err := wb.Bytes()
	if err != nil {
		return nil, "", err
	}
	name := "operation_logs_" + time.Now().In(time.Local).Format(exportOpLogsFilenameTime) + ".xlsx"
	return data, name, nil
}

// ClientMeta 登录等场景由 HTTP 注入，不含敏感 body。
type ClientMeta struct {
	IP        string
	UserAgent string
}

func NormalizeClientMeta(meta ClientMeta) ClientMeta {
	return ClientMeta{
		IP:        strings.TrimSpace(meta.IP),
		UserAgent: strings.TrimSpace(meta.UserAgent),
	}
}
