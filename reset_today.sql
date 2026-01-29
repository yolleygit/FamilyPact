-- 清除今日 (2026-01-29) 的所有打卡数据
DELETE FROM daily_logs 
WHERE date = '2026-01-29';

-- 清除今日的所有登录会话历史 (北京时间 00:00 - 24:00)
DELETE FROM user_sessions 
WHERE created_at >= '2026-01-28 16:00:00' 
  AND created_at <  '2026-01-29 16:00:00';
