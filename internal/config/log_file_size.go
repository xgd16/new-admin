package config

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// applyLogFileMaxSize 将 log.file_max_size（人类可读）解析为 lumberjack 的 MaxSize（MiB 整数）。
// 非空时覆盖已解析的 file_max_megabytes；空字符串则保留 file_max_megabytes。
//
// 支持示例：50M、50MB、1G、512K、1048576B；无单位纯数字按 MiB 计（与历史上 file_max_megabytes 一致）。
func applyLogFileMaxSize(log *Log) error {
	s := strings.TrimSpace(log.FileMaxSize)
	if s == "" {
		return nil
	}
	mb, err := parseHumanSizeToLumberjackMiB(s)
	if err != nil {
		return err
	}
	log.FileMaxMegabytes = mb
	return nil
}

func parseHumanSizeToLumberjackMiB(raw string) (int, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return 0, nil
	}
	s = strings.ReplaceAll(s, " ", "")
	upper := strings.ToUpper(s)
	if upper == "0" {
		return 0, nil
	}

	var mult float64 = 1 // n * mult = MiB（lumberjack 内部按 MaxSize*1024*1024 判满）
	numStr := s

	switch {
	case strings.HasSuffix(upper, "TIB"):
		mult = 1024 * 1024
		numStr = s[:len(s)-3]
	case strings.HasSuffix(upper, "TB"):
		mult = 1024 * 1024
		numStr = s[:len(s)-2]
	case strings.HasSuffix(upper, "T"):
		mult = 1024 * 1024
		numStr = s[:len(s)-1]
	case strings.HasSuffix(upper, "GIB"):
		mult = 1024
		numStr = s[:len(s)-3]
	case strings.HasSuffix(upper, "GB"):
		mult = 1024
		numStr = s[:len(s)-2]
	case strings.HasSuffix(upper, "G"):
		mult = 1024
		numStr = s[:len(s)-1]
	case strings.HasSuffix(upper, "MIB"):
		mult = 1
		numStr = s[:len(s)-3]
	case strings.HasSuffix(upper, "MB"):
		mult = 1
		numStr = s[:len(s)-2]
	case strings.HasSuffix(upper, "M"):
		mult = 1
		numStr = s[:len(s)-1]
	case strings.HasSuffix(upper, "KIB"):
		mult = 1.0 / 1024
		numStr = s[:len(s)-3]
	case strings.HasSuffix(upper, "KB"):
		mult = 1.0 / 1024
		numStr = s[:len(s)-2]
	case strings.HasSuffix(upper, "K"):
		mult = 1.0 / 1024
		numStr = s[:len(s)-1]
	case strings.HasSuffix(upper, "B") && len(s) > 1:
		mult = 1.0 / (1024 * 1024)
		numStr = s[:len(s)-1]
	}

	numStr = strings.TrimSpace(numStr)
	if numStr == "" {
		return 0, fmt.Errorf("log.file_max_size: %q 缺少数值", raw)
	}
	n, err := strconv.ParseFloat(numStr, 64)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("log.file_max_size: %q 数值无效", raw)
	}
	if n == 0 {
		return 0, nil
	}
	mib := n * mult
	if mib > float64(math.MaxInt32) {
		return 0, fmt.Errorf("log.file_max_size: %q 数值过大", raw)
	}
	mb := int(math.Ceil(mib - 1e-12))
	if mb < 1 {
		mb = 1
	}
	return mb, nil
}
