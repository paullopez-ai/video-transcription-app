import fs from 'fs';
import { openai, ROLLING_PROMPT_LENGTH } from './client';
import type { WhisperModel, ResponseFormat, AudioChunk } from '@/types';

/**
 * Retry configuration for API calls
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

/**
 * Transcribe a single audio file using OpenAI Whisper API
 */
export async function transcribeAudioFile(
  audioPath: string,
  options: {
    model?: WhisperModel;
    language?: string;
    prompt?: string;
    responseFormat?: ResponseFormat;
  } = {}
): Promise<string> {
  const {
    model = 'whisper-1',
    language,
    prompt,
    responseFormat = 'text',
  } = options;

  let lastError: Error | null = null;

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const transcription = await openai.audio.transcriptions.create({
        model,
        file: fs.createReadStream(audioPath),
        response_format: responseFormat,
        language,
        prompt,
        temperature: 0, // Deterministic output
      });

      // OpenAI SDK returns a string when response_format is "text"
      return typeof transcription === 'string' ? transcription : transcription.text;
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error (429)
      if (error?.status === 429 && attempt < RETRY_CONFIG.maxRetries - 1) {
        const delay = getRetryDelay(attempt);
        console.log(`Rate limited. Retrying in ${delay}ms... (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`);
        await sleep(delay);
        continue;
      }

      // Check if it's a retriable error
      const isRetriable =
        error?.status >= 500 || // Server errors
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT';

      if (isRetriable && attempt < RETRY_CONFIG.maxRetries - 1) {
        const delay = getRetryDelay(attempt);
        console.log(`Retriable error. Retrying in ${delay}ms... (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`);
        await sleep(delay);
        continue;
      }

      // Non-retriable error or max retries reached
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Transcription failed after retries');
}

/**
 * Transcribe audio chunks with rolling prompt strategy
 */
export async function transcribeChunks(
  chunks: AudioChunk[],
  options: {
    model?: WhisperModel;
    language?: string;
    initialPrompt?: string;
    responseFormat?: ResponseFormat;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<{ transcript: string; chunksProcessed: number }> {
  const {
    model = 'whisper-1',
    language,
    initialPrompt = '',
    responseFormat = 'text',
    onProgress,
  } = options;

  const transcripts: string[] = [];
  let rollingPrompt = initialPrompt;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    console.log(`Processing chunk ${i + 1} of ${chunks.length}...`);

    // Transcribe the chunk with rolling prompt
    const transcript = await transcribeAudioFile(chunk.path, {
      model,
      language,
      prompt: rollingPrompt || undefined,
      responseFormat,
    });

    transcripts.push(transcript);

    // Update rolling prompt with last 1500 characters for next chunk
    if (transcript.length > ROLLING_PROMPT_LENGTH) {
      rollingPrompt = transcript.slice(-ROLLING_PROMPT_LENGTH);
    } else {
      rollingPrompt = transcript;
    }

    // Report progress
    if (onProgress) {
      onProgress(i + 1, chunks.length);
    }
  }

  // Combine all transcripts with double newline separator
  const combinedTranscript = transcripts.join('\n\n');

  return {
    transcript: combinedTranscript,
    chunksProcessed: chunks.length,
  };
}

/**
 * Main transcription function - handles single file or chunked files
 */
export async function transcribeAudio(
  audioPath: string,
  chunks: AudioChunk[] | undefined,
  options: {
    model?: WhisperModel;
    language?: string;
    prompt?: string;
    responseFormat?: ResponseFormat;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<{ transcript: string; chunksProcessed: number }> {
  // If no chunks, transcribe as single file
  if (!chunks || chunks.length === 0) {
    const transcript = await transcribeAudioFile(audioPath, options);
    return {
      transcript,
      chunksProcessed: 1,
    };
  }

  // Transcribe chunks with rolling prompt strategy
  return transcribeChunks(chunks, options);
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Count characters in text (excluding whitespace)
 */
export function countCharacters(text: string): number {
  return text.replace(/\s/g, '').length;
}
