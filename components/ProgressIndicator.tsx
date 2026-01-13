'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { ProcessingState } from '@/types';

interface ProgressIndicatorProps {
  state: ProcessingState;
}

const statusMessages = {
  idle: 'Ready to start',
  uploading: 'Uploading video...',
  extracting: 'Extracting audio from video...',
  processing: 'Transcribing audio...',
  finalizing: 'Finalizing transcript...',
  complete: 'Complete!',
  error: 'Error occurred',
};

const statusIcons = {
  idle: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  uploading: (
    <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  extracting: (
    <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
  processing: (
    <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  finalizing: (
    <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  complete: (
    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export function ProgressIndicator({ state }: ProgressIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Status header */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 text-sky-600 dark:text-sky-400">
              {statusIcons[state.status]}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {statusMessages[state.status]}
              </h3>
              {state.message && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {state.message}
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {state.status !== 'idle' && state.status !== 'error' && (
            <div className="space-y-2">
              <Progress value={state.progress} className="h-2" />
              <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                <span>{state.progress}% complete</span>
                {state.currentChunk !== undefined && state.totalChunks !== undefined && (
                  <span>
                    Chunk {state.currentChunk} of {state.totalChunks}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Estimated time remaining */}
          {state.estimatedTimeRemaining !== undefined && state.estimatedTimeRemaining > 0 && (
            <div className="text-sm text-zinc-600 dark:text-zinc-300 text-center">
              Estimated time remaining: {Math.ceil(state.estimatedTimeRemaining / 60)} min
            </div>
          )}

          {/* Processing animation */}
          {state.status === 'processing' && (
            <motion.div
              className="flex justify-center space-x-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-sky-500 rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
