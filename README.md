# Video Transcription App

A modern Next.js application that transcribes video files using OpenAI's Whisper API. Upload a video, get an accurate AI-powered transcription in minutes.

![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black)
![React](https://img.shields.io/badge/React-19.2.3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![OpenAI](https://img.shields.io/badge/OpenAI-Whisper-green)

## Features

- 🎥 **Video Upload** - Drag-and-drop or click to upload video files (MP4, MOV, AVI, etc.)
- 🎙️ **AI Transcription** - Powered by OpenAI Whisper for highly accurate transcriptions
- 🌍 **Multi-Language Support** - Transcribes 99+ languages with automatic detection
- 📦 **Large File Handling** - Automatic chunking for files up to 2GB
- 📝 **Easy Export** - Copy to clipboard or download as TXT
- 🎨 **Beautiful UI** - Modern design with Framer Motion animations
- 🌙 **Dark Mode** - Full dark mode support
- 🔒 **Secure** - Files processed and deleted immediately after transcription

## Prerequisites

- **Node.js** 20.x or higher
- **FFmpeg** - Must be installed and available on PATH
- **OpenAI API Key** - Get one from [OpenAI Platform](https://platform.openai.com/api-keys)

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use:
```bash
choco install ffmpeg
```

Verify installation:
```bash
ffmpeg -version
```

## Installation

1. **Clone the repository**
   ```bash
   cd video_transcription
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

4. **Add your OpenAI API key to `.env.local`**
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. Click "Get Started" or navigate to `/transcribe`
2. Upload a video file (drag-and-drop or click to browse)
3. Click "Start Transcription"
4. Wait for processing (progress indicator shows status)
5. View your transcript
6. Copy to clipboard or download as TXT file

## Important: Transcription vs Translation

### What This App Currently Does

This app performs **transcription**, which means it converts speech to text **in the same language**:

- Spanish video → Spanish text ✅
- French video → French text ✅
- English video → English text ✅
- Supports 99+ languages in their original form

### What About Translation?

OpenAI Whisper **does support translation**, but with limitations:

1. **Whisper's Native Translation** (to English only):
   - Any language → English text only
   - Uses the `/translations` endpoint instead of `/transcriptions`

2. **GPT-4 Translation** (any language to any language):
   - Requires two API calls: Whisper transcription + GPT-4 translation
   - More expensive but fully flexible

---

## Adding Translation Support (Developer Guide)

If you want to add translation functionality to this app, follow these instructions:

### Option 1: Add Whisper's Translation to English

Whisper has a built-in translation feature that translates any language to English.

#### Step 1: Update Type Definitions

**File: `types/index.ts`**

Add a new type for the mode:
```typescript
export type TranscriptionMode = 'transcribe' | 'translate-to-english';

export interface TranscriptionRequest {
  video: File;
  model?: WhisperModel;
  language?: LanguageCode;
  prompt?: string;
  chunkSeconds?: number;
  responseFormat?: ResponseFormat;
  mode?: TranscriptionMode; // Add this line
}
```

#### Step 2: Update Zod Schema

**File: `lib/schemas/transcription.ts`**

Add validation for the mode:
```typescript
export const transcriptionModeSchema = z.enum(['transcribe', 'translate-to-english']);

export const transcriptionRequestSchema = z.object({
  model: whisperModelSchema.optional().default('whisper-1'),
  language: z.string().length(2).optional(),
  prompt: z.string().max(1500).optional(),
  chunkSeconds: z.number().min(300).max(600).optional().default(480),
  responseFormat: responseFormatSchema.optional().default('text'),
  mode: transcriptionModeSchema.optional().default('transcribe'), // Add this
});
```

#### Step 3: Update OpenAI Transcription Logic

**File: `lib/openai/transcribe.ts`**

Modify the `transcribeAudioFile` function:
```typescript
export async function transcribeAudioFile(
  audioPath: string,
  options: {
    model?: WhisperModel;
    language?: string;
    prompt?: string;
    responseFormat?: ResponseFormat;
    mode?: 'transcribe' | 'translate-to-english'; // Add this
  } = {}
): Promise<string> {
  const {
    model = 'whisper-1',
    language,
    prompt,
    responseFormat = 'text',
    mode = 'transcribe', // Add this
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Choose the appropriate endpoint based on mode
      const transcription = mode === 'translate-to-english'
        ? await openai.audio.translations.create({
            model,
            file: fs.createReadStream(audioPath),
            response_format: responseFormat,
            prompt,
            temperature: 0,
          })
        : await openai.audio.transcriptions.create({
            model,
            file: fs.createReadStream(audioPath),
            response_format: responseFormat,
            language,
            prompt,
            temperature: 0,
          });

      return typeof transcription === 'string' ? transcription : transcription.text;
    } catch (error: any) {
      // ... existing retry logic
    }
  }

  throw lastError || new Error('Transcription failed after retries');
}
```

Also update the `transcribeAudio` function signature to accept mode:
```typescript
export async function transcribeAudio(
  audioPath: string,
  chunks: AudioChunk[] | undefined,
  options: {
    model?: WhisperModel;
    language?: string;
    prompt?: string;
    responseFormat?: ResponseFormat;
    mode?: 'transcribe' | 'translate-to-english'; // Add this
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<{ transcript: string; chunksProcessed: number }> {
  // Pass mode to transcribeAudioFile or transcribeChunks
}
```

#### Step 4: Update API Route

**File: `app/api/transcribe/route.ts`**

Parse the mode from form data:
```typescript
const rawOptions = {
  model: formData.get('model') || undefined,
  language: formData.get('language') || undefined,
  prompt: formData.get('prompt') || undefined,
  chunkSeconds: formData.get('chunkSeconds')
    ? Number(formData.get('chunkSeconds'))
    : undefined,
  responseFormat: formData.get('responseFormat') || undefined,
  mode: formData.get('mode') || undefined, // Add this
};

// ... validation ...

// Pass mode to transcribeAudio
const { transcript, chunksProcessed } = await transcribeAudio(
  audioPath,
  chunks,
  {
    model: options.model,
    language: options.language,
    prompt: options.prompt,
    responseFormat: options.responseFormat,
    mode: options.mode, // Add this
  }
);
```

#### Step 5: Add UI Toggle

**File: `app/transcribe/page.tsx`**

Add a state for mode and a toggle in the UI:
```typescript
const [mode, setMode] = useState<'transcribe' | 'translate-to-english'>('transcribe');

// In the handleTranscribe function:
const formData = new FormData();
formData.append('video', selectedFile);
formData.append('mode', mode); // Add this

// Add UI element before "Start Transcription" button:
<div className="flex items-center justify-center gap-4 mb-4">
  <label className="flex items-center gap-2">
    <input
      type="radio"
      value="transcribe"
      checked={mode === 'transcribe'}
      onChange={(e) => setMode(e.target.value as any)}
    />
    <span>Transcribe (keep original language)</span>
  </label>
  <label className="flex items-center gap-2">
    <input
      type="radio"
      value="translate-to-english"
      checked={mode === 'translate-to-english'}
      onChange={(e) => setMode(e.target.value as any)}
    />
    <span>Translate to English</span>
  </label>
</div>
```

---

### Option 2: Add Full Multi-Language Translation (via GPT-4)

For translating between any two languages (e.g., Spanish to French), you'll need to use GPT-4 after transcription.

#### Step 1: Create Translation Service

**File: `lib/openai/translate.ts` (new file)**

```typescript
import { openai } from './client';

export async function translateText(
  text: string,
  targetLanguage: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are a professional translator. Translate the following text to ${targetLanguage}. Maintain the original tone, style, and formatting. Only output the translation, nothing else.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    temperature: 0.3,
  });

  return response.choices[0].message.content || text;
}
```

#### Step 2: Update API Route

**File: `app/api/transcribe/route.ts`**

After getting the transcript:
```typescript
// Get transcript
const { transcript, chunksProcessed } = await transcribeAudio(/*...*/);

// If translation is requested
let finalTranscript = transcript;
const targetLanguage = formData.get('targetLanguage');

if (targetLanguage && targetLanguage !== 'original') {
  const { translateText } = await import('@/lib/openai/translate');
  finalTranscript = await translateText(transcript, targetLanguage);
}

// Return finalTranscript instead of transcript
```

#### Step 3: Add Language Selector UI

Add a dropdown in the transcription page for target language selection:
```typescript
<select
  value={targetLanguage}
  onChange={(e) => setTargetLanguage(e.target.value)}
>
  <option value="original">Keep Original Language</option>
  <option value="English">English</option>
  <option value="Spanish">Spanish</option>
  <option value="French">French</option>
  <option value="German">German</option>
  <option value="Chinese">Chinese</option>
  <option value="Japanese">Japanese</option>
  {/* Add more languages as needed */}
</select>
```

---

## Cost Considerations

### Current Implementation (Transcription Only)
- **Whisper API**: $0.006 per minute of audio
- Example: 30-minute video = ~$0.18

### With Translation to English (Option 1)
- **Whisper Translations API**: $0.006 per minute
- Same cost as transcription

### With GPT-4 Translation (Option 2)
- **Whisper API**: $0.006 per minute
- **GPT-4**: ~$0.03 per 1K tokens (input) + ~$0.06 per 1K tokens (output)
- Example: 30-minute video (~4,500 words) = $0.18 + ~$0.50 = **~$0.68 total**

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | Your OpenAI API key |
| `MAX_FILE_SIZE_MB` | No | 2048 | Maximum upload file size in MB |
| `CHUNK_DURATION_SECONDS` | No | 480 | Audio chunk duration (5-10 minutes) |
| `TEMP_DIR` | No | `/tmp/transcriptions` | Temporary file storage directory |
| `DEFAULT_MODEL` | No | `whisper-1` | Default Whisper model |
| `DEFAULT_LANGUAGE` | No | - | Default language code (ISO-639-1) |

## Project Structure

```
/app
  /api/transcribe/route.ts      # Main API endpoint
  /transcribe/page.tsx           # Transcription UI
  page.tsx                       # Landing page
  layout.tsx                     # Root layout with header
/components
  Header.tsx                     # Navigation header
  VideoUploader.tsx              # File upload component
  TranscriptionDisplay.tsx       # Results display
  ProgressIndicator.tsx          # Progress tracking
  /ui                            # shadcn/ui components
/lib
  /audio/processor.ts            # FFmpeg audio processing
  /openai/client.ts              # OpenAI client setup
  /openai/transcribe.ts          # Transcription logic
  /schemas/transcription.ts      # Zod validation schemas
/types/index.ts                  # TypeScript definitions
```

## Tech Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **UI**: React 19 with TypeScript
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Components**: shadcn/ui with Base UI primitives
- **Validation**: Zod
- **AI**: OpenAI SDK (Whisper API)
- **Audio Processing**: FFmpeg

## Build & Deploy

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add `OPENAI_API_KEY` environment variable
4. **Important**: Ensure FFmpeg is available in your deployment environment
   - Vercel Hobby plan may require a custom Docker image with FFmpeg
   - Consider using Vercel Pro or a different hosting platform with FFmpeg support

## Troubleshooting

### FFmpeg Not Found
```
Error: FFmpeg not available
```
**Solution**: Install FFmpeg and ensure it's in your PATH

### OpenAI API Key Invalid
```
Error: OpenAI API authentication failed
```
**Solution**: Check your `.env.local` file and ensure the API key is correct

### File Size Too Large
```
Error: File size must be less than 2GB
```
**Solution**: Compress your video or increase `MAX_FILE_SIZE_MB` in `.env.local`

### Build Fails with Environment Error
**Solution**: The app uses lazy initialization. Environment variables are only required at runtime, not build time.

## Contributing

This is a production-ready MVP. Feel free to extend with:
- Translation features (see guide above)
- Subtitle generation (SRT/VTT formats)
- Speaker diarization
- Custom prompt templates
- Video trimming before transcription

## License

MIT

## Support

For issues related to:
- **OpenAI Whisper**: [OpenAI Documentation](https://platform.openai.com/docs/guides/speech-to-text)
- **Next.js**: [Next.js Documentation](https://nextjs.org/docs)
- **FFmpeg**: [FFmpeg Documentation](https://ffmpeg.org/documentation.html)

---

Built with Next.js, OpenAI Whisper, and ❤️
