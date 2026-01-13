# Product Requirements Document: Next.js Video Transcription App

## 1. Overview

### 1.1 Purpose
Build a Next.js web application that allows users to upload MP4 video files and receive accurate transcriptions using OpenAI's Whisper API. The app should handle large files by automatically chunking them and provide a seamless user experience.

### 1.2 Target Users
- Content creators needing video transcriptions
- Podcasters converting video content to text
- Educators transcribing lectures
- Anyone needing accurate video-to-text conversion

### 1.3 Core Value Proposition
A beautiful, modern web interface that makes video transcription simple and accessible, handling all the complexity of audio extraction, chunking, and API calls behind the scenes. Powered by OpenAI's Whisper for highly accurate, multilingual transcriptions.

---

## 2. Technical Architecture

### 2.1 Technology Stack
- **Framework**: Next.js 16.1.1 (App Router)
- **UI Components**: 
  - Shadcn/ui with custom preset (vega style, zinc/sky theme)
  - Base UI (@base-ui/react) for headless components
  - Hugeicons (@hugeicons/react) for icon library
  - Font: Raleway
- **Styling**: Tailwind CSS 4
- **API Integration**: OpenAI SDK for Whisper transcription
- **Audio Processing**: ffmpeg (server-side) + OpenAI Whisper API
- **File Handling**: Server-side processing with streaming support
- **Animation**: Framer Motion for smooth transitions
- **Validation**: Zod for type-safe schemas
- **Additional Tools**:
  - Mammoth (document processing)
  - React Markdown (markdown rendering)
  - Firecrawl (@mendable/firecrawl-js) for web scraping if needed

### 2.2 Project Structure
```
/app
  /api
    /transcribe
      route.ts           # Main transcription endpoint
      schema.ts          # Zod validation schemas
    /upload
      route.ts           # File upload handler (optional)
  /transcribe
    page.tsx             # Main transcription UI
  layout.tsx
  page.tsx              # Landing/home page
/components
  /ui                   # Shadcn + Base UI components
  VideoUploader.tsx     # Drag & drop video upload
  TranscriptionDisplay.tsx
  ProgressIndicator.tsx
  ModelSelector.tsx     # Whisper model selection
/lib
  /audio
    processor.ts        # Audio extraction & chunking logic
  /openai
    transcribe.ts       # OpenAI API integration
    client.ts           # OpenAI client setup
  /schemas
    transcription.ts    # Zod schemas for validation
  utils.ts
  cn.ts                 # Tailwind merge utility
/types
  index.ts              # TypeScript definitions
/public
  /fonts
    raleway/            # Raleway font files
```

---

## 3. Functional Requirements

### 3.1 Video Upload
**Priority**: P0 (Critical)

**User Story**: As a user, I want to upload an MP4 video file so that I can get its transcription.

**Acceptance Criteria**:
- Support drag-and-drop file upload
- Support click-to-browse file selection
- Accept MP4, MOV, AVI, and other common video formats
- Display file name and size after selection
- Show file size validation (warn if very large)
- Maximum file size: 2GB (configurable)
- Clear visual feedback during upload
- Ability to cancel upload before processing starts

**Implementation Notes**:
- Use `<input type="file" accept="video/*" />` with custom styling
- Implement drag-and-drop using `onDrop`, `onDragOver`, etc.
- Validate file type and size on client side before upload
- Consider using FormData for file upload to API route

---

### 3.2 Audio Extraction
**Priority**: P0 (Critical)

**User Story**: As the system, I need to extract audio from the video file in an optimal format for transcription.

**Acceptance Criteria**:
- Extract audio using ffmpeg on server
- Convert to mono channel audio
- Set sample rate to 16kHz (optimal for speech)
- Output as MP3 format with 64k bitrate
- Handle extraction errors gracefully
- Clean up temporary files after processing

