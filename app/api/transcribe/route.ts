import { NextRequest, NextResponse } from 'next/server';
import { transcriptionRequestSchema } from '@/lib/schemas/transcription';
import {
  createTempDir,
  saveUploadedFile,
  processVideo,
  cleanupTempDir,
  checkFfmpegAvailable,
} from '@/lib/audio/processor';
import {
  transcribeAudio,
  countWords,
  countCharacters,
} from '@/lib/openai/transcribe';
import type { TranscriptionResponse, TranscriptionError } from '@/types';

// Set a longer timeout for this route (10 minutes)
export const maxDuration = 600;

/**
 * POST /api/transcribe
 * Main endpoint for video transcription
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let tempDir: string | null = null;
  const startTime = Date.now();

  try {
    // Check if ffmpeg is available
    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      const error: TranscriptionError = {
        success: false,
        error: 'FFmpeg not available',
        details: 'FFmpeg must be installed on the server. Please install it using: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)',
      };
      return NextResponse.json(error, { status: 500 });
    }

    // Parse form data
    const formData = await request.formData();
    const video = formData.get('video') as File | null;

    if (!video) {
      const error: TranscriptionError = {
        success: false,
        error: 'No video file provided',
        details: 'Please upload a video file',
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Validate file
    if (!video.type.startsWith('video/')) {
      const error: TranscriptionError = {
        success: false,
        error: 'Invalid file type',
        details: `Expected a video file, got ${video.type}`,
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Parse and validate options
    const rawOptions = {
      model: formData.get('model') || undefined,
      language: formData.get('language') || undefined,
      prompt: formData.get('prompt') || undefined,
      chunkSeconds: formData.get('chunkSeconds')
        ? Number(formData.get('chunkSeconds'))
        : undefined,
      responseFormat: formData.get('responseFormat') || undefined,
    };

    const validationResult = transcriptionRequestSchema.safeParse(rawOptions);

    if (!validationResult.success) {
      const error: TranscriptionError = {
        success: false,
        error: 'Invalid request parameters',
        details: validationResult.error.issues.map(e => e.message).join(', '),
      };
      return NextResponse.json(error, { status: 400 });
    }

    const options = validationResult.data;

    // Create temporary directory
    tempDir = await createTempDir();

    // Save uploaded video file
    const videoPath = await saveUploadedFile(video, tempDir);

    // Process video: extract audio and chunk if needed
    const { audioPath, chunks, duration } = await processVideo(
      videoPath,
      tempDir,
      options.chunkSeconds
    );

    console.log(`Video processed: ${duration.toFixed(2)}s, ${chunks ? chunks.length : 1} chunk(s)`);

    // Transcribe audio
    const { transcript, chunksProcessed } = await transcribeAudio(
      audioPath,
      chunks,
      {
        model: options.model,
        language: options.language,
        prompt: options.prompt,
        responseFormat: options.responseFormat,
      }
    );

    // Calculate statistics
    const wordCount = countWords(transcript);
    const charCount = countCharacters(transcript);
    const processingTime = Date.now() - startTime;

    // Prepare response
    const response: TranscriptionResponse = {
      success: true,
      transcript,
      metadata: {
        videoFilename: video.name,
        duration,
        wordCount,
        charCount,
        chunksProcessed,
        processingTime,
        model: options.model,
        language: options.language,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('Transcription error:', error);

    // Handle OpenAI API errors
    if (error?.status === 401) {
      const errorResponse: TranscriptionError = {
        success: false,
        error: 'OpenAI API authentication failed',
        details: 'Invalid API key. Please check your OPENAI_API_KEY environment variable.',
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    if (error?.status === 429) {
      const errorResponse: TranscriptionError = {
        success: false,
        error: 'Rate limit exceeded',
        details: 'OpenAI API rate limit reached. Please try again later.',
      };
      return NextResponse.json(errorResponse, { status: 429 });
    }

    // Generic error response
    const errorResponse: TranscriptionError = {
      success: false,
      error: 'Transcription failed',
      details: error?.message || 'An unexpected error occurred',
    };

    return NextResponse.json(errorResponse, { status: 500 });
  } finally {
    // Clean up temporary files
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}
