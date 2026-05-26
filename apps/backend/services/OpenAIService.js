/**
 * OpenAI Service - Direct OpenAI API Integration (BACKUP AI PROVIDER)
 *
 * Use this as a backup/alternative to OpenRouter for GPT models
 * Supports GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
 */
const axios = require('axios');
const config = require('../config/env');

// Truegle AI System Prompt (same as OpenRouter)
const TRUEGLE_AI_SYSTEM_PROMPT = `
You are the AI engine for Truegle AI, a search platform built on the principles of Radical Transparency, User-Defined Impartiality, and Uncompromising Security.

CORE IDENTITY & PRIME DIRECTIVE:
- You are strictly prohibited from favoring, disfavoring, or injecting any personal bias, political leaning, theological view, or institutional affiliation into your analysis.
- Your operational goal is to represent all perspectives with factual accuracy and neutrality.
- Maintain a professional, informative, and neutral tone at all times.
- When presenting information, always acknowledge the existence of multiple viewpoints and avoid making absolute claims.

PERSPECTIVE CATEGORIZATION FRAMEWORK:
You MUST assign one or more Perspective Labels to content:
- Political: Conservative, Liberal, Bipartisan, Libertarian, Progressive, Centrist
- Faith: Religious, Atheist, New World / Illumination, Old World / Pagan, Spiritual, Secular, Universal
- Societal: Mainstream, Alternative, Conspiracy, Skeptical, Traditional, Scientific / Academic, Government, Community
- Economic: Local Economy, Global Economics, Investors, Consumers, Small Business, Corporate
- Other: Entertainment, Sports, Technology, Health, Environment

RESPONSE REQUIREMENTS:
1. Provide a concise, bullet-pointed summary of primary perspectives found
2. Present each perspective's core argument factually, without endorsement
3. Tag all content with relevant Perspective Labels
4. If information is unavailable, clearly state this limitation
5. When possible, cite sources or indicate the origin of information
6. Acknowledge uncertainty or conflicting information when it exists
7. Present balanced viewpoints even when data may seem one-sided
8. Avoid making predictions unless specifically asked, and if so, present multiple possible outcomes

Truegle AI is committed to delivering unbiased, multi-perspective understanding.
`;

class OpenAIService {
  constructor() {
    this.apiKey = config.ai.openai?.apiKey;
    this.baseUrl = 'https://api.openai.com/v1';

    // Model configurations
    this.models = {
      gpt4: 'gpt-4-turbo-preview',
      gpt35: 'gpt-3.5-turbo',
      gpt4o: 'gpt-4o',
    };
  }

  /**
   * Chat completion with OpenAI
   */
  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const {
      model = this.models.gpt35,
      temperature = 0.7,
      maxTokens = 1000,
      systemPrompt = null,
    } = options;

    try {
      const formattedMessages = [];

      if (systemPrompt) {
        formattedMessages.push({ role: 'system', content: systemPrompt });
      }

      if (typeof messages === 'string') {
        formattedMessages.push({ role: 'user', content: messages });
      } else {
        formattedMessages.push(...messages);
      }

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages: formattedMessages,
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return {
        content: response.data.choices[0].message.content,
        model: response.data.model,
        usage: response.data.usage,
        finishReason: response.data.choices[0].finish_reason,
      };
    } catch (error) {
      console.error('OpenAI API error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('Invalid OpenAI API key');
      }
      if (error.response?.status === 429) {
        throw new Error('OpenAI rate limit exceeded');
      }
      if (error.response?.status === 400) {
        throw new Error(`OpenAI bad request: ${error.response.data?.error?.message}`);
      }

      throw new Error(`OpenAI service unavailable: ${error.message}`);
    }
  }

  /**
   * Generate text embeddings
   */
  async createEmbeddings(text) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/embeddings`,
        {
          model: 'text-embedding-ada-002',
          input: text,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return {
        embedding: response.data.data[0].embedding,
        usage: response.data.usage,
      };
    } catch (error) {
      console.error('OpenAI embeddings error:', error.response?.data || error.message);
      throw new Error('Failed to create embeddings');
    }
  }

  /**
   * Analyze content for bias/perspectives (Truegle-specific)
   */
  async analyzeContentBias(content, queryContext = null) {
    let prompt = `Analyze the following content and provide:

1. Primary perspectives found
2. Core arguments from each perspective
3. Relevant Perspective Labels

Content to analyze:

${content}
`;

    if (queryContext) {
      prompt = `User Query Context: ${queryContext}\n\n${prompt}`;
    }

    return this.chat(prompt, {
      systemPrompt: TRUEGLE_AI_SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 2000,
    });
  }

  /**
   * Alias for compatibility with OpenRouter service
   */
  async analyzeContent(content, queryContext = null, options = {}) {
    return this.analyzeContentBias(content, queryContext);
  }

  /**
   * Check service health
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 5000,
      });
      return { healthy: true, models: response.data.data.length };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Check if service is available (has API key)
   */
  isAvailable() {
    return !!this.apiKey;
  }
}

module.exports = OpenAIService;
