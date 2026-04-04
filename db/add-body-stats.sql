-- Migration: Add body stats columns to users table
-- Run once against any existing database that was set up before these columns existed.

ALTER TABLE users ADD COLUMN IF NOT EXISTS body_age INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS body_weight NUMERIC(5,1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS body_height INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS body_sex VARCHAR(10) DEFAULT 'male';
