import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Root route for Render health check
app.get('/', (req, res) => {
  res.status(200).send('Interactive Study Tool API is running 🚀');
});

// Basic security / CORS
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  }),
);

app.use(express.json({ limit: '10mb' }));

// Mount API routes under /api
app.use('/api', apiRouter);

// 404 fallback for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found',
  });
});

// Central error handler
app.use(errorHandler);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Study Tool API listening on port ${port}`);
});

export default app;


