DELETE rp FROM role_permissions rp
INNER JOIN permissions p ON p.id = rp.permission_id
WHERE p.code = 'system:audit:read';

DELETE FROM permissions WHERE code = 'system:audit:read';

DROP TABLE IF EXISTS admin_operation_logs;

ALTER TABLE users DROP COLUMN last_login_at;