**Technical Specifications**:
```bash
ffmpeg -y -i input.mp4 -vn -ac 1 -ar 16000 -c:a mp3 -b:a 64k output.mp3
```

**Implementation Notes**:
- Requires ffmpeg installed on server (check in deployment docs)
- Use Node's `child_process` to spawn ffmpeg
- Store extracted audio in temporary directory
- Implement proper error handling for corrupt videos

---

### 3.3 Audio Chunking
**Priority**: P0 (Critical)

**User Story**: As the system, I need to split large audio files into chunks to comply with OpenAI's 25MB upload limit.

**Acceptance Criteria**:
- Check extracted audio file size
- If ≤25MB, send entire file as single request
- If >25MB, split into chunks using ffmpeg segment muxer
- Default chunk duration: 480 seconds (8 minutes)
- Maintain audio quality during chunking
- Name chunks sequentially (chunk_000.mp3, chunk_001.mp3, etc.)
- Track all chunk file paths for processing

**Technical Specifications**:
```bash
ffmpeg -y -i extracted.mp3 -f segment -segment_time 480 -c copy chunk_%03d.mp3
```

**Implementation Notes**:
- 25MB constant: `const MAX_UPLOAD_BYTES = 25 * 1024 * 1024`
- Use fs.stat() to check file size
- Store chunks in unique temporary subdirectory per request

---

### 3.4 Transcription Processing
**Priority**: P0 (Critical)

**User Story**: As the system, I need to transcribe audio chunks using OpenAI's Whisper API and combine them into a cohesive transcript.

**Acceptance Criteria**:
- Use OpenAI's Whisper model (whisper-1 default, gpt-4o-transcribe optional)
- Support optional language parameter (ISO-639-1 code)
- Use `response_format: "text"` for simplicity (or "verbose_json" for timestamps)
- Process chunks sequentially (important for context)
- Implement rolling prompt strategy:
  - Use last 1500 characters of previous chunk as prompt for next chunk
  - Maintains consistency and terminology across chunk boundaries
- Combine all chunk transcripts with double newline separator
- Handle API errors (rate limits, network issues)
- Return complete transcript

**API Call Structure**:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const transcription = await openai.audio.transcriptions.create({
  model: "whisper-1",
  file: fs.createReadStream(audioFilePath),
  response_format: "text",
  language: "en", // optional, ISO-639-1 code
  prompt: rollingPrompt, // optional, from previous chunk for consistency
  temperature: 0, // deterministic output
});

