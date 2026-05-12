package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type Server struct {
	Mode            string `mapstructure:"mode"`
	Addr            string `mapstructure:"addr"`
	ReadTimeoutSec  int    `mapstructure:"read_timeout_sec"`
	WriteTimeoutSec int    `mapstructure:"write_timeout_sec"`
}

type Log struct {
	Level                string `mapstructure:"level"`
	ConsoleEnabled       bool   `mapstructure:"console_enabled"`         // 是否输出到控制台（默认 true）
	ConsoleFormat        string `mapstructure:"console_format"`          // console | json
	FilePath             string `mapstructure:"file_path"`               // 普通日志（低于 error）；file_error_path 未配时含全部级别
	FileErrorPath        string `mapstructure:"file_error_path"`         // 非空时 error 及以上单独写入；与 file_path 均配且路径不同则拆分
	FileEnabled          bool   `mapstructure:"file_enabled"`            // 是否写文件；未配置时非空 file_path / file_error_path 则为 true
	FileFormat           string `mapstructure:"file_format"`             // json | console（文件内容格式）
	CallerEnabled        bool   `mapstructure:"caller_enabled"`          // 是否打印调用位置（默认 true）
	StacktraceLevel      string `mapstructure:"stacktrace_level"`        // none | panic | fatal | error | warn …（默认 error，不低于该级别带栈）
	AccessLogFileEnabled bool   `mapstructure:"access_log_file_enabled"` // HTTP 访问日志是否写入日志文件；false 则仅控制台（默认 true）
	FileMaxSize          string `mapstructure:"file_max_size"`           // 人类可读单文件上限，如 50M、100MB、1G；非空时覆盖 file_max_megabytes
	FileMaxMegabytes     int    `mapstructure:"file_max_megabytes"`      // 单文件上限（MiB，与 lumberjack 一致）；0=不按大小切割；通常改用 file_max_size
	FileMaxBackups       int    `mapstructure:"file_max_backups"`        // 保留历史文件个数（仅切割时，默认 7）
	FileMaxAgeDays       int    `mapstructure:"file_max_age_days"`       // 历史文件保留天数，0 表示不按天删除
	FileCompress         bool   `mapstructure:"file_compress"`           // 是否压缩轮转后的历史文件为 .gz
}

type MySQL struct {
	Host               string `mapstructure:"host"`
	Port               int    `mapstructure:"port"`
	User               string `mapstructure:"user"`
	Password           string `mapstructure:"password"`
	DBName             string `mapstructure:"dbname"`
	Charset            string `mapstructure:"charset"`
	MaxIdleConns       int    `mapstructure:"max_idle_conns"`
	MaxOpenConns       int    `mapstructure:"max_open_conns"`
	ConnMaxLifetimeMin int    `mapstructure:"conn_max_lifetime_min"`
}

type Redis struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type JWT struct {
	Secret       string `mapstructure:"secret"`
	AccessTTLMin int    `mapstructure:"access_ttl_min"`
}

// CORS 仅对列出的前端 Origin（含协议与端口）回显 Allow-Origin，与前端直接请求后端对齐。
type CORS struct {
	AllowedOrigins []string `mapstructure:"allowed_origins"`
}

// Static 本地静态文件目录（相对进程工作目录或绝对路径）。
// 上传目录须登录后访问；公开目录无需认证。
type Static struct {
	// UploadRoot 服务端本地上传文件根目录；非空时挂载到 /admin/v1/uploads/，须 Bearer JWT。
	UploadRoot string `mapstructure:"upload_root"`
	// PublicRoot 公开静态资源根目录；非空时挂载到 /public/v1/，匿名可访问。
	PublicRoot string `mapstructure:"public_root"`
}

type Config struct {
	Server Server `mapstructure:"server"`
	Log    Log    `mapstructure:"log"`
	MySQL  MySQL  `mapstructure:"mysql"`
	Redis  Redis  `mapstructure:"redis"`
	JWT    JWT    `mapstructure:"jwt"`
	CORS   CORS   `mapstructure:"cors"`
	Static Static `mapstructure:"static"`
}

