package service

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"
)

var (
	reSystemUserByID            = regexp.MustCompile(`/system/users/\d+$`)
	reSystemRolePermissionsByID = regexp.MustCompile(`/system/roles/\d+/permissions$`)
	reFrontUserByID             = regexp.MustCompile(`/front/users/\d+$`)
)

// normalizeAuditAPIPrefix 兼容历史上可能记录的 /api/v1 前缀。
func normalizeAuditAPIPrefix(path string) string {
	path = strings.TrimSpace(path)
	if strings.HasPrefix(path, "/api/v1") {
		return "/admin/v1" + strings.TrimPrefix(path, "/api/v1")
	}
	return path
}

// auditPathTemplate 将实际请求路径归一为 Gin 路由模板形式（含 :id），便于映射文案。
func auditPathTemplate(path string) string {
	p := normalizeAuditAPIPrefix(path)
	if strings.Contains(p, ":") {
		return p
	}
	switch {
	case reSystemRolePermissionsByID.MatchString(p):
		return reSystemRolePermissionsByID.ReplaceAllString(p, `/system/roles/:id/permissions`)
	case reSystemUserByID.MatchString(p):
		return reSystemUserByID.ReplaceAllString(p, `/system/users/:id`)
	case reFrontUserByID.MatchString(p):
		return reFrontUserByID.ReplaceAllString(p, `/front/users/:id`)
	default:
		return p
	}
}

// opSummaryTable 方法 + 归一路径 -> 中文说明（不含请求体细节）。
var opSummaryTable = map[string]string{
	http.MethodPost + " /admin/v1/auth/login":                    "登录后台",
	http.MethodPost + " /admin/v1/system/users":                  "新建后台用户",
	http.MethodPatch + " /admin/v1/system/users/:id":             "编辑后台用户",
	http.MethodPost + " /admin/v1/system/roles":                  "新建角色",
	http.MethodPatch + " /admin/v1/system/roles/:id/permissions": "更新角色权限",
	http.MethodPost + " /admin/v1/front/users":                   "新建前台用户",
	http.MethodPatch + " /admin/v1/front/users/:id":              "编辑前台用户",
}

// OpLogSummary 返回列表展示用的操作说明。
func OpLogSummary(method, path string) string {
	m := strings.ToUpper(strings.TrimSpace(method))
	tpl := auditPathTemplate(path)
	key := m + " " + tpl
	if s, ok := opSummaryTable[key]; ok {
		return s
	}
	return fallbackOpSummary(m, normalizeAuditAPIPrefix(path))
}

func fallbackOpSummary(method, rawPath string) string {
	verb := "请求"
	switch method {
	case http.MethodPost:
		verb = "提交"
	case http.MethodPatch:
		verb = "修改"
	case http.MethodPut:
		verb = "更新"
	case http.MethodDelete:
		verb = "删除"
	}
	return fmt.Sprintf("%s · %s", verb, rawPath)
}
