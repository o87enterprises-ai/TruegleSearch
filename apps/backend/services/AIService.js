/**
 * AI Service - Generates summaries and analyzes perspectives using OpenRouter (Primary)
 * HuggingFace and DeepSeek are deprecated - using OpenRouter only
 */
const config = require('../config/env');

class AIService {
  constructor() {
    this.openRouterApiKey = config.ai.openRouter.apiKey;
    this.openRouterApiKeyUnlimited = config.ai.openRouter.apiKeyUnlimited;
    this.openRouterKeys = config.ai.openRouter.keys;

    // Deprecated - using OpenRouter instead
    this.huggingFaceApiKey = config.ai.huggingface.apiKey;
    this.deepseekApiKey = config.ai.deepseek.apiKey;

    // OpenRouter model selection (use free models)
    this.models = {
      summary: 'google/gemma-2-9b-it:free',
      chat: 'google/gemma-2-9b-it:free',
      gemini: 'google/gemini-flash-1.5:free',
    };

    // Key rotation index
    this.keyIndex = 0;
  }

  /**
   * Get next available OpenRouter API key (load balancing)
   */
  getNextOpenRouterKey() {
    const allKeys = [this.openRouterApiKeyUnlimited, this.openRouterApiKey, ...this.openRouterKeys].filter(k => k);

    this.keyIndex = (this.keyIndex + 1) % allKeys.length;
    return allKeys[this.keyIndex];
  }

  /**
   * Generate a summary of search results using OpenRouter
   */
  async generateSummary(query, searchResults) {
    try {
      const summary = await this.generateWithOpenRouter(query, searchResults, 'summary');
      return summary;
    } catch (error) {
      console.error('OpenRouter summary error:', error.message);

      // Final fallback - generate local summary
      return this.generateLocalSummary(query, searchResults);
    }
  }

  /**
   * Generate chat response using OpenRouter
   */
  async generateChatResponse(message, conversationHistory = []) {
    try {
      const response = await this.generateWithOpenRouter(
        message,
        conversationHistory,
        'chat'
      );
      return response;
    } catch (error) {
      console.error('OpenRouter chat error:', error.message);
      throw new Error('AI chat service unavailable');
    }
  }

  /**
   * Generate summary using OpenRouter (Primary Method)
   */
  async generateWithOpenRouter(query, searchResults, mode = 'summary') {
    const apiKey = this.getNextOpenRouterKey();

    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    // Prepare context from search results
    const context = searchResults.slice(0, 5).map(r =>
      `${r.title}: ${r.snippet || ''}`
    ).join('\n');

    const model = this.models[mode] || this.models.chat;

    const prompt = mode === 'summary'
      ? `Based on the following search results for "${query}", provide a concise, unbiased summary that covers multiple perspectives:\n\n${context}\n\nProvide a balanced 2-3 sentence summary.`
      : query;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://truegle.ai',
        'X-Title': 'Truegle',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an unbiased AI assistant that provides balanced, factual information from multiple perspectives. Avoid taking sides and present different viewpoints fairly.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenRouter');
    }

