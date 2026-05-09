package main

import (
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

// rootCmd 为 Cobra 根命令：无子命令时执行 RunE，即启动 HTTP（runServer）；其余逻辑挂载为子命令（如 migrate）。
var rootCmd = &cobra.Command{
	Use:   filepath.Base(os.Args[0]),
	Short: "new-admin 后台 API",
	Long:  `默认启动 HTTP 服务；子命令 migrate 用于 golang-migrate 数据库迁移。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		runServer()
		return nil
	},
}

func init() {
	registerMigrateCommands(rootCmd)
}

// execute 解析 os.Args 并调度对应命令；返回错误时由 main 决定退出码（通常为 1）。
func execute() error {
	return rootCmd.Execute()
}
