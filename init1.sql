-- 1. 创建/确保家庭存在（邀请码设为 123456）
INSERT INTO families (family_code) 
VALUES ('123123') 
ON CONFLICT (family_code) DO NOTHING;

-- 2. 清理并重新插入所有成员（确保不重复）
WITH target_family AS (
    SELECT id FROM families WHERE family_code = '123123'
)
INSERT INTO users (family_id, name, role, avatar)
SELECT id, '爸爸', 'parent', '👨‍💻' FROM target_family WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='爸爸' AND family_id=(SELECT id FROM target_family))
UNION ALL
SELECT id, '妈妈', 'parent', '👩‍🏫' FROM target_family WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='妈妈' AND family_id=(SELECT id FROM target_family))
UNION ALL
SELECT id, '笑笑', 'child', '👧' FROM target_family WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='笑笑' AND family_id=(SELECT id FROM target_family))
UNION ALL
SELECT id, '乐乐', 'child', '👶' FROM target_family WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='乐乐' AND family_id=(SELECT id FROM target_family));

-- 3. 查看最终家庭名单
SELECT name, role, avatar FROM users 
WHERE family_id = (SELECT id FROM families WHERE family_code = '123123')
ORDER BY role DESC;