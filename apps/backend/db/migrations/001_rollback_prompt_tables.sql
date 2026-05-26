-- Rollback Migration: Drop AI Prompt Management Tables
-- Version: 001
-- Description: Rollback script to remove all AI prompt management tables

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS ai_prompt_provider_mapping CASCADE;
DROP TABLE IF EXISTS ai_prompt_history CASCADE;
DROP TABLE IF EXISTS ai_prompt_variables CASCADE;
DROP TABLE IF EXISTS ai_prompts CASCADE;
DROP TABLE IF EXISTS ai_providers CASCADE;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Rollback 001 completed successfully: AI Prompt Management tables dropped';
END $$;