    return {
      summary: data.choices[0].message.content,
      model: 'openrouter',
      sourcesAnalyzed: Math.min(searchResults.length, 5),
    };
  }

  /**
   * Generate summary using HuggingFace Inference API
   */
  async generateWithHuggingFace(query, searchResults) {
    if (!this.huggingFaceApiKey) {
      throw new Error('HuggingFace API key not configured');
    }

    // Prepare context from search results
    const context = searchResults.slice(0, 5).map(r =>
      `${r.title}: ${r.snippet || ''}`
    ).join('\n');

    const prompt = `<s>[INST] Based on the following search results for "${query}", provide a concise, unbiased summary that covers multiple perspectives:

${context}

Provide a balanced 2-3 sentence summary. [/INST]`;

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${this.hfModel}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.huggingFaceApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 200,
            temperature: 0.7,
            top_p: 0.9,
            do_sample: true,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract generated text
    let generatedText = '';
    if (Array.isArray(data) && data[0]?.generated_text) {
      generatedText = data[0].generated_text;
    } else if (data.generated_text) {
      generatedText = data.generated_text;
    } else {
      throw new Error('Unexpected response format from HuggingFace');
    }

    // Extract the summary part (after [/INST])
    const summaryMatch = generatedText.split('[/INST]');
    const summary = summaryMatch.length > 1
      ? summaryMatch[1].trim()
      : generatedText.trim();

    return {
      summary: summary,
      model: 'huggingface',
      sourcesAnalyzed: Math.min(searchResults.length, 5),
    };
  }


  /**
   * Generate a local summary when AI APIs fail
   */
  generateLocalSummary(query, searchResults) {
    if (!searchResults || searchResults.length === 0) {
      return {
        summary: `Search results for "${query}" are being gathered. Check back for comprehensive analysis.`,
        model: 'local',
        sourcesAnalyzed: 0,
      };
    }

    // Generate a simple, clean summary without meta-commentary
    const snippets = searchResults.slice(0, 3).map(r => r.snippet || r.title).filter(s => s);

    // Create a concise summary from the first few snippets
    const summary = snippets.length > 0
      ? snippets[0].substring(0, 200) + (snippets[0].length > 200 ? '...' : '')
      : `Search results for "${query}" have been retrieved.`;

    return {
      summary,
      model: 'local',
      sourcesAnalyzed: Math.min(searchResults.length, 5),
    };
  }

  /**
   * Analyze perspectives in search results
   */
  async analyzePerspectives(query, searchResults) {
    // Define perspective categories
    const perspectives = {
      left: { count: 0, sources: [] },
      center: { count: 0, sources: [] },
      right: { count: 0, sources: [] },
      neutral: { count: 0, sources: [] },
    };

    // Known source biases (simplified)
    const sourceBiases = {
      'cnn.com': 'left',
      'msnbc.com': 'left',
      'huffpost.com': 'left',
      'theguardian.com': 'left',
      'foxnews.com': 'right',
      'breitbart.com': 'right',
      'dailywire.com': 'right',
      'newsmax.com': 'right',
      'reuters.com': 'center',
      'apnews.com': 'center',
      'bbc.com': 'center',
      'npr.org': 'center',
      'wikipedia.org': 'neutral',
      'britannica.com': 'neutral',
    };

    // Categorize results
    for (const result of searchResults) {
      const domain = result.domain || this.extractDomain(result.url);
      const bias = sourceBiases[domain] || 'neutral';

      perspectives[bias].count++;
      perspectives[bias].sources.push({
        title: result.title,
        source: domain,
      });
    }

    // Generate perspective summary
    const perspectiveSummary = [];

    if (perspectives.left.count > 0) {
      perspectiveSummary.push({
        type: 'left',
        title: 'Progressive View',
        count: perspectives.left.count,
        summary: `${perspectives.left.count} source(s) from progressive outlets discussing "${query}"`,
      });
    }

    if (perspectives.center.count > 0) {
      perspectiveSummary.push({
        type: 'center',
        title: 'Balanced View',
        count: perspectives.center.count,
        summary: `${perspectives.center.count} source(s) from centrist/mainstream outlets covering "${query}"`,
      });
    }

    if (perspectives.right.count > 0) {
      perspectiveSummary.push({
        type: 'right',
        title: 'Conservative View',
        count: perspectives.right.count,
        summary: `${perspectives.right.count} source(s) from conservative outlets on "${query}"`,
      });
    }

    if (perspectives.neutral.count > 0) {
      perspectiveSummary.push({
        type: 'neutral',
        title: 'Neutral/Reference',
        count: perspectives.neutral.count,
        summary: `${perspectives.neutral.count} source(s) providing neutral/reference information`,
      });
    }

    return perspectiveSummary;
  }

  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get AI-powered analysis for a query
   */
  async getAnalysis(query, searchResults) {
    const [summaryResult, perspectives] = await Promise.all([
      this.generateSummary(query, searchResults),
      this.analyzePerspectives(query, searchResults),
    ]);

    return {
      summary: summaryResult.summary,
      model: summaryResult.model,
      sourcesAnalyzed: summaryResult.sourcesAnalyzed,
      perspectives,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = AIService;
