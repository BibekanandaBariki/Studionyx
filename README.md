## Interactive Study Tool – NotebookLM Reimagined

AI-powered grounded study assistant for an economics chapter and two YouTube lectures, with a WebGL hero, glassmorphic UI, grounded Gemini Q&A, voice dialogue, and video-style summaries.

### Features

- **Grounded AI Q&A**: Gemini 1.5 Flash grounded in sourced material with accurate PDF page numbers and strict citation rules.
- **Enhanced Voice Dialogue**: Friendly, human-like tutor with conversational mode, stop-speaking control, and natural turn-taking.
- **Detailed Video-style Summaries**: Comprehensive 3-slide breakdown (Overview, Concepts, Exam Tips) with deep synthesis and scrollable content.
- **Modern Emerald UI**: WebGL particle hero, glassmorphism, animated borders, and premium visual effects.
- **Fully Responsive Design**: Optimized mobile layout with flexible grids, touch-friendly controls, and collapsible navigation.

### Tech Stack

- **Frontend**: React 18, Vite 5, Tailwind CSS 3, Three.js, Framer Motion, Lucide React, Web Speech API.
- **Backend**: Node.js 18+, Express 4, `@google/generative-ai`, `pdf-parse`, `youtube-transcript`, Axios, dotenv.
- **Deployment**: Frontend on Vercel, backend on Render (see `DEPLOYMENT.md`).

### Setup

```bash
git clone <your-repo-url>
cd interactive-study-tool

# Backend
cd backend
npm install
cp .env.example .env
# Fill GEMINI_API_KEY and study URLs if needed
npm run dev

# Frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

Open `http://localhost:5173` and click “Ingest study material” first, then try Q&A, Voice Dialogue, and Video Summary modes.

### API Overview

- **POST `/api/ingest`**: Pulls PDF and YouTube transcripts, builds combined context, stores in memory.
- **POST `/api/ask`**: Grounded Q&A with accurate citations -> `{ answer, isGrounded, sources }`.
- **POST `/api/dialogue`**: Conversational voice turns -> `{ studentMessage, teacherResponse, isGrounded }`.
- **POST `/api/summary`**: Returns detailed structured summary -> `{ overview, concepts[], examTips[] }`.
- **GET `/api/suggest-questions`**: Generates comprehensive suggested questions based on all material.
- **GET `/api/health`**: Basic health check.
- **GET `/api/test-gemini`**: Verifies Gemini connectivity.
- **POST `/api/clear-history`**, **GET `/api/history`**, **GET `/api/stats`**: Conversation + storage introspection.

For more deployment details, see `DEPLOYMENT.md`. This project is built for the Markaroo internship assignment and can be extended with multi-user auth and persistent storage in future iterations.



