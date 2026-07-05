/**
 * SpeechToTextService — cross-browser voice search transcription.
 *
 * The browser records audio (MediaRecorder, which every modern browser
 * supports — unlike the Web Speech API) and POSTs the clip here; we forward it
 * to an OpenAI-compatible /audio/transcriptions endpoint running open-source
 * Whisper. Default target is Groq's free Whisper hosting, reusing the existing
 * GROQ_API_KEY pool with rate-limit key rotation.
 *
 * To drop the external dependency entirely, run your own Whisper server
 * (whisper.cpp `--convert`/server or faster-whisper's server both expose the
 * same /audio/transcriptions contract) and set STT_BASE_URL (+ STT_API_KEY if
 * it requires one). No code change — same request shape, self-hosted.
 */
const axios = require('axios');
const FormData = require('form-data');
const config = require('../config/env');
const logger = require('../utils/logger');

class SpeechToTextService {
  constructor() {
    this.baseUrl = (config.stt?.baseUrl || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
    this.model = config.stt?.model || 'whisper-large-v3-turbo';
    this.explicitKey = config.stt?.apiKey || null;
    this.groqKeys = config.stt?.groqKeys || [];
    // Only the Groq host rotates through the GROQ_API_KEY pool; a self-hosted
    // endpoint uses STT_API_KEY (or no auth at all).
    this.usesGroqKeys = /(^|\.)groq\.com$/i.test(new URL(this.baseUrl).hostname) && !this.explicitKey;
  }

  isConfigured() {
    return this.usesGroqKeys ? this.groqKeys.length > 0 : !!this.baseUrl;
  }

  /**
   * Transcribe an audio buffer. Returns the plain transcript string.
   * Rotates Groq keys on 429 so a rate-limited key falls through to the next.
   */
  async transcribe(buffer, filename = 'audio.webm', mimetype = 'audio/webm') {
    const keys = this.usesGroqKeys ? this.groqKeys : [this.explicitKey];
    let lastError;

    for (let i = 0; i < Math.max(keys.length, 1); i++) {
      const key = keys[i] || null;
      const form = new FormData();
      form.append('file', buffer, { filename, contentType: mimetype });
      form.append('model', this.model);
      form.append('response_format', 'json');
      form.append('temperature', '0');

      try {
        const response = await axios.post(`${this.baseUrl}/audio/transcriptions`, form, {
          headers: {
            ...form.getHeaders(),
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 30000,
        });
        return (response.data?.text || '').trim();
      } catch (error) {
        lastError = error;
        const status = error.response?.status;
        if (status === 429 && this.usesGroqKeys && i < keys.length - 1) {
          logger.warn('STT key rate-limited, rotating to next key');
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('Speech-to-text failed');
  }
}

module.exports = new SpeechToTextService();
