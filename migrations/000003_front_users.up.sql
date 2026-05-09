CREATE TABLE IF NOT EXISTS front_users (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(64) NOT NULL,
  nickname    VARCHAR(128) NOT NULL DEFAULT '',
  mobile      VARCHAR(32) NULL,
  email       VARCHAR(128) NULL,
  status      TINYINT NOT NULL DEFAULT 1 COMMENT '1=active 0=disabled',
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_front_users_username (username),
  KEY idx_front_users_mobile (mobile),
  KEY idx_front_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO permissions (code, name) VALUES
  ('front:user:read', '前台用户查看'),
  ('front:user:write', '前台用户新增、编辑、状态')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('front:user:read', 'front:user:write')
WHERE r.code = 'super_admin';
