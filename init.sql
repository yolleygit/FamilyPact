-- FamilyPact Database Initialization Script

-- 1. Families Table
CREATE TABLE IF NOT EXISTS families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_code VARCHAR(10) UNIQUE NOT NULL, -- The 6-digit code for login
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table (Parents and Children)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('parent', 'child')) NOT NULL,
    avatar TEXT, -- Emoji or URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Daily Logs Table (Point tracking per child per day)
CREATE TABLE IF NOT EXISTS daily_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    answers JSONB DEFAULT '{}'::jsonb, -- Detail state
    total_score INTEGER DEFAULT 0,
    has_class BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- 4. Initial Seed Data (Optional - You can change '123456' to your real code)
-- INSERT INTO families (family_code) VALUES ('123456') RETURNING id;
-- (Use the returned id to insert users below)
-- INSERT INTO users (family_id, name, role, avatar) VALUES ('FAMILY_ID', '爸爸', 'parent', '👨‍💻');
-- INSERT INTO users (family_id, name, role, avatar) VALUES ('FAMILY_ID', '小宝', 'child', '👦');
