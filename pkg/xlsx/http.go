package xlsx

import (
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// MIMEType 为 Office Open XML 电子表格的媒体类型。
const MIMEType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

// WriteAttachment 将二进制以附件形式写入 HTTP 响应（适用于 Gin）。
func WriteAttachment(c *gin.Context, filename string, body []byte) {
	base := filepath.Base(strings.TrimSpace(filename))
	if base == "" || base == "." {
		base = "export.xlsx"
	}
	if !strings.HasSuffix(strings.ToLower(base), ".xlsx") {
		base += ".xlsx"
	}
	c.Header("Content-Type", MIMEType)
	c.Header("Content-Disposition", contentDisposition(base, filename))
	c.Data(http.StatusOK, MIMEType, body)
}

func asciiFallbackFilename(name string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(name) {
		if r < 128 && r != '"' && r != '\\' && r != '/' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	s := b.String()
	if s == "" {
		return "export.xlsx"
	}
	return s
}

// contentDisposition 生成 RFC 6261 / RFC 5987 兼容的 Content-Disposition。
func contentDisposition(asciiName, utf8Name string) string {
	star := url.PathEscape(strings.TrimSpace(utf8Name))
	if star == "" {
		star = url.PathEscape(asciiName)
	}
	fallback := asciiFallbackFilename(asciiName)
	return `attachment; filename="` + strings.ReplaceAll(fallback, `"`, `\"`) + `"; filename*=UTF-8''` + star
}
