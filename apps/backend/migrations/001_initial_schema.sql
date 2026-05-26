-- TRUEGLE Database Schema
-- Initial migration

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  subscription_status VARCHAR(50) DEFAULT 'inactive',
  stripe_customer_id VARCHAR(255),
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

-- Search history table
CREATE TABLE IF NOT EXISTS search_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  query TEXT NOT NULL,
  filters JSONB,
  search_type VARCHAR(50) DEFAULT 'web',
  perspective VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at);

-- Bias sources table
CREATE TABLE IF NOT EXISTS bias_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  bias_rating VARCHAR(50),
  bias_score DECIMAL(3,2),
  credibility_score DECIMAL(3,2),
  fact_check_rating VARCHAR(50),
  categories JSONB,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bias_sources_domain ON bias_sources(domain);
CREATE INDEX IF NOT EXISTS idx_bias_sources_rating ON bias_sources(bias_rating);

-- AI summary cache table
CREATE TABLE IF NOT EXISTS ai_summary_cache (
  id SERIAL PRIMARY KEY,
  query_hash VARCHAR(64) UNIQUE NOT NULL,
  summary TEXT,
  model_used VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_query ON ai_summary_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_summary_cache(expires_at);

-- API usage tracking table
CREATE TABLE IF NOT EXISTS api_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  endpoint VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(50),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50),
  stripe_payment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe ON payments(stripe_payment_id);

-- Preferences table
CREATE TABLE IF NOT EXISTS preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id),
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preferences_user ON preferences(user_id);

-- Ad analytics table
CREATE TABLE IF NOT EXISTS ad_analytics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  search_query TEXT,
  perspective VARCHAR(50),
  ad_id VARCHAR(255),
  impression_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_analytics_user ON ad_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_analytics_perspective ON ad_analytics(perspective);
CREATE INDEX IF NOT EXISTS idx_ad_analytics_created ON ad_analytics(created_at);
