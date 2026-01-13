// Type definitions for video transcription application

export type WhisperModel = 'whisper-1' | 'gpt-4o-transcribe';

export type ResponseFormat = 'text' | 'verbose_json' | 'srt' | 'vtt';

export type LanguageCode = string; // ISO-639-1 code (e.g., 'en', 'es', 'fr')

export interface TranscriptionRequest {
  video: File;
  model?: WhisperModel;
  language?: LanguageCode;
  prompt?: string;
  chunkSeconds?: number;
  responseFormat?: ResponseFormat;
}

export interface TranscriptionMetadata {
  videoFilename: string;
  duration: number; // seconds
  wordCount: number;
  charCount: number;
  chunksProcessed: number;
  processingTime: number; // milliseconds
  model: WhisperModel;
  language?: LanguageCode;
}

export interface TranscriptionResponse {
  success: true;
  transcript: string;
  metadata: TranscriptionMetadata;
}

export interface TranscriptionError {
  success: false;
  error: string;
  details?: string;
}

export type TranscriptionResult = TranscriptionResponse | TranscriptionError;

export interface ProcessingState {
  status: 'idle' | 'uploading' | 'extracting' | 'processing' | 'finalizing' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  currentChunk?: number;
  totalChunks?: number;
  estimatedTimeRemaining?: number; // seconds
}

export interface AudioChunk {
  path: string;
  index: number;
  duration: number;
}

export interface AudioExtractionResult {
  audioPath: string;
  duration: number;
  size: number; // bytes
}

export interface ChunkingResult {
  chunks: AudioChunk[];
  totalDuration: number;
}
