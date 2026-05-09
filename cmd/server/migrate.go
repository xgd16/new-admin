package main

import (
	"errors"
	"fmt"
	"path/filepath"
	"strconv"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/mysql"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/spf13/cobra"

	"new-admin/internal/config"
	"new-admin/internal/store"
)

// migrate 子命令用到的全局 flag / 预加载配置（由 PersistentPreRunE 填充）。
var (
	migrateAppCfg *config.Config
	migrateDir    string
	migrateSteps  int
)

// registerMigrateCommands 注册 migrate 及其 up/down/version/force，数据源来自配置文件中的 mysql。
func registerMigrateCommands(root *cobra.Command) {
	migrateCmd := &cobra.Command{
		Use:          "migrate",
		Short:        "数据库迁移（golang-migrate）",
		SilenceUsage: true,
		// 任意 migrate * 执行前先加载配置，避免每个子命令重复读文件。
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(configPath())
			if err != nil {
				return err
			}
			migrateAppCfg = cfg
			return nil
		},
	}
	migrateCmd.PersistentFlags().StringVar(&migrateDir, "path", "migrations", "迁移 SQL 所在目录（相对当前工作目录）")

	upCmd := &cobra.Command{
		Use:          "up",
		Short:        "执行全部待执行的迁移",
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			m, err := openMigrator(migrateAppCfg, migrateDir)
			if err != nil {
				return err
			}
			defer func() { _, _ = m.Close() }()

			err = m.Up()
			if errors.Is(err, migrate.ErrNoChange) {
				fmt.Fprintln(cmd.OutOrStdout(), "migrate: 无待执行变更")
				return nil
			}
			if err != nil {
				return fmt.Errorf("migrate up: %w", err)
			}
			fmt.Fprintln(cmd.OutOrStdout(), "migrate up: 完成")
			return nil
		},
	}

	downCmd := &cobra.Command{
		Use:          "down",
		Short:        "按 --steps 回滚迁移",
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			if migrateSteps < 1 {
				return fmt.Errorf("--steps 必须 >= 1")
			}
			m, err := openMigrator(migrateAppCfg, migrateDir)
			if err != nil {
				return err
			}
			defer func() { _, _ = m.Close() }()

			err = m.Steps(-migrateSteps)
			if err != nil {
				return fmt.Errorf("migrate down: %w", err)
			}
			fmt.Fprintln(cmd.OutOrStdout(), "migrate down: 完成")
			return nil
		},
	}
	downCmd.Flags().IntVar(&migrateSteps, "steps", 1, "回滚的迁移个数（>=1）")

	versionCmd := &cobra.Command{
		Use:          "version",
		Short:        "查看当前迁移版本与 dirty 标记",
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			m, err := openMigrator(migrateAppCfg, migrateDir)
			if err != nil {
				return err
			}
			defer func() { _, _ = m.Close() }()

			v, dirty, verr := m.Version()
			if verr != nil {
				if errors.Is(verr, migrate.ErrNilVersion) {
					fmt.Fprintln(cmd.OutOrStdout(), "version: <nil> (尚无迁移记录)")
					return nil
				}
				return fmt.Errorf("version: %w", verr)
			}
			fmt.Fprintf(cmd.OutOrStdout(), "version=%d dirty=%v\n", v, dirty)
			return nil
		},
	}

	forceCmd := &cobra.Command{
		Use:          "force VERSION",
		Short:        "强制设置迁移版本（修复 dirty，慎用）",
		Args:         cobra.ExactArgs(1),
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			n, convErr := strconv.Atoi(args[0])
			if convErr != nil || n < 0 {
				return fmt.Errorf("非法版本号: %s", args[0])
			}
			m, err := openMigrator(migrateAppCfg, migrateDir)
			if err != nil {
				return err
			}
			defer func() { _, _ = m.Close() }()

			if err := m.Force(n); err != nil {
				return fmt.Errorf("migrate force: %w", err)
			}
			fmt.Fprintln(cmd.OutOrStdout(), "migrate force: 完成")
			return nil
		},
	}

	migrateCmd.AddCommand(upCmd, downCmd, versionCmd, forceCmd)
	root.AddCommand(migrateCmd)
}

// openMigrator 基于本地 migrations 目录与配置中的 MySQL 构造 golang-migrate 实例。
func openMigrator(cfg *config.Config, migrationsDir string) (*migrate.Migrate, error) {
	if cfg == nil {
		return nil, fmt.Errorf("internal: 迁移配置未初始化")
	}
	absMigrations, err := absMigrationsDir(migrationsDir)
	if err != nil {
		return nil, err
	}
	sourceURL := "file://" + absMigrations
	dbURL := store.MySQLMigrateURL(cfg.MySQL)
	return migrate.New(sourceURL, dbURL)
}

// absMigrationsDir 将相对路径转为绝对路径，并统一为正斜杠以便 file:// URL。
func absMigrationsDir(dir string) (string, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return "", fmt.Errorf("migrations path: %w", err)
	}
	return filepath.ToSlash(abs), nil
}
