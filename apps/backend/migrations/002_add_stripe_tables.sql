-- Migration: Add Stripe integration and ad analytics
-- Created: 2024-11-06

-- Add search_type and perspective to search_history
ALTER TABLE search_history 
ADD COLUMN IF NOT EXISTS search_type VARCHAR(50) DEFAULT 'web',
ADD COLUMN IF NOT EXISTS perspective VARCHAR(50);

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

-- Update users table for Stripe integration
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive';

CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);
