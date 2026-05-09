package store

import (
	"fmt"
	"net/url"

	"new-admin/internal/config"
)

// MySQLMigrateURL 返回 golang-migrate 所需的 MySQL URL（含 multiStatements，便于单文件多语句）。
func MySQLMigrateURL(cfg config.MySQL) string {
	user := url.UserPassword(cfg.User, cfg.Password)
	q := url.Values{}
	q.Set("multiStatements", "true")
	q.Set("parseTime", "true")
	q.Set("charset", cfg.Charset)
	q.Set("loc", "Local")

	return fmt.Sprintf(
		"mysql://%s@tcp(%s:%d)/%s?%s",
		user.String(),
		cfg.Host,
		cfg.Port,
		cfg.DBName,
		q.Encode(),
	)
}
