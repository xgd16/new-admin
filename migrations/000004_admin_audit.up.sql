-- 后台用户最后登录时间 + 操作日志

ALTER TABLE users
  ADD COLUMN last_login_at DATETIME(3) NULL COMMENT '最近成功登录时间' AFTER status;

CREATE TABLE IF NOT EXISTS admin_operation_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL COMMENT '后台用户 ID',
  username    VARCHAR(64) NOT NULL DEFAULT '' COMMENT '冗余，便于列表展示',
  method      VARCHAR(16) NOT NULL,
  path        VARCHAR(512) NOT NULL,
  query       VARCHAR(2048) NULL,
  ip          VARCHAR(64) NOT NULL DEFAULT '',
  user_agent  VARCHAR(512) NOT NULL DEFAULT '',
  status_code SMALLINT UNSIGNED NOT NULL,
  duration_ms INT UNSIGNED NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_admin_op_logs_created (created_at),
  KEY idx_admin_op_logs_user (user_id, created_at),
  CONSTRAINT fk_admin_op_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='后台写操作与登录审计';

INSERT INTO permissions (code, name) VALUES ('system:audit:read', '操作日志查看');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'super_admin' AND p.code = 'system:audit:read';