// transcription is a string when response_format is "text"
const text = transcription;
```

**Implementation Notes**:
- Use official OpenAI Node SDK: `npm install openai`
- Require `OPENAI_API_KEY` environment variable
- Stream audio file directly to API (no base64 encoding needed)
- Whisper supports 99+ languages automatically
- Implement exponential backoff for retries
- Log each chunk completion for debugging
- Store last 1500 characters as prompt for next chunk
- Temperature 0 for consistent, deterministic transcription

---

### 3.5 Progress Indication
**Priority**: P1 (High)

**User Story**: As a user, I want to see the progress of my transcription so that I know the system is working and how long it will take.

**Acceptance Criteria**:
- Show different states:
  - "Uploading video..."
  - "Extracting audio..."
  - "Processing chunk X of Y..."
  - "Finalizing transcript..."
  - "Complete!"
- Display progress percentage when applicable
- Show estimated time remaining (after first chunk)
- Use smooth animations for state transitions
- Prevent user from navigating away during processing (confirmation dialog)

**Implementation Notes**:
- Consider using Server-Sent Events (SSE) or polling for real-time updates
- Or implement using streaming response from API route
- Use Shadcn Progress component for visual indicator
- Store processing state in React state or context

---

### 3.6 Transcript Display
**Priority**: P0 (Critical)

**User Story**: As a user, I want to view and interact with my transcript after processing completes.

**Acceptance Criteria**:
- Display full transcript in readable format
- Add timestamps if available (future enhancement)
- Provide copy-to-clipboard button
- Provide download as .txt button
- Provide download as .docx button (nice-to-have)
- Show character and word count
- Make text selectable
- Responsive display on all screen sizes

**Implementation Notes**:
- Use Shadcn Card or similar container
- Implement copy using Clipboard API
- Generate download using Blob and download attribute
- Consider syntax highlighting for readability

---

### 3.7 Configuration Options
**Priority**: P2 (Medium)

**User Story**: As a user, I want to configure transcription settings for better accuracy.

**Acceptance Criteria**:
- Model selection
  - whisper-1 (default, most common)
  - gpt-4o-transcribe (when available, higher accuracy)
- Language selection dropdown (optional but improves accuracy)
  - Auto-detect (default, empty)
  - English, Spanish, French, German, etc. (ISO-639-1 codes)
  - Popular languages with native names
- Custom prompt textarea
  - Helps with technical terms, names, acronyms
  - Maintains consistency across chunks
  - Examples: "This is a medical lecture", "Include company names like Anthropic, OpenAI"
  - Max 1500 characters
- Chunk duration slider (advanced users)
  - Range: 300s - 600s
  - Default: 480s (8 minutes)
- Response format (advanced)
  - text (default, simple)
  - verbose_json (includes timestamps, confidence)
  - srt (subtitle format)
  - vtt (WebVTT format)

**Implementation Notes**:
- Store settings in React state
- Pass as form data or request body to API route
- Validate on server side with Zod schemas
- Persist settings in localStorage for convenience
- Language code improves accuracy but not required
- Prompt helps with domain-specific terminology

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Initial page load: <2 seconds
- File upload should show immediate feedback
- Process 5 minutes of audio in <60 seconds (approximate, depends on API)
- Handle concurrent users (stateless design)

### 4.2 Security
- Validate file types on client and server
- Sanitize all user inputs with Zod schemas
- Never expose OpenAI API key to client
- Implement rate limiting on API routes (prevent abuse)
- Clean up all temporary files after processing
- No data persistence (all processing in-memory/temp files)
- Validate audio files before sending to API
- Implement request size limits
- Use environment variables for all sensitive config
- Handle 25MB file size limit for Whisper API uploads

### 4.3 Error Handling
- Graceful degradation if ffmpeg not available
- Clear error messages for all failure scenarios:
  - Invalid file format
  - File too large
  - API key missing/invalid
  - OpenAI API errors
  - Network failures
- Provide actionable next steps in error messages
- Log errors server-side for debugging

### 4.4 Accessibility
- Keyboard navigation throughout
- Screen reader support for all interactive elements
- ARIA labels on all form inputs
- High contrast mode support
- Focus indicators on all focusable elements

### 4.5 Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly targets (min 44x44px)
- Optimized file upload on mobile (camera integration)

---

## 5. User Interface Specifications

### 5.1 Landing Page (`/`)
**Layout**:
- Hero section with app description
- Feature highlights (3-4 key features)
- CTA button: "Start Transcribing" → navigates to `/transcribe`
- Footer with links and credits

**Shadcn Components**:
- Button (variant: default, size: lg)
- Card (for feature highlights)

---

### 5.2 Transcription Page (`/transcribe`)

**Layout Sections**:

1. **Header**
   - App title/logo
   - Brief instructions

2. **Upload Section** (Initial State)
   - Large drag-and-drop zone
   - Visual indicators (dashed border, upload icon)
   - Text: "Drag & drop your video here, or click to browse"
   - Supported formats list
   - File size limit notice

3. **Configuration Section** (Collapsible)
   - Model selector (Whisper-1, GPT-4o-Transcribe)
   - Language selector dropdown
   - Custom prompt textarea
   - Advanced options toggle
   - Chunk duration slider (in advanced)
   - Response format selector (in advanced)

4. **Processing Section** (During Transcription)
   - Progress bar with percentage
   - Current status message
   - Cancel button (if possible)
   - Estimated time remaining

5. **Results Section** (After Completion)
   - Transcript in scrollable card
   - Action buttons:
     - Copy to clipboard
     - Download as TXT
     - Download as DOCX (optional)
   - Metadata:
     - Video filename
     - Duration processed
     - Word count
     - Character count
   - "Transcribe Another Video" button

**Shadcn & Base UI Components**:
- Card, CardHeader, CardTitle, CardDescription, CardContent
- Button (multiple variants with Framer Motion animations)
- Progress (with smooth transitions)
- Textarea (with character count)
- Select, SelectTrigger, SelectContent, SelectItem (Base UI headless)
- Slider (Base UI)
- Label
- Alert (for errors)
- Badge (for status indicators)
- Icons from @hugeicons/react:
  - HugeiconsUploadCloud
  - HugeiconsVideo
  - HugeiconsFile
  - HugeiconsCheckmark
  - HugeiconsClose
  - HugeiconsSettings
  - HugeiconsDownload
  - HugeiconsCopy

**Color Scheme** (Sky theme):
- Primary: Sky blue
- Background: Zinc shades
- Text: Zinc-900/50
- Accents: Sky-500/600
- Success: Green-500
- Error: Red-500

---

## 6. API Endpoints

### 6.1 POST `/api/transcribe`

**Purpose**: Main endpoint to process video and return transcript

**Request**:
```typescript
Content-Type: multipart/form-data

