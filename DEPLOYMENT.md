## Deployment Guide

### Backend (Render)

1. Push the repository to GitHub.
2. Create a new Web Service on Render.
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
3. Environment variables (from `backend/.env.example`):
   - `GEMINI_API_KEY`
   - `PORT` (optional, Render sets `PORT`)
   - `NODE_ENV=production`
   - `FRONTEND_URL` (set to your Vercel URL)
   - `PDF_URL`, `YOUTUBE_VIDEO_1`, `YOUTUBE_VIDEO_2`
4. Deploy and wait until the service is live.

### Frontend (Vercel)

1. Create a new project on Vercel from the same GitHub repo.
2. Settings:
   - Framework: Vite
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `dist`
3. Environment variables:
   - `VITE_API_URL` set to the Render backend URL, e.g. `https://study-tool-api.onrender.com/api`
4. Deploy and test:
   - Open the Vercel URL
   - Click “Ingest study material” and wait for success
   - Test Q&A, Voice Dialogue, and Video Summary modes.
   - **Mobile Check**: Open on a mobile device to verify the responsive layout and touch interactions.



