'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoUploader } from '@/components/VideoUploader';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { TranscriptionDisplay } from '@/components/TranscriptionDisplay';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ProcessingState, TranscriptionResponse } from '@/types';

export default function TranscribePage() {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [result, setResult] = useState<TranscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
    setResult(null);
  };

  const handleTranscribe = async () => {
    if (!selectedFile) return;

    setError(null);
    setResult(null);

    try {
      // Start upload
      setProcessingState({
        status: 'uploading',
        progress: 10,
        message: 'Preparing video file...',
      });

      // Create form data
      const formData = new FormData();
      formData.append('video', selectedFile);

      // Update to extracting
      setProcessingState({
        status: 'extracting',
        progress: 30,
        message: 'Extracting audio from video...',
      });

      // Make API request
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      // Update to processing
      setProcessingState({
        status: 'processing',
        progress: 60,
        message: 'Transcribing audio with AI...',
      });

      const data: TranscriptionResponse = await response.json();

      // Update to finalizing
      setProcessingState({
        status: 'finalizing',
        progress: 90,
        message: 'Finalizing transcript...',
      });

      // Small delay for smooth transition
      await new Promise(resolve => setTimeout(resolve, 500));

      // Complete
      setProcessingState({
        status: 'complete',
        progress: 100,
        message: 'Transcription complete!',
      });

      setResult(data);
    } catch (err: any) {
      console.error('Transcription error:', err);
      setError(err.message || 'Failed to transcribe video');
      setProcessingState({
        status: 'error',
        progress: 0,
        message: err.message || 'An error occurred',
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setProcessingState({
      status: 'idle',
      progress: 0,
      message: '',
    });
  };

  const isProcessing = ['uploading', 'extracting', 'processing', 'finalizing'].includes(
    processingState.status
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            Video Transcription
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Upload your video and get an accurate AI-powered transcription in minutes
          </p>
        </motion.div>

        <div className="space-y-8">
          {/* Upload section */}
          {!result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <VideoUploader
                onFileSelect={handleFileSelect}
                disabled={isProcessing}
              />

              {selectedFile && !isProcessing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex justify-center"
                >
                  <button
                    onClick={handleTranscribe}
                    className="px-8 py-3 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl"
                  >
                    Start Transcription
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Progress indicator */}
          <AnimatePresence mode="wait">
            {isProcessing && (
              <ProgressIndicator state={processingState} />
            )}
          </AnimatePresence>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong>Error:</strong> {error}
                  </AlertDescription>
                </Alert>
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleReset}
                    className="px-6 py-2 bg-zinc-600 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {result && processingState.status === 'complete' && (
              <TranscriptionDisplay
                transcript={result.transcript}
                metadata={result.metadata}
                onReset={handleReset}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Info section */}
        {processingState.status === 'idle' && !selectedFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-12 text-center"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="p-6 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                <div className="text-sky-600 dark:text-sky-400 mb-3">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Fast Processing
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Powered by OpenAI Whisper for quick and accurate transcriptions
                </p>
              </div>

              <div className="p-6 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                <div className="text-sky-600 dark:text-sky-400 mb-3">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Multi-Language
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Supports 99+ languages with automatic detection
                </p>
              </div>

              <div className="p-6 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                <div className="text-sky-600 dark:text-sky-400 mb-3">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Secure & Private
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Files are processed securely and deleted immediately after
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
