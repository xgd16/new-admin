package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"

	"new-admin/internal/config"
)

// TimeLayout 终端可读本地时间（毫秒）。
const TimeLayout = "2006-01-02 15:04:05.000"

// 默认日志文件名中的时间布局（占位符 {} 为空时使用）。
const defaultLogPathTimeLayout = "2006-01-02_15-04-05"

var logFilePathBracePattern = regexp.MustCompile(`\{([^}]*)\}`)

// expandLogFilePath 将路径中的 {Go时间布局} 展开为进程启动时刻的本地时间；无占位符则原样返回。
// 例：logs/new-admin-{2006-01-02_15-04-05}.log → logs/new-admin-2026-05-08_20-30-00.log
func expandLogFilePath(path string, now time.Time) string {
	if !strings.Contains(path, "{") {
		return path
	}
	return logFilePathBracePattern.ReplaceAllStringFunc(path, func(full string) string {
		inner := full[1 : len(full)-1]
		layout := strings.TrimSpace(inner)
		if layout == "" {
			layout = defaultLogPathTimeLayout
		}
		return now.In(time.Local).Format(layout)
	})
}

func localTimeEncoder(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
	enc.AppendString(t.Local().Format(TimeLayout))
}

func baseEncoderConfig() zapcore.EncoderConfig {
	return zapcore.EncoderConfig{
		TimeKey:          "time",
		LevelKey:         "level",
		NameKey:          zapcore.OmitKey,
		CallerKey:        "caller",
		FunctionKey:      zapcore.OmitKey,
		MessageKey:       "msg",
		StacktraceKey:    "stacktrace",
		LineEnding:       zapcore.DefaultLineEnding,
		EncodeTime:       localTimeEncoder,
		EncodeDuration:   zapcore.StringDurationEncoder,
		EncodeCaller:     zapcore.ShortCallerEncoder,
		ConsoleSeparator: " | ",
	}
}

func newConsoleEncoder(format string, debugLike bool) zapcore.Encoder {
	format = strings.ToLower(strings.TrimSpace(format))
	encCfg := baseEncoderConfig()
	switch format {
	case "json":
		encCfg.EncodeLevel = zapcore.LowercaseLevelEncoder
		return zapcore.NewJSONEncoder(encCfg)
	default:
		if debugLike {
			encCfg.EncodeLevel = zapcore.CapitalColorLevelEncoder
		} else {
			encCfg.EncodeLevel = zapcore.CapitalLevelEncoder
		}
		return zapcore.NewConsoleEncoder(encCfg)
	}
}

func newFileEncoder(format string) zapcore.Encoder {
	format = strings.ToLower(strings.TrimSpace(format))
	encCfg := baseEncoderConfig()
	switch format {
	case "console":
		encCfg.EncodeLevel = zapcore.CapitalLevelEncoder
		return zapcore.NewConsoleEncoder(encCfg)
	default:
		encCfg.EncodeLevel = zapcore.LowercaseLevelEncoder
		return zapcore.NewJSONEncoder(encCfg)
	}
}

func parseStacktraceLevel(s string) *zapcore.Level {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" || s == "none" || s == "off" || s == "disable" {
		return nil
	}
	var l zapcore.Level
	if err := l.UnmarshalText([]byte(s)); err != nil {
		return nil
	}
	return &l
}

func openFileWriteSyncer(path string, maxMB, maxBackups, maxAgeDays int, compress bool) (zapcore.WriteSyncer, func(), error) {
	closeFn := func() {}
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, closeFn, fmt.Errorf("logger: empty file path")
	}
	dir := filepath.Dir(path)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, closeFn, err
		}
	}

	if maxMB <= 0 {
		f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
		if err != nil {
			return nil, closeFn, err
		}
		closeFn = func() {
			_ = f.Sync() //nolint:errcheck
			_ = f.Close()
		}
		return zapcore.AddSync(f), closeFn, nil
	}

	lj := &lumberjack.Logger{
		Filename:   path,
		MaxSize:    maxMB,
		MaxBackups: maxBackups,
		MaxAge:     maxAgeDays,
		Compress:   compress,
	}
	closeFn = func() {
		_ = lj.Close()
	}
	return zapcore.AddSync(lj), closeFn, nil
}

