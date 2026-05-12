-- WebAuthn / 通行密钥凭据（与 users 一对多）

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNSIGNED NOT NULL,
  credential_id    VARBINARY(1023) NOT NULL,
  credential_json  JSON            NOT NULL,
  sign_count       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_webauthn_credential_id (credential_id),
  KEY idx_webauthn_cred_user (user_id),
  CONSTRAINT fk_webauthn_cred_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
