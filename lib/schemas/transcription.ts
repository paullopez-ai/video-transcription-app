import { z } from 'zod';

// Whisper model options
export const whisperModelSchema = z.enum(['whisper-1', 'gpt-4o-transcribe']);

// Response format options
export const responseFormatSchema = z.enum(['text', 'verbose_json', 'srt', 'vtt']);

// Transcription request schema for API validation
export const transcriptionRequestSchema = z.object({
  model: whisperModelSchema.optional().default('whisper-1'),
  language: z.string().length(2).optional(), // ISO-639-1 code
  prompt: z.string().max(1500).optional(),
  chunkSeconds: z.number().min(300).max(600).optional().default(480),
  responseFormat: responseFormatSchema.optional().default('text'),
});

// Environment variables schema
export const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().optional().default(2048),
  CHUNK_DURATION_SECONDS: z.coerce.number().min(300).max(600).optional().default(480),
  TEMP_DIR: z.string().optional().default('/tmp/transcriptions'),
  DEFAULT_MODEL: whisperModelSchema.optional().default('whisper-1'),
  DEFAULT_LANGUAGE: z.string().length(2).optional(),
});

// File validation schema (client-side)
export const fileValidationSchema = z.object({
  name: z.string().min(1),
  size: z.number().positive().max(2048 * 1024 * 1024, 'File size must be less than 2GB'),
  type: z.string().regex(/^video\//i, 'File must be a video'),
});

// Transcription metadata schema
export const transcriptionMetadataSchema = z.object({
  videoFilename: z.string(),
  duration: z.number(),
  wordCount: z.number(),
  charCount: z.number(),
  chunksProcessed: z.number(),
  processingTime: z.number(),
  model: whisperModelSchema,
  language: z.string().length(2).optional(),
});

// Transcription response schema
export const transcriptionResponseSchema = z.object({
  success: z.literal(true),
  transcript: z.string(),
  metadata: transcriptionMetadataSchema,
});

// Error response schema
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.string().optional(),
});

// Combined result schema
export const transcriptionResultSchema = z.discriminatedUnion('success', [
  transcriptionResponseSchema,
  errorResponseSchema,
]);

// Type exports
export type TranscriptionRequestData = z.infer<typeof transcriptionRequestSchema>;
export type EnvConfig = z.infer<typeof envSchema>;
export type TranscriptionMetadata = z.infer<typeof transcriptionMetadataSchema>;
export type TranscriptionResponse = z.infer<typeof transcriptionResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type TranscriptionResult = z.infer<typeof transcriptionResultSchema>;