{
  video: File,
  model?: string,           // "whisper-1" (default) or "gpt-4o-transcribe"
  language?: string,        // ISO-639-1 code (e.g., "en", "es", "fr")
  prompt?: string,          // custom prompt for terminology, max 1500 chars
  chunkSeconds?: number,    // 300-600
  responseFormat?: string   // "text" (default), "verbose_json", "srt", "vtt"
}
```

**Response Success** (200):
```typescript
{
  success: true,
  transcript: string,
  metadata: {
    videoFilename: string,
    duration: number,      // seconds
    wordCount: number,
    charCount: number,
    chunksProcessed: number,
    processingTime: number, // ms
    model: string,
    language?: string
  }
}
```

**Response Error** (400/500):
```typescript
{
  success: false,
  error: string,
  details?: string
}
```

**Implementation Notes**:
- Use Next.js 16 App Router route handler
- Validate request with Zod schemas
- Set appropriate content-type headers
- Implement streaming or SSE for progress updates (optional enhancement)
- Clean up temp files in finally block
- Set reasonable timeout (10 minutes)
- Handle OpenAI API rate limits gracefully (429 errors)
- Implement retry logic with exponential backoff

---

## 7. Environment Variables

```env
# Required
OPENAI_API_KEY=sk-...

# Optional
MAX_FILE_SIZE_MB=2048
CHUNK_DURATION_SECONDS=480
TEMP_DIR=/tmp/transcriptions
NODE_ENV=development
DEFAULT_MODEL=whisper-1
DEFAULT_LANGUAGE=
```

---

## 8. Dependencies

### Core Dependencies
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "openai": "^4.80.0",
    "@base-ui/react": "^1.0.0",
    "@hugeicons/core-free-icons": "^3.1.1",
    "@hugeicons/react": "^1.1.4",
    "@mendable/firecrawl-js": "^4.10.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^11.15.0",
    "mammoth": "^1.11.0",
    "next": "16.1.1",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-markdown": "^9.0.1",
    "shadcn": "^3.6.2",
    "tailwind-merge": "^3.4.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.1",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### System Requirements
- **Node.js**: 20.x or higher
- **ffmpeg**: Must be installed and available on PATH
  - Installation: `brew install ffmpeg` (macOS)
  - Verify: `ffmpeg -version`
- **ffprobe**: Usually bundled with ffmpeg

---

## 9. Implementation Phases

### Phase 1: Core Functionality (MVP)
**Deliverables**:
- Basic file upload UI
- Server-side audio extraction
- Single-file transcription (no chunking)
- Display transcript result
- Basic error handling

**Duration**: 1 session

---

### Phase 2: Chunking & Large Files
**Deliverables**:
- Implement audio chunking for >25MB files
- Rolling prompt strategy
- Progress indication
- Handle multiple chunks

**Duration**: 1 session

---

### Phase 3: Polish & Features
**Deliverables**:
- Shadcn UI components integration
- Landing page
- Configuration options
- Copy/download functionality
- Improved error handling
- Loading states and animations

**Duration**: 1 session

---

### Phase 4: Enhancements (Optional)
**Deliverables**:
- Real-time progress with SSE
- Timestamp support in transcripts
- Multiple language support UI
- DOCX export
- History/saved transcripts (if needed)

**Duration**: As needed

---

## 10. Testing Strategy

### 10.1 Manual Testing Checklist
- [ ] Upload small video (<5MB) - single chunk
- [ ] Upload large video (>25MB) - multiple chunks
- [ ] Upload invalid file type
- [ ] Upload file exceeding size limit
- [ ] Test with missing API key
- [ ] Test with invalid API key
- [ ] Test with no internet connection
- [ ] Test different Whisper models (whisper-1, gpt-4o-transcribe)
- [ ] Test language selection (auto, English, Spanish, etc.)
- [ ] Test custom prompt for terminology
- [ ] Test different chunk durations
- [ ] Test different response formats (text, verbose_json, srt, vtt)
- [ ] Test copy to clipboard
- [ ] Test download as TXT
- [ ] Test responsive design on mobile
- [ ] Test accessibility with keyboard only
- [ ] Test with screen reader
- [ ] Test Framer Motion animations
- [ ] Test with different video formats (MP4, MOV, AVI)

### 10.2 Edge Cases
- Empty video file
- Video with no audio track
- Corrupted video file
- Very long video (>1 hour)
- Multiple rapid uploads
- Browser tab closed during processing

---

## 11. Deployment Considerations

### 11.1 Vercel Deployment
- Ensure ffmpeg is available (may need custom Docker image or serverless function)
- Alternative: Use Vercel Edge Functions with runtime that includes ffmpeg
- Or: Use a separate service/container for ffmpeg processing

### 11.2 Environment Setup
- Add `OPENAI_API_KEY` to Vercel environment variables
- Configure `MAX_FILE_SIZE_MB` if needed
- Set appropriate function timeout (Vercel limit: 10s for Hobby, 60s+ for Pro)

### 11.3 Temporary File Storage
- Use `/tmp` directory in serverless functions
- Be aware of storage limits
- Implement aggressive cleanup
- Consider using cloud storage (S3, R2) for larger deployments

---

## 12. Future Enhancements

### 12.1 Potential Features
- Speaker diarization (identify different speakers - requires additional API)
- Sentiment analysis on transcript using GPT-4
- Key points extraction using GPT-4
- Summary generation with different detail levels (GPT-4)
- Timestamp injection in transcript (use verbose_json format)
- Export to SRT/VTT subtitle formats (already supported by Whisper)
- Integration with video players
- Multi-language transcription in single video
- Batch processing multiple videos
- API key management (bring your own key)
- Saved transcripts/history with local storage
- Real-time transcription (live video with streaming)
- Video trimming before transcription
- Transcript editing with AI suggestions (GPT-4)
- Meeting notes generation from transcripts (GPT-4)
- Action items extraction (GPT-4)
- Translation to multiple languages (GPT-4)

### 12.2 Technical Improvements
- WebAssembly ffmpeg (client-side processing for privacy)
- Queue system for high traffic (BullMQ, Redis)
- Caching for repeat transcriptions
- CDN for faster uploads
- Incremental processing for very long videos
- Parallel chunk processing (with rate limit awareness)
- GPT-4 powered transcript formatting and cleanup
- Integration with OpenAI Assistants API for workflows
- Support for OpenAI's fine-tuned Whisper models

---

## 13. Success Metrics

### 13.1 Key Performance Indicators
- Average processing time per minute of video
- Transcription accuracy rate (user feedback)
- Error rate percentage
- User completion rate (upload → transcript)
- Time to first result

### 13.2 User Satisfaction
- Ease of use rating
- Would-recommend score
- Feature request patterns

---

## 14. Documentation Requirements

### 14.1 User Documentation
- How to use guide (with screenshots)
- Supported formats list
- Best practices for accuracy:
  - Clear audio
  - Minimal background noise
  - Specify language if known

### 14.2 Developer Documentation
- Setup instructions (ffmpeg installation)
- Environment variables reference
- API endpoint documentation
- Code architecture overview
- Deployment guide

---

## 15. Constraints & Assumptions

### Constraints
- OpenAI API rate limits (tier-dependent)
- 25MB file size limit per Whisper API upload
- Vercel/serverless function timeouts
- Temporary storage limits
- ffmpeg must be available on server
- Audio files must be streamed to API (not base64)

### Assumptions
- Users have stable internet connection
- Users have valid video files
- OpenAI API availability and performance
- Whisper API supports all common audio/video formats
- Users understand basic file upload concepts
- Server has sufficient compute for ffmpeg operations
- Chunk size (8 minutes default) stays under 25MB limit after compression

---

## 16. Implementation Notes for Claude Code

### Key Focus Areas
1. **Start with Shadcn Setup**: Initialize the Next.js 16 project with Shadcn using the custom preset (vega style, zinc/sky theme, hugeicons, raleway font)

2. **Server-Side Processing**: All ffmpeg and OpenAI API calls must happen in API routes, never client-side

3. **Type Safety**: Use TypeScript throughout with Zod schemas for all API requests/responses and file handling

4. **Error Boundaries**: Implement React error boundaries and proper try-catch in API routes

5. **Temp File Management**: Create utility functions for temp file creation and cleanup with proper error handling

6. **Streaming vs Polling**: Consider the tradeoffs - streaming responses provide better UX but add complexity

7. **File Size Validation**: Implement on both client (immediate feedback with Zod) and server (security)

8. **Audio Streaming**: Use fs.createReadStream() for efficient memory usage with OpenAI API

9. **Framer Motion**: Use for smooth page transitions and loading states

10. **Hugeicons Integration**: Use appropriate icons throughout the UI for visual consistency

### Suggested File Creation Order
1. Project setup with Next.js 16 and Shadcn preset
2. Type definitions (`/types/index.ts`)
3. Zod schemas (`/lib/schemas/transcription.ts`)
4. Utility functions (`/lib/utils.ts`, `/lib/cn.ts`)
5. OpenAI client setup (`/lib/openai/client.ts`)
6. Audio processor (`/lib/audio/processor.ts`)
7. OpenAI transcription logic (`/lib/openai/transcribe.ts`)
8. API route with validation (`/app/api/transcribe/route.ts`, `schema.ts`)
9. UI components (ModelSelector, VideoUploader, TranscriptionDisplay, etc.)
10. Main transcription page with Framer Motion (`/app/transcribe/page.tsx`)
11. Landing page with animations (`/app/page.tsx`)
12. Testing and refinement

---

## 17. Questions to Resolve

1. Should we persist transcripts or make everything ephemeral?
2. Do we need user authentication for rate limiting?
3. Should we support video URLs in addition to uploads?
4. Do we need to support formats other than MP4 (MOV, AVI, etc.)?
5. What's the actual deployment target (Vercel, Docker, VPS)?
6. Do we need webhook/callback support for long processing?

---

## Appendix A: Reference Python Code Analysis

The provided Python script demonstrates key patterns using OpenAI's Whisper API:
- ✅ Audio extraction with optimal settings for speech
- ✅ Automatic chunking for large files
- ✅ Rolling prompt strategy for chunk consistency
- ✅ Progress indication during processing
- ✅ Flexible configuration options
- ✅ Proper error handling and cleanup

**Implementation in Next.js**:
These patterns should be replicated in the Next.js implementation with OpenAI's Whisper API:
- Use OpenAI SDK (@latest)
- Stream audio files directly to API (no base64 needed)
- Use dedicated transcriptions endpoint (not general completions)
- Implement rolling prompt strategy exactly as Python example shows
- Leverage Whisper's multilingual capabilities (99+ languages)
- Implement proper error handling for OpenAI-specific rate limits and responses
- Use temperature: 0 for deterministic transcription
- Support multiple response formats (text, verbose_json, srt, vtt)

---

## Appendix B: Additional Libraries & Use Cases

### B.1 Mammoth (@1.11.0)
**Purpose**: Convert .docx files to HTML/text
**Use Case**: Allow users to upload transcripts in Word format for comparison or editing
**Implementation**: Optional feature to import existing transcripts

### B.2 React Markdown (@9.0.1)
**Purpose**: Render Markdown in React
**Use Case**: 
- Format transcripts with Markdown for better readability
- Support structured output with headers, lists, emphasis
- Render help documentation and instructions
- Display formatted GPT-4 generated summaries or notes

### B.3 Firecrawl (@4.10.0)
**Purpose**: Web scraping and content extraction
**Use Case**: 
- Optional: Allow users to provide YouTube URLs and scrape for audio
- Extract video metadata from URLs
- Future: Batch processing from web sources

### B.4 Framer Motion (@11.15.0)
**Purpose**: Animation library
**Use Case**:
- Smooth page transitions
- Loading state animations
- Progress indicator animations
- Micro-interactions on buttons and cards
- Drag and drop visual feedback

**Example Pattern**:
```typescript
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};
```

### B.5 tw-animate-css (@1.4.0)
**Purpose**: Tailwind CSS animations
**Use Case**:
- Quick CSS animations for elements
- Fade-ins, slide-ins for components
- Complement Framer Motion for simpler animations

### B.6 Zod (@3.24.1)
**Purpose**: TypeScript-first schema validation
**Critical Use Cases**:
- Validate all API requests and responses
- Form validation on client
- Environment variable validation
- Type-safe configuration
- Error message generation

**Example Schema**:
```typescript
import { z } from 'zod';

