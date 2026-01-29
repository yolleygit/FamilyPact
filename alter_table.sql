-- 1. 彻底删除重建表 (最快的方法，因为现在还没数据)
DROP TABLE IF EXISTS user_sessions;

-- 2. 重建表，将 user_id 改为 TEXT 以支持 UUID
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,  -- 修改为 TEXT
    score_at_login INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 重新建立索引
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
