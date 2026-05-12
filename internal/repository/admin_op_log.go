package repository

import (
	"context"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"

	"new-admin/internal/model"
)

type AdminOpLog struct {
	db *gorm.DB
}

func NewAdminOpLog(db *gorm.DB) *AdminOpLog {
	return &AdminOpLog{db: db}
}

const opLogKeywordMaxRunes = 200

func clampOpLogKeyword(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if utf8.RuneCountInString(s) <= opLogKeywordMaxRunes {
		return s
	}
	r := []rune(s)
	return strings.TrimSpace(string(r[:opLogKeywordMaxRunes]))
}

func opLogLikePattern(q string) string {
	q = strings.ReplaceAll(q, `\`, `\\`)
	q = strings.ReplaceAll(q, `%`, `\%`)
	q = strings.ReplaceAll(q, `_`, `\_`)
	return "%" + q + "%"
}

// applyOpLogKeywordAll 在多列上 OR 模糊匹配（keyword 需已 clamp）。
func (r *AdminOpLog) applyOpLogKeywordAll(tx *gorm.DB, q string) *gorm.DB {
	pat := opLogLikePattern(q)
	conds := []string{
		"username LIKE ?",
		"path LIKE ?",
		"`query` LIKE ?",
		"method LIKE ?",
		"ip LIKE ?",
		"user_agent LIKE ?",
		"CAST(status_code AS CHAR) LIKE ?",
	}
	args := []interface{}{pat, pat, pat, pat, pat, pat, pat}
	if id, err := strconv.ParseUint(q, 10, 64); err == nil {
		conds = append(conds, "user_id = ?")
		args = append(args, id)
	}
	clause := "(" + strings.Join(conds, " OR ") + ")"
	return tx.Where(clause, args...)
}

// field 取值：all / username / path / query / method / ip / user_agent / status / user_id（大小写不敏感）；未知值按全部字段处理。
func (r *AdminOpLog) applyOpLogKeyword(tx *gorm.DB, keyword, field string) *gorm.DB {
	q := clampOpLogKeyword(keyword)
	if q == "" {
		return tx
	}
	f := strings.ToLower(strings.TrimSpace(field))
	if f == "" || f == "all" {
		return r.applyOpLogKeywordAll(tx, q)
	}
	pat := opLogLikePattern(q)
	switch f {
	case "username":
		return tx.Where("username LIKE ?", pat)
	case "path":
		return tx.Where("path LIKE ?", pat)
	case "query":
		return tx.Where("`query` LIKE ?", pat)
	case "method":
		return tx.Where("method LIKE ?", pat)
	case "ip":
		return tx.Where("ip LIKE ?", pat)
	case "user_agent":
		return tx.Where("user_agent LIKE ?", pat)
	case "status", "status_code":
		return tx.Where("CAST(status_code AS CHAR) LIKE ?", pat)
	case "user_id":
		if id, err := strconv.ParseUint(q, 10, 64); err == nil {
			return tx.Where("user_id = ?", id)
		}
		return tx.Where("CAST(user_id AS CHAR) LIKE ?", pat)
	default:
		return r.applyOpLogKeywordAll(tx, q)
	}
}

// applyOpLogOperation 按「操作」类型收窄（与 service.OpLogSummary 中已登记的路由一致；unknown/空 不筛选）。
func (r *AdminOpLog) applyOpLogOperation(tx *gorm.DB, key string) *gorm.DB {
	k := strings.ToLower(strings.TrimSpace(key))
	if k == "" || k == "all" {
		return tx
	}
	switch k {
	case "auth_login":
		return tx.Where("(method = ? AND (path = ? OR path = ?))", "POST", "/admin/v1/auth/login", "/api/v1/auth/login")
	case "system_user_create":
		return tx.Where("(method = ? AND (path = ? OR path = ?))", "POST", "/admin/v1/system/users", "/api/v1/system/users")
	case "system_user_update":
		return tx.Where(`method = ? AND (
			path IN (?, ?) OR path REGEXP ? OR path REGEXP ?
		)`, "PATCH",
			"/admin/v1/system/users/:id", "/api/v1/system/users/:id",
			`^/admin/v1/system/users/[0-9]+$`, `^/api/v1/system/users/[0-9]+$`)
	case "system_role_create":
		return tx.Where("(method = ? AND (path = ? OR path = ?))", "POST", "/admin/v1/system/roles", "/api/v1/system/roles")
	case "system_role_permissions":
		return tx.Where(`method = ? AND (
			path IN (?, ?) OR path REGEXP ? OR path REGEXP ?
		)`, "PATCH",
			"/admin/v1/system/roles/:id/permissions", "/api/v1/system/roles/:id/permissions",
			`^/admin/v1/system/roles/[0-9]+/permissions$`, `^/api/v1/system/roles/[0-9]+/permissions$`)
	case "front_user_create":
		return tx.Where("(method = ? AND (path = ? OR path = ?))", "POST", "/admin/v1/front/users", "/api/v1/front/users")
	case "front_user_update":
		return tx.Where(`method = ? AND (
			path IN (?, ?) OR path REGEXP ? OR path REGEXP ?
		)`, "PATCH",
			"/admin/v1/front/users/:id", "/api/v1/front/users/:id",
			`^/admin/v1/front/users/[0-9]+$`, `^/api/v1/front/users/[0-9]+$`)
	default:
		return tx
	}
}

func (r *AdminOpLog) Insert(ctx context.Context, row *model.AdminOperationLog) error {
	return r.db.WithContext(ctx).Create(row).Error
}

func (r *AdminOpLog) Count(ctx context.Context, keyword, field, operation string) (int64, error) {
	var n int64
	tx := r.db.WithContext(ctx).Model(&model.AdminOperationLog{})
	tx = r.applyOpLogOperation(tx, operation)
	tx = r.applyOpLogKeyword(tx, keyword, field)
	err := tx.Count(&n).Error
	return n, err
}

func (r *AdminOpLog) ListDesc(ctx context.Context, offset, limit int, keyword, field, operation string) ([]model.AdminOperationLog, error) {
	var list []model.AdminOperationLog
	tx := r.db.WithContext(ctx).Model(&model.AdminOperationLog{})
	tx = r.applyOpLogOperation(tx, operation)
	tx = r.applyOpLogKeyword(tx, keyword, field)
	err := tx.Order("id DESC").Offset(offset).Limit(limit).Find(&list).Error
	return list, err
}

// ListDescLimited 按 id 倒序取最新至多 limit 条（用于导出等场景）。
func (r *AdminOpLog) ListDescLimited(ctx context.Context, limit int, keyword, field, operation string) ([]model.AdminOperationLog, error) {
	if limit < 1 {
		limit = 1
	}
	var list []model.AdminOperationLog
	tx := r.db.WithContext(ctx).Model(&model.AdminOperationLog{})
	tx = r.applyOpLogOperation(tx, operation)
	tx = r.applyOpLogKeyword(tx, keyword, field)
	err := tx.Order("id DESC").Limit(limit).Find(&list).Error
	return list, err
}

func (r *AdminOpLog) CountSince(ctx context.Context, since time.Time) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.AdminOperationLog{}).Where("created_at >= ?", since).Count(&n).Error
	return n, err
}

func (r *AdminOpLog) AvgDurationSince(ctx context.Context, since time.Time) (float64, error) {
	var avg float64
	err := r.db.WithContext(ctx).Model(&model.AdminOperationLog{}).
		Where("created_at >= ?", since).
		Select("COALESCE(AVG(duration_ms), 0)").Scan(&avg).Error
	return avg, err
}

// StatsByMethodSince 按 HTTP 方法聚合。
func (r *AdminOpLog) StatsByMethodSince(ctx context.Context, since time.Time) ([]model.OpLogStatCountItem, error) {
	type row struct {
		Method string
		Cnt    int64
	}
	var rows []row
	err := r.db.WithContext(ctx).Model(&model.AdminOperationLog{}).
		Select("method AS method, COUNT(*) AS cnt").
		Where("created_at >= ?", since).
		Group("method").
		Order("cnt DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]model.OpLogStatCountItem, 0, len(rows))
	for _, x := range rows {
		out = append(out, model.OpLogStatCountItem{Key: x.Method, Count: x.Cnt})
	}
	return out, nil
}

// StatsByStatusBucketSince 按 HTTP 状态码区间聚合。
func (r *AdminOpLog) StatsByStatusBucketSince(ctx context.Context, since time.Time) ([]model.OpLogStatCountItem, error) {
	type row struct {
		Bucket string
		Cnt    int64
	}
	sql := `
SELECT bucket, COUNT(*) AS cnt FROM (
  SELECT id,
    CASE
      WHEN status_code >= 200 AND status_code < 300 THEN '2xx'
      WHEN status_code >= 300 AND status_code < 400 THEN '3xx'
      WHEN status_code >= 400 AND status_code < 500 THEN '4xx'
      WHEN status_code >= 500 THEN '5xx'
      ELSE 'other'
    END AS bucket
  FROM admin_operation_logs
  WHERE created_at >= ?
) t
GROUP BY bucket
ORDER BY FIELD(bucket, '2xx', '3xx', '4xx', '5xx', 'other')
`
	var rows []row
	err := r.db.WithContext(ctx).Raw(sql, since).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]model.OpLogStatCountItem, 0, len(rows))
	for _, x := range rows {
		out = append(out, model.OpLogStatCountItem{Key: x.Bucket, Count: x.Cnt})
	}
	return out, nil
}

// StatsByDaySince 按本地日期（DATE）聚合，用于趋势。
func (r *AdminOpLog) StatsByDaySince(ctx context.Context, since time.Time) ([]model.OpLogStatDayItem, error) {
	type row struct {
		Day string
		Cnt int64
	}
	var rows []row
	err := r.db.WithContext(ctx).Raw(`
SELECT DATE(created_at) AS day, COUNT(*) AS cnt
FROM admin_operation_logs
WHERE created_at >= ?
GROUP BY DATE(created_at)
ORDER BY day ASC
`, since).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]model.OpLogStatDayItem, 0, len(rows))
	for _, x := range rows {
		out = append(out, model.OpLogStatDayItem{Date: x.Day, Count: x.Cnt})
	}
	return out, nil
}

// TopUsersSince 操作次数最多的用户（至多 limit 条）。
func (r *AdminOpLog) TopUsersSince(ctx context.Context, since time.Time, limit int) ([]model.OpLogStatUserItem, error) {
	if limit < 1 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}
	type row struct {
		UserID   uint64
		Username string
		Cnt      int64
	}
	var rows []row
	err := r.db.WithContext(ctx).Model(&model.AdminOperationLog{}).
		Select("user_id AS user_id, username AS username, COUNT(*) AS cnt").
		Where("created_at >= ?", since).
		Group("user_id, username").
		Order("cnt DESC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]model.OpLogStatUserItem, 0, len(rows))
	for _, x := range rows {
		out = append(out, model.OpLogStatUserItem{UserID: x.UserID, Username: x.Username, Count: x.Cnt})
	}
	return out, nil
}
