import express from 'express';
import storage from '../services/storage.js';
import { ingestStudyMaterials } from '../services/ingestion.js';
import {
  askQuestion,
  dialogueTurn,
  generateSummary,
  testGeminiConnection,
} from '../services/geminiService.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Test Gemini connection
router.get('/test-gemini', async (req, res, next) => {
  try {
    const result = await testGeminiConnection();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Ingest study materials (PDF + YouTube)
router.post('/ingest', async (req, res, next) => {
  try {
    // Get sources from storage
    const sources = storage.getSources();

    // If no sources in storage, use default from env vars (backward compatibility)
    const material = await ingestStudyMaterials(sources.length > 0 ? sources : null);

    storage.setStudyMaterial(material);
    res.json({
      success: true,
      message: 'Study material ingested successfully',
      stats: material.stats,
      sources: material.sources,
    });
  } catch (err) {
    next(err);
  }
});

// Upload file endpoint
router.post('/upload', async (req, res, next) => {
  try {
    const multer = (await import('multer')).default;
    const { processUploadedFile, isValidFileType, isValidFileSize } = await import('../services/uploadService.js');

    // Configure multer for memory storage
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        if (isValidFileType(file.mimetype, file.originalname)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Supported: PDF, DOCX, TXT, MD'));
        }
      },
    }).single('file');

    // Wrap multer middleware in promise
    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!req.file) {
      const error = new Error('No file uploaded');
      error.statusCode = 400;
      throw error;
    }

    // Validate file size
    if (!isValidFileSize(req.file.size)) {
      const error = new Error('File size exceeds 10MB limit');
      error.statusCode = 400;
      throw error;
    }

    // Process the uploaded file
    const result = await processUploadedFile(req.file);

    // Add to storage as a source
    const source = storage.addSource({
      type: 'file',
      fileName: result.fileName,
      fileType: result.fileType,
      text: result.text,
      size: result.size,
      name: result.fileName,
      metadata: result.metadata
    });

    try {
      const material = await ingestStudyMaterials(storage.getSources());
      storage.setStudyMaterial(material);
      res.json({
        success: true,
        message: 'File uploaded and study material ingested successfully',
        source: {
          id: source.id,
          name: source.fileName,
          type: source.fileType,
          size: source.size,
        },
        stats: material.stats,
        sources: material.sources,
      });
    } catch (ingestErr) {
      res.json({
        success: true,
        message: 'File uploaded, but ingestion failed. Try /api/ingest.',
        source: {
          id: source.id,
          name: source.fileName,
          type: source.fileType,
          size: source.size,
        },
        error: ingestErr.message,
      });
    }
  } catch (err) {
    next(err);
  }
});

// Add source (Google Drive, YouTube, Text)
router.post('/sources/add', async (req, res, next) => {
  try {
    const { type, url, content, name } = req.body || {};

    if (!type) {
      const error = new Error('Source type is required');
      error.statusCode = 400;
      throw error;
    }

    let sourceData = { type, name: name || `${type} source` };

    if (type === 'drive' || type === 'youtube') {
      if (!url) {
        const error = new Error('URL is required for drive/youtube sources');
        error.statusCode = 400;
        throw error;
      }
      sourceData.url = url;
    } else if (type === 'text') {
      if (!content) {
        const error = new Error('Content is required for text sources');
        error.statusCode = 400;
        throw error;
      }
      sourceData.content = content;
    } else {
      const error = new Error('Invalid source type. Use: drive, youtube, or text');
      error.statusCode = 400;
      throw error;
    }

    const source = storage.addSource(sourceData);

    // Auto-ingest immediately so all endpoints use the latest sources
    try {
      const material = await ingestStudyMaterials(storage.getSources());
      storage.setStudyMaterial(material);
      res.json({
        success: true,
        message: 'Source added and study material ingested successfully',
        source: {
          id: source.id,
          type: source.type,
          name: source.name,
        },
        stats: material.stats,
        sources: material.sources,
      });
    } catch (ingestErr) {
      // If ingestion fails, still return the source addition and allow client to retry
      res.json({
        success: true,
        message: 'Source added, but ingestion failed. Try /api/ingest.',
        source: {
          id: source.id,
          type: source.type,
          name: source.name,
        },
        error: ingestErr.message,
      });
    }
  } catch (err) {
    next(err);
  }
});

// Get all sources
router.get('/sources', (req, res) => {
  const sources = storage.getSources();
  res.json({
    success: true,
    sources: sources.map(s => ({
      id: s.id,
      type: s.type,
      name: s.name,
      fileName: s.fileName,
      size: s.size,
      addedAt: s.addedAt,
    })),
    count: sources.length,
  });
});

// Remove a source
router.delete('/sources/:id', (req, res) => {
  const { id } = req.params;
  const removed = storage.removeSource(id);

  if (removed) {
    res.json({
      success: true,
      message: 'Source removed successfully',
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Source not found',
    });
  }
});

// Clear all sources
router.post('/sources/clear', (req, res) => {
  storage.clearSources();
  storage.clearStudyMaterial();
  res.json({
    success: true,
    message: 'All sources cleared',
  });
});


// Grounded Q&A
router.post('/ask', async (req, res, next) => {
  try {
    const { question } = req.body || {};
    if (!question || typeof question !== 'string') {
      const error = new Error('Invalid request: "question" is required');
      error.statusCode = 400;
      throw error;
    }

    const answer = await askQuestion(question);
    res.json({
      ...answer,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// Voice dialogue
router.post('/dialogue', async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      const error = new Error('Invalid request: "message" is required');
      error.statusCode = 400;
      throw error;
    }

    const entry = await dialogueTurn(message);
    res.json({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// Summary endpoint
router.post('/summary', async (req, res, next) => {
  try {
    const result = await generateSummary();
    res.json({
      ...result,
      slideCount: 3,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// Suggest questions endpoint
router.post('/suggest-questions', async (req, res, next) => {
  try {
    const { generateSuggestedQuestions } = await import('../services/geminiService.js');
    const result = await generateSuggestedQuestions();
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    // Handle specific error cases
    if (err.statusCode === 400) {
      // Material not ingested yet
      return res.status(400).json({
        success: false,
        message: err.message,
        questions: [
          "Upload study material to get started",
          "What topics would you like to learn?",
          "Need help with anything?"
        ]
      });
    }
    
    // For API errors (rate limiting, quota, network issues), return fallback
    if (err.message?.includes('quota') || err.message?.includes('rate') || err.status === 503) {
      console.error('Gemini API error:', err.message);
      return res.status(200).json({
        success: true,
        questions: [
          "What are the main concepts?",
          "Can you explain this topic?",
          "What should I focus on?",
          "Help me understand this better"
        ]
      });
    }
    
    next(err);
  }
});

// Clear conversation history
router.post('/clear-history', (req, res) => {
  storage.clearHistory();
  res.json({
    success: true,
    message: 'History cleared',
  });
});

// Get conversation history
router.get('/history', (req, res) => {
  const history = storage.getHistory();
  res.json({
    success: true,
    history,
    count: history.length,
  });
});

// Storage stats
router.get('/stats', (req, res) => {
  const stats = storage.getStats();
  res.json(stats);
});

export default router;


