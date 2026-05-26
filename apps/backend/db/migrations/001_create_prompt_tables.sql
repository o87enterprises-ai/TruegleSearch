-- Migration: Create AI Prompt Management Tables
-- Version: 001
-- Description: Create tables for managing AI prompts, providers, variables, and version history

-- ============================================================================
-- Table: ai_providers
-- Description: Stores AI provider configurations (OpenRouter, OpenAI, Anthropic, Gemini)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_providers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  config JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_providers_active ON ai_providers(is_active, priority DESC);

COMMENT ON TABLE ai_providers IS 'AI provider configurations and priorities';
COMMENT ON COLUMN ai_providers.name IS 'Unique identifier: openrouter, openai, anthropic, gemini';
COMMENT ON COLUMN ai_providers.priority IS 'Higher priority = preferred provider (100 = highest)';
COMMENT ON COLUMN ai_providers.config IS 'Provider-specific config (models, endpoints, etc.)';

-- ============================================================================
-- Table: ai_prompts
-- Description: Core prompt storage with versioning and context-based selection
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_prompts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  context VARCHAR(100) NOT NULL,
  prompt_text TEXT NOT NULL,
  system_role VARCHAR(50) DEFAULT 'assistant',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2000,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT temperature_range CHECK (temperature >= 0 AND temperature <= 2),
  CONSTRAINT max_tokens_positive CHECK (max_tokens > 0)
);

CREATE INDEX idx_ai_prompts_context ON ai_prompts(context);
CREATE INDEX idx_ai_prompts_active ON ai_prompts(is_active);
CREATE INDEX idx_ai_prompts_context_active ON ai_prompts(context, is_active);
CREATE INDEX idx_ai_prompts_version ON ai_prompts(version);

COMMENT ON TABLE ai_prompts IS 'System prompts for different page contexts';
COMMENT ON COLUMN ai_prompts.context IS 'Page context: general, search_results, biased_results, osint, shopping';
COMMENT ON COLUMN ai_prompts.prompt_text IS 'System prompt text with optional {{variables}}';
COMMENT ON COLUMN ai_prompts.temperature IS 'AI temperature (0-2, default 0.7)';

-- ============================================================================
-- Table: ai_prompt_variables
-- Description: Template variable definitions for prompts
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_prompt_variables (
  id SERIAL PRIMARY KEY,
  prompt_id INTEGER NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
  variable_name VARCHAR(100) NOT NULL,
  description TEXT,
  default_value TEXT,
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_prompt_variable UNIQUE(prompt_id, variable_name)
);

CREATE INDEX idx_prompt_variables_prompt ON ai_prompt_variables(prompt_id);

COMMENT ON TABLE ai_prompt_variables IS 'Variables used in prompt templates ({{userName}}, {{query}}, etc.)';
COMMENT ON COLUMN ai_prompt_variables.variable_name IS 'Variable name including braces: {{userName}}';

-- ============================================================================
-- Table: ai_prompt_history
-- Description: Version control for prompt changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_prompt_history (
  id SERIAL PRIMARY KEY,
  prompt_id INTEGER NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
  previous_text TEXT NOT NULL,
  previous_version INTEGER,
  changed_by INTEGER,
  change_reason VARCHAR(500),
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_prompt_history_prompt ON ai_prompt_history(prompt_id);
CREATE INDEX idx_prompt_history_changed_at ON ai_prompt_history(changed_at DESC);

COMMENT ON TABLE ai_prompt_history IS 'Audit trail of prompt changes for rollback capability';

-- ============================================================================
-- Table: ai_prompt_provider_mapping
-- Description: Associates prompts with preferred AI providers
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_prompt_provider_mapping (
  id SERIAL PRIMARY KEY,
  prompt_id INTEGER NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  model_override VARCHAR(100),
  temperature_override DECIMAL(3,2),
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_prompt_provider UNIQUE(prompt_id, provider_id),
  CONSTRAINT temperature_override_range CHECK (temperature_override IS NULL OR (temperature_override >= 0 AND temperature_override <= 2))
);

CREATE INDEX idx_mapping_prompt ON ai_prompt_provider_mapping(prompt_id);
CREATE INDEX idx_mapping_provider ON ai_prompt_provider_mapping(provider_id);
CREATE INDEX idx_mapping_preferred ON ai_prompt_provider_mapping(is_preferred);

COMMENT ON TABLE ai_prompt_provider_mapping IS 'Maps prompts to preferred AI providers with optional overrides';
COMMENT ON COLUMN ai_prompt_provider_mapping.model_override IS 'Optional model override for this prompt-provider pair';
COMMENT ON COLUMN ai_prompt_provider_mapping.is_preferred IS 'Mark as preferred provider for this prompt';

-- ============================================================================
-- Create updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at column
CREATE TRIGGER update_ai_providers_updated_at
  BEFORE UPDATE ON ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 001 completed successfully: AI Prompt Management tables created';
END $$;
