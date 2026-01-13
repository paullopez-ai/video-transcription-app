import OpenAI from 'openai';
import { envSchema } from '@/lib/schemas/transcription';

// Lazy initialization to avoid build-time failures
let _openai: OpenAI | null = null;
let _config: ReturnType<typeof getConfig> | null = null;

function getConfig() {
  const env = envSchema.parse(process.env);
  return {
    maxFileSizeMB: env.MAX_FILE_SIZE_MB,
    chunkDurationSeconds: env.CHUNK_DURATION_SECONDS,
    tempDir: env.TEMP_DIR,
    defaultModel: env.DEFAULT_MODEL,
    defaultLanguage: env.DEFAULT_LANGUAGE,
    nodeEnv: env.NODE_ENV,
    apiKey: env.OPENAI_API_KEY,
  };
}

// Lazy getter for OpenAI client
export function getOpenAI(): OpenAI {
  if (!_openai) {
    try {
      const config = getConfig();
      _openai = new OpenAI({
        apiKey: config.apiKey,
      });
    } catch (error) {
      console.error('Environment validation failed:', error);
      throw new Error('Missing or invalid environment variables. Please check your .env file.');
    }
  }
  return _openai;
}

// Lazy getter for config
export function getAppConfig() {
  if (!_config) {
    try {
      _config = getConfig();
    } catch (error) {
      console.error('Environment validation failed:', error);
      throw new Error('Missing or invalid environment variables. Please check your .env file.');
    }
  }
  return _config;
}

// For backwards compatibility, export a proxy that calls getOpenAI()
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const client = getOpenAI();
    return (client as any)[prop];
  }
});

// For backwards compatibility, export a proxy that calls getAppConfig()
export const config = new Proxy({} as ReturnType<typeof getConfig>, {
  get(_target, prop) {
    const cfg = getAppConfig();
    return (cfg as any)[prop];
  }
});

// Constants
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB - OpenAI's limit
export const ROLLING_PROMPT_LENGTH = 1500; // Last 1500 characters for context