// New 按配置构建主 Logger（main）与访问日志专用 Logger（access），以及关闭文件句柄的回调。
// access 在 access_log_file_enabled=false 时仅绑控制台，不写文件；控制台也未启用时退回与 main 相同避免丢失访问日志。
// close 在进程退出前调用（先 Sync main 再关文件）。
func New(logCfg config.Log, serverMode string) (*zap.Logger, *zap.Logger, func(), error) {
	closeFn := func() {}

	var zapLevel zapcore.Level
	if err := zapLevel.UnmarshalText([]byte(logCfg.Level)); err != nil {
		zapLevel = zapcore.InfoLevel
	}

	serverMode = strings.ToLower(strings.TrimSpace(serverMode))
	debugLike := serverMode == "debug" || serverMode == "test"

	atomicLevel := zap.NewAtomicLevelAt(zapLevel)

	consoleFmt := strings.ToLower(strings.TrimSpace(logCfg.ConsoleFormat))
	if consoleFmt != "console" && consoleFmt != "json" {
		consoleFmt = "console"
	}
	fileFmt := strings.ToLower(strings.TrimSpace(logCfg.FileFormat))
	if fileFmt != "console" && fileFmt != "json" {
		fileFmt = "json"
	}

	var cores []zapcore.Core

	if logCfg.ConsoleEnabled {
		enc := newConsoleEncoder(consoleFmt, debugLike)
		cores = append(cores, zapcore.NewCore(enc, zapcore.AddSync(os.Stdout), atomicLevel))
	}

	if logCfg.FileEnabled {
		now := time.Now()
		path := expandLogFilePath(strings.TrimSpace(logCfg.FilePath), now)
		errPath := expandLogFilePath(strings.TrimSpace(logCfg.FileErrorPath), now)

		if path == "" && errPath == "" {
			return nil, nil, closeFn, fmt.Errorf("logger: file_enabled 为 true 时请配置 file_path 或 file_error_path")
		}

		mb, bu, age, comp := logCfg.FileMaxMegabytes, logCfg.FileMaxBackups, logCfg.FileMaxAgeDays, logCfg.FileCompress
		pushClose := func(f func()) {
			prev := closeFn
			closeFn = func() {
				f()
				prev()
			}
		}

		split := path != "" && errPath != "" && path != errPath

		switch {
		case split:
			ws1, c1, err := openFileWriteSyncer(path, mb, bu, age, comp)
			if err != nil {
				return nil, nil, closeFn, err
			}
			pushClose(c1)
			ws2, c2, err := openFileWriteSyncer(errPath, mb, bu, age, comp)
			if err != nil {
				return nil, nil, closeFn, err
			}
			pushClose(c2)
			belowErr := zap.LevelEnablerFunc(func(l zapcore.Level) bool {
				return l < zapcore.ErrorLevel && atomicLevel.Enabled(l)
			})
			atOrAboveErr := zap.LevelEnablerFunc(func(l zapcore.Level) bool {
				return l >= zapcore.ErrorLevel && atomicLevel.Enabled(l)
			})
			cores = append(cores, zapcore.NewCore(newFileEncoder(fileFmt), ws1, belowErr))
			cores = append(cores, zapcore.NewCore(newFileEncoder(fileFmt), ws2, atOrAboveErr))
		case errPath != "" && path == "":
			ws, cl, err := openFileWriteSyncer(errPath, mb, bu, age, comp)
			if err != nil {
				return nil, nil, closeFn, err
			}
			pushClose(cl)
			atOrAboveErr := zap.LevelEnablerFunc(func(l zapcore.Level) bool {
				return l >= zapcore.ErrorLevel && atomicLevel.Enabled(l)
			})
			cores = append(cores, zapcore.NewCore(newFileEncoder(fileFmt), ws, atOrAboveErr))
		default:
			effective := path
			if effective == "" {
				effective = errPath
			}
			ws, cl, err := openFileWriteSyncer(effective, mb, bu, age, comp)
			if err != nil {
				return nil, nil, closeFn, err
			}
			pushClose(cl)
			cores = append(cores, zapcore.NewCore(newFileEncoder(fileFmt), ws, atomicLevel))
		}
	}

	if len(cores) == 0 {
		return nil, nil, closeFn, fmt.Errorf("logger: 需至少启用 console_enabled，或 file_enabled 且配置 file_path / file_error_path")
	}

	opts := []zap.Option{}
	if logCfg.CallerEnabled {
		opts = append(opts, zap.AddCaller())
	}
	if st := parseStacktraceLevel(logCfg.StacktraceLevel); st != nil {
		opts = append(opts, zap.AddStacktrace(*st))
	}

	core := zapcore.NewTee(cores...)
	main := zap.New(core, opts...)

	var access *zap.Logger
	if logCfg.AccessLogFileEnabled {
		access = main.Named("access").WithOptions(zap.WithCaller(false))
	} else if logCfg.ConsoleEnabled {
		accCore := zapcore.NewCore(newConsoleEncoder(consoleFmt, debugLike), zapcore.AddSync(os.Stdout), atomicLevel)
		access = zap.New(accCore, zap.WithCaller(false))
	} else {
		access = main.Named("access").WithOptions(zap.WithCaller(false))
	}

	return main, access, closeFn, nil
}