export const transcriptionRequestSchema = z.object({
  video: z.instanceof(File),
  model: z.enum(['whisper-1', 'gpt-4o-transcribe']).optional(),
  language: z.string().length(2).optional(), // ISO-639-1 code
  prompt: z.string().max(1500).optional(),
  chunkSeconds: z.number().min(300).max(600).optional(),
  responseFormat: z.enum(['text', 'verbose_json', 'srt', 'vtt']).optional(),
});

export const envSchema = z.object({
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(2048),
});

export const env = envSchema.parse(process.env);
```

---

## Appendix C: Animation & UX Guidelines

### C.1 Framer Motion Best Practices
**Page Transitions**:
- Use consistent transition timing (0.3-0.5s)
- Apply spring physics for natural movement
- Implement exit animations for smooth flow

**Loading States**:
- Use spring animations for natural feel
- Stagger children animations for lists
- Rotate spinner smoothly with infinite animation

**Drag & Drop**:
```typescript
const dropZoneVariants = {
  idle: { scale: 1, borderColor: 'var(--zinc-300)' },
  hover: { scale: 1.02, borderColor: 'var(--sky-500)' },
  active: { scale: 0.98, borderColor: 'var(--green-500)' }
};
```

### C.2 Performance Considerations
- Use `transform` and `opacity` for animations (GPU-accelerated)
- Implement `will-change` CSS property strategically
- Lazy load Framer Motion components when possible
- Reduce motion for users with `prefers-reduced-motion`
- Use `layoutId` for shared element transitions

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Status**: Ready for Implementation