func Load(configPath string) (*Config, error) {
	v := viper.New()
	v.SetConfigFile(configPath)
	v.SetEnvPrefix("NEW_ADMIN")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	if cfg.Server.Mode == "" {
		cfg.Server.Mode = "debug"
	}
	if cfg.Server.Addr == "" {
		cfg.Server.Addr = ":8080"
	}
	if cfg.Server.ReadTimeoutSec <= 0 {
		cfg.Server.ReadTimeoutSec = 30
	}
	if cfg.Server.WriteTimeoutSec <= 0 {
		cfg.Server.WriteTimeoutSec = 30
	}
	if cfg.Log.Level == "" {
		cfg.Log.Level = "info"
	}
	if err := applyLogFileMaxSize(&cfg.Log); err != nil {
		return nil, err
	}
	applyLogDefaults(&cfg, v)

	if cfg.MySQL.Host == "" {
		cfg.MySQL.Host = "127.0.0.1"
	}
	if cfg.MySQL.Port <= 0 {
		cfg.MySQL.Port = 3306
	}
	if cfg.MySQL.User == "" {
		cfg.MySQL.User = "root"
	}
	if cfg.MySQL.DBName == "" {
		cfg.MySQL.DBName = "new_admin"
	}
	if cfg.MySQL.Charset == "" {
		cfg.MySQL.Charset = "utf8mb4"
	}
	if cfg.MySQL.MaxIdleConns <= 0 {
		cfg.MySQL.MaxIdleConns = 10
	}
	if cfg.MySQL.MaxOpenConns <= 0 {
		cfg.MySQL.MaxOpenConns = 100
	}
	if cfg.MySQL.ConnMaxLifetimeMin <= 0 {
		cfg.MySQL.ConnMaxLifetimeMin = 60
	}

	if cfg.Redis.Addr == "" {
		cfg.Redis.Addr = "127.0.0.1:6379"
	}

	if cfg.JWT.AccessTTLMin <= 0 {
		cfg.JWT.AccessTTLMin = 120
	}

	if len(cfg.CORS.AllowedOrigins) == 0 {
		cfg.CORS.AllowedOrigins = []string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
		}
	}

	cfg.Static.UploadRoot = strings.TrimSpace(cfg.Static.UploadRoot)
	cfg.Static.PublicRoot = strings.TrimSpace(cfg.Static.PublicRoot)

	return &cfg, nil
}

func applyLogDefaults(cfg *Config, v *viper.Viper) {
	if !v.IsSet("log.console_enabled") {
		cfg.Log.ConsoleEnabled = true
	}
	if strings.TrimSpace(cfg.Log.ConsoleFormat) == "" {
		cfg.Log.ConsoleFormat = "console"
	}
	if !v.IsSet("log.file_enabled") {
		cfg.Log.FileEnabled = strings.TrimSpace(cfg.Log.FilePath) != "" || strings.TrimSpace(cfg.Log.FileErrorPath) != ""
	}
	if !v.IsSet("log.access_log_file_enabled") {
		cfg.Log.AccessLogFileEnabled = true
	}
	if strings.TrimSpace(cfg.Log.FileFormat) == "" {
		cfg.Log.FileFormat = "json"
	}
	if !v.IsSet("log.caller_enabled") {
		cfg.Log.CallerEnabled = true
	}
	if strings.TrimSpace(cfg.Log.StacktraceLevel) == "" {
		cfg.Log.StacktraceLevel = "error"
	}
	if cfg.Log.FileMaxAgeDays < 0 {
		cfg.Log.FileMaxAgeDays = 0
	}
	if cfg.Log.FileMaxMegabytes > 0 {
		if !v.IsSet("log.file_max_backups") {
			cfg.Log.FileMaxBackups = 7
		}
		if cfg.Log.FileMaxBackups < 0 {
			cfg.Log.FileMaxBackups = 0
		}
	}

	cf := strings.ToLower(strings.TrimSpace(cfg.Log.ConsoleFormat))
	if cf != "console" && cf != "json" {
		cfg.Log.ConsoleFormat = "console"
	} else {
		cfg.Log.ConsoleFormat = cf
	}
	ff := strings.ToLower(strings.TrimSpace(cfg.Log.FileFormat))
	if ff != "console" && ff != "json" {
		cfg.Log.FileFormat = "json"
	} else {
		cfg.Log.FileFormat = ff
	}
}
