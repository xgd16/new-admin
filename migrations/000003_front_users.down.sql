DELETE rp
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
WHERE p.code IN ('front:user:read', 'front:user:write');

DELETE FROM permissions WHERE code IN ('front:user:read', 'front:user:write');

DROP TABLE IF EXISTS front_users;
