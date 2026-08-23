/**
 * SpeechToTextService — cross-browser voice search transcription.
 *
 * The browser records audio (MediaRecorder, which every modern browser
 * supports — unlike the Web Speech API) and POSTs the clip here; we forward it
 * to an OpenAI-compatible /audio/transcriptions endpoint running open-source
 * Whisper. Default target is Groq's free Whisper hosting, sharing the tapered
 * GroqKeyPool with the text/vision surfaces so voice search doesn't drain the
 * same key they're using.
 *
 * To drop the external dependency entirely, run your own Whisper server
 * (whisper.cpp `--convert`/server or faster-whisper's server both expose the
 * same /audio/transcriptions contract) and set STT_BASE_URL (+ STT_API_KEY if
 * it requires one). No code change — same request shape, self-hosted.
 */
const axios = require('axios');
const FormData = require('form-data');
const config = require('../config/env');
const keyPool = require('./GroqKeyPool');

class SpeechToTextService {
  constructor() {
    this.baseUrl = (config.stt?.baseUrl || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
    this.model = config.stt?.model || 'whisper-large-v3-turbo';
    this.explicitKey = config.stt?.apiKey || null;
    // Only the Groq host rotates through the GROQ_API_KEY pool; a self-hosted
    // endpoint uses STT_API_KEY (or no auth at all).
    this.usesGroqKeys = /(^|\.)groq\.com$/i.test(new URL(this.baseUrl).hostname) && !this.explicitKey;
  }

  isConfigured() {
    return this.usesGroqKeys ? keyPool.isAvailable() : !!this.baseUrl;
  }

  /**
   * Transcribe an audio buffer. Returns the plain transcript string.
   * On Groq, leases keys from the shared pool so a 429 falls through to the
   * next key and the exhausted one is parked for its retry-after window.
   */
  async transcribe(buffer, filename = 'audio.webm', mimetype = 'audio/webm') {
    const triedOrgs = new Set();
    let lastError;

    for (let attempt = 0; ; attempt++) {
      let key = this.explicitKey;
      let lease = null;

      if (this.usesGroqKeys) {
        lease = keyPool.acquire(triedOrgs);
        if (!lease) break;
        key = lease.key;
      } else if (attempt > 0) {
        break;
      }

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
        if (!this.usesGroqKeys) throw error;

        if (status === 429) {
          keyPool.cool(lease.org, error.response?.headers?.['retry-after']);
          triedOrgs.add(lease.org);
          continue;
        }
        if (status === 401 || status === 403) {
          keyPool.disable(lease.org, lease.index, `HTTP ${status}`);
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('Speech-to-text failed: no usable Groq key');
  }
}

module.exports = new SpeechToTextService();
