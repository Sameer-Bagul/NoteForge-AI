# Environment Variables Setup

This document explains how to configure environment variables for the YT Video to Notes application.

## Frontend (.env)

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

### Available Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3001/api` |
| `VITE_DEV_PORT` | Development server port | `8080` |
| `VITE_ENABLE_MOCK_DATA` | Use mock data instead of real API | `false` |
| `VITE_ENABLE_DEBUG_LOGS` | Enable debug console logs | `true` |

### Example Configuration

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_DEV_PORT=8080
VITE_ENABLE_MOCK_DATA=false
VITE_ENABLE_DEBUG_LOGS=true
```

## Backend (server/.env)

Create a `.env` file in the `server` directory:

```bash
cd server
cp .env.example .env
```

### Available Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:8080` |
| `OLLAMA_BASE_URL` | Ollama API base URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | LLM model to use | `mistral` |
| `OLLAMA_TEMPERATURE` | LLM temperature (0.0-1.0) | `0.7` |
| `OLLAMA_MAX_TOKENS` | Max tokens per generation | `4000` |
| `STORAGE_DIR` | Directory for storing data | `./storage` |
| `LOG_LEVEL` | Logging level | `info` |
| `ENABLE_DEBUG_LOGS` | Enable debug logging | `true` |

### Example Configuration

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:8080

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
OLLAMA_TEMPERATURE=0.7
OLLAMA_MAX_TOKENS=4000

STORAGE_DIR=./storage
LOG_LEVEL=info
ENABLE_DEBUG_LOGS=true
```

## Production Configuration

### Frontend

For production deployment:

```env
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_ENABLE_DEBUG_LOGS=false
```

### Backend

For production deployment:

```env
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

OLLAMA_BASE_URL=http://your-ollama-server:11434
OLLAMA_MODEL=mistral
OLLAMA_TEMPERATURE=0.7
OLLAMA_MAX_TOKENS=4000

STORAGE_DIR=/var/app/storage
ENABLE_DEBUG_LOGS=false
```

## Notes

- **Never commit `.env` files** - They are already in `.gitignore`
- Use `.env.example` files as templates for team members
- Restart both frontend and backend servers after changing environment variables
- Frontend env vars must start with `VITE_` to be accessible in the browser
- Backend env vars are loaded using `dotenv/config`

## Troubleshooting

### Frontend can't connect to backend

1. Check `VITE_API_BASE_URL` matches your backend server URL
2. Verify backend is running on the correct port
3. Check browser console for CORS errors

### Backend can't connect to Ollama

1. Ensure Ollama is running: `ollama serve`
2. Check `OLLAMA_BASE_URL` is correct
3. Test Ollama: `curl http://localhost:11434/api/tags`

### Changes not taking effect

1. Restart the development server
2. Clear browser cache (Ctrl+Shift+R)
3. Check you're editing the correct `.env` file (root vs server)
