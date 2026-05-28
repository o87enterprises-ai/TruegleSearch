-- Migration: Remove user tracking tables
-- Truegle policy: No bias, No tracking, No censorship

DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS api_usage CASCADE;
DROP TABLE IF EXISTS ad_analytics CASCADE;
