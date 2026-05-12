package logger

import (
	"bytes"
	"io"
	"os"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mattn/go-isatty"
)

const (
	ansiReset   = "\033[0m"
	ansiBold    = "\033[1m"
	ansiDim     = "\033[2m"
	ansiCyan    = "\033[36m"
	ansiYellow  = "\033[33m"
	ansiGreen   = "\033[32m"
	ansiBlue    = "\033[34m"
	ansiMagenta = "\033[35m"
	ansiRed     = "\033[31m"
	ansiWhite   = "\033[97m"
)

// 与 Gin debug 路由行一致：METHOD + 若干空白 + path + " --> handler…"
var ginRouteLine = regexp.MustCompile(`^\[GIN-debug\]\s+([A-Z]+)(\s+)(\S+)(\s+-->\s+.+)$`)

// InstallGinPrettyConsole 在 debug 模式、stdout 为终端且未设置 NO_COLOR 时，为 Gin 的
// 路由注册与警告输出行着色，减轻启动时「白墙」观感。
func InstallGinPrettyConsole(serverMode string) {
	serverMode = strings.ToLower(strings.TrimSpace(serverMode))
	if serverMode != "debug" {
		return
	}
	if os.Getenv("NO_COLOR") != "" || os.Getenv("TERM") == "dumb" {
		return
	}
	if !isatty.IsTerminal(os.Stdout.Fd()) {
		return
	}
	w := &ginDebugLineWriter{out: os.Stdout}
	gin.DefaultWriter = w
	gin.DefaultErrorWriter = w
}

type ginDebugLineWriter struct {
	out io.Writer
	buf bytes.Buffer
}

func (g *ginDebugLineWriter) Write(p []byte) (n int, err error) {
	n = len(p)
	_, _ = g.buf.Write(p)
	for {
		b := g.buf.Bytes()
		i := bytes.IndexByte(b, '\n')
		if i < 0 {
			return n, nil
		}
		line := string(b[:i+1])
		g.buf.Next(i + 1)
		if _, err = g.out.Write([]byte(colorizeGinDebugLine(line))); err != nil {
			return 0, err
		}
	}
}

func colorizeGinDebugLine(line string) string {
	if !strings.HasPrefix(line, "[GIN-debug]") {
		return line
	}
	if strings.Contains(line, "[WARNING]") {
		return ansiYellow + ansiBold + strings.TrimSuffix(line, "\n") + ansiReset + "\n"
	}

	s := strings.TrimSuffix(line, "\n")
	suffix := "\n"
	if m := ginRouteLine.FindStringSubmatch(s); len(m) == 5 {
		method := m[1]
		spAfterMethod := m[2]
		path := m[3]
		arrowAndHandler := m[4]
		tag := "[GIN-debug] "
		return ansiDim + tag + ansiReset +
			methodColor(method) + ansiBold + method + ansiReset +
			spAfterMethod + ansiBold + ansiWhite + path + ansiReset +
			ansiDim + arrowAndHandler + ansiReset + suffix
	}

	return ansiDim + s + ansiReset + suffix
}

func methodColor(m string) string {
	switch m {
	case "GET":
		return ansiGreen
	case "POST":
		return ansiYellow
	case "PUT", "PATCH":
		return ansiBlue
	case "DELETE":
		return ansiRed
	case "HEAD", "OPTIONS":
		return ansiCyan
	default:
		return ansiMagenta
	}
}
