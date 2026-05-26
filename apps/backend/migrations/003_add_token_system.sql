-- Migration: Add Token System for Freemium Features
-- Created: 2025-01-03

-- Add token-related columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS token_balance INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS feature_usage JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_ad_watched TIMESTAMP,
ADD COLUMN IF NOT EXISTS game_tokens_earned INTEGER DEFAULT 0;

-- Create index for token balance queries
CREATE INDEX IF NOT EXISTS idx_users_token_balance ON users(token_balance);

-- Ad watch history for audit/fraud prevention
CREATE TABLE IF NOT EXISTS ad_watches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  ad_id VARCHAR(255),
  duration_seconds INTEGER,
  completed BOOLEAN DEFAULT false,
  tokens_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_watches_user ON ad_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_watches_created ON ad_watches(created_at);

-- Game token rewards tracking
CREATE TABLE IF NOT EXISTS game_rewards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  level_completed INTEGER NOT NULL,
  tokens_awarded INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, level_completed)
);

CREATE INDEX IF NOT EXISTS idx_game_rewards_user ON game_rewards(user_id);

-- Token transactions for audit trail
CREATE TABLE IF NOT EXISTS token_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount INTEGER NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'earn_ad', 'earn_game', 'spend', 'bonus'
  feature_name VARCHAR(100),
  description TEXT,
  balance_after INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_transactions_user ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created ON token_transactions(created_at);
