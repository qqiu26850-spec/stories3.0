
-- 请将此 SQL 复制到 Supabase 的 SQL Editor 中运行
-- 为 projects 表添加 JSONB 类型的 script_data 列，用于存储剧本设置和策划案
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS script_data JSONB DEFAULT '{}'::jsonb;
