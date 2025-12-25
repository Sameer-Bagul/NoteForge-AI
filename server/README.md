# NoteForge Server

Backend server for YouTube → Notes generation using local Ollama LLM.

## Prerequisites

1. **Node.js 18+**
2. **Ollama** - Install from [ollama.ai](https://ollama.ai)
3. **Mistral model** - Pull the model: `ollama pull mistral`

## Setup

```bash
cd server
npm install
```

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Ensure Ollama is Running

Before starting the server, make sure Ollama is running with the Mistral model:

```bash
# Start Ollama (in a separate terminal)
ollama serve

# Pull the model (first time only)
ollama pull mistral
```

## API Endpoints

### Health Check
```
GET /api/health
```

### YouTube
```
POST /api/youtube/validate     - Validate YouTube URL
POST /api/youtube/transcript   - Extract transcript from video
POST /api/youtube/playlist     - Fetch playlist info and transcripts
GET  /api/youtube/video/:id    - Get video info
```

### Processing
```
POST /api/process/start        - Start processing job
GET  /api/process/status/:id   - Get job status
GET  /api/process/jobs         - List all jobs
GET  /api/process/notebook/:id - Get generated notebook
GET  /api/process/index/:id    - Get generated index
GET  /api/process/llm/health   - Check LLM status
POST /api/process/llm/config   - Update LLM configuration
```

## Example Usage

### Start Processing
```bash
curl -X POST http://localhost:3001/api/process/start \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=VIDEO_ID"}'
```

### Check Status
```bash
curl http://localhost:3001/api/process/status/JOB_ID
```

## Storage

Generated files are stored in:
- `storage/transcripts/` - Raw video transcripts
- `storage/indexes/` - Unified topic indexes
- `storage/notes/` - Topic notes
- `storage/notebooks/` - Complete notebooks

## LLM Configuration

Default configuration uses Mistral at `localhost:11434`. Modify via API:

```bash
curl -X POST http://localhost:3001/api/process/llm/config \
  -H "Content-Type: application/json" \
  -d '{"model": "llama2", "temperature": 0.3}'
```

## Architecture

```
server/
├── src/
│   ├── routes/          # API routes
│   │   ├── youtube.ts   # YouTube-related endpoints
│   │   └── process.ts   # Processing endpoints
│   ├── services/        # Business logic
│   │   ├── transcript.service.ts  # Transcript extraction
│   │   ├── llm.service.ts         # Ollama integration
│   │   ├── index.service.ts       # Topic indexing
│   │   ├── notes.service.ts       # Note generation
│   │   └── job.service.ts         # Job management
│   ├── types/           # TypeScript types
│   ├── utils/           # Utilities
│   └── index.ts         # Entry point
├── storage/             # Generated files
└── package.json
```
