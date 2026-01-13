import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { config, MAX_UPLOAD_BYTES } from '@/lib/openai/client';
import type { AudioExtractionResult, ChunkingResult, AudioChunk } from '@/types';

/**
 * Check if ffmpeg is available on the system
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);

    ffmpeg.on('error', () => resolve(false));
    ffmpeg.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Execute ffmpeg command
 */
async function executeFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg process error: ${error.message}`));
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Get audio duration using ffprobe
 */
async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);

    let stdout = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.on('error', (error) => {
      reject(new Error(`FFprobe process error: ${error.message}`));
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(stdout.trim());
        resolve(isNaN(duration) ? 0 : duration);
      } else {
        reject(new Error(`FFprobe failed with code ${code}`));
      }
    });
  });
}

/**
 * Create a unique temporary directory for processing
 */
export async function createTempDir(): Promise<string> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const tempDir = path.join(config.tempDir, `transcription_${timestamp}_${random}`);

  await fs.mkdir(tempDir, { recursive: true });

  return tempDir;
}

/**
 * Extract audio from video file
 * Converts to mono, 16kHz, MP3 @ 64k - optimal for speech transcription
 */
export async function extractAudio(
  videoPath: string,
  outputPath: string
): Promise<AudioExtractionResult> {
  const args = [
    '-y', // Overwrite output file
    '-i', videoPath,
    '-vn', // No video
    '-ac', '1', // Mono channel
    '-ar', '16000', // 16kHz sample rate
    '-c:a', 'mp3', // MP3 codec
    '-b:a', '64k', // 64k bitrate
    outputPath
  ];

  await executeFfmpeg(args);

  // Get file stats
  const stats = await fs.stat(outputPath);
  const duration = await getAudioDuration(outputPath);

  return {
    audioPath: outputPath,
    duration,
    size: stats.size,
  };
}

/**
 * Chunk audio file into smaller segments
 * Used when audio file exceeds OpenAI's 25MB limit
 */
export async function chunkAudio(
  audioPath: string,
  outputDir: string,
  chunkSeconds: number = config.chunkDurationSeconds
): Promise<ChunkingResult> {
  const outputPattern = path.join(outputDir, 'chunk_%03d.mp3');

  const args = [
    '-y',
    '-i', audioPath,
    '-f', 'segment',
    '-segment_time', chunkSeconds.toString(),
    '-c', 'copy', // Copy codec (no re-encoding)
    outputPattern
  ];

  await executeFfmpeg(args);

  // Find all generated chunks
  const files = await fs.readdir(outputDir);
  const chunkFiles = files
    .filter(f => f.startsWith('chunk_') && f.endsWith('.mp3'))
    .sort();

  // Get duration for each chunk
  const chunks: AudioChunk[] = await Promise.all(
    chunkFiles.map(async (file, index) => {
      const filePath = path.join(outputDir, file);
      const duration = await getAudioDuration(filePath);

      return {
        path: filePath,
        index,
        duration,
      };
    })
  );

  const totalDuration = chunks.reduce((sum, chunk) => sum + chunk.duration, 0);

  return {
    chunks,
    totalDuration,
  };
}

/**
 * Process video file: extract audio and chunk if necessary
 */
export async function processVideo(
  videoPath: string,
  tempDir: string,
  chunkSeconds?: number
): Promise<{ audioPath: string; chunks?: AudioChunk[]; duration: number }> {
  // Extract audio
  const audioPath = path.join(tempDir, 'extracted_audio.mp3');
  const extractionResult = await extractAudio(videoPath, audioPath);

  // Check if chunking is needed
  if (extractionResult.size <= MAX_UPLOAD_BYTES) {
    // Single file, no chunking needed
    return {
      audioPath,
      duration: extractionResult.duration,
    };
  }

  // File is too large, chunk it
  const chunkDir = path.join(tempDir, 'chunks');
  await fs.mkdir(chunkDir, { recursive: true });

  const chunkingResult = await chunkAudio(audioPath, chunkDir, chunkSeconds);

  return {
    audioPath,
    chunks: chunkingResult.chunks,
    duration: chunkingResult.totalDuration,
  };
}

/**
 * Clean up temporary directory and all its contents
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Failed to cleanup temp directory:', error);
    // Don't throw - cleanup failure shouldn't break the main flow
  }
}

/**
 * Save uploaded file to temporary location
 */
export async function saveUploadedFile(
  file: File,
  tempDir: string
): Promise<string> {
  const filename = `video_${Date.now()}${path.extname(file.name)}`;
  const filePath = path.join(tempDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return filePath;
}
