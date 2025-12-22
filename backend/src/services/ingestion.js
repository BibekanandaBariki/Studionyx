import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pdfParse from 'pdf-parse';
import { uploadToGemini } from './fileManager.js';
import storage from './storage.js';

dotenv.config();

/**
 * Extract file ID from Google Drive URL
 */
function extractDriveFileId(url) {
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch PDF/File from Google Drive and upload to Gemini
 */
export async function processDriveFile(driveUrl) {
  try {
    const fileId = extractDriveFileId(driveUrl);
    if (!fileId) {
      throw new Error('Invalid Google Drive URL');
    }

    // Use direct download link
    const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const response = await axios.get(directUrl, {
      responseType: 'arraybuffer',
      maxRedirects: 5,
    });

    // Determine physical page count from PDF buffer
    let physicalPages = null;
    try {
      const pdfData = await pdfParse(Buffer.from(response.data));
      physicalPages = pdfData.numpages || pdfData.numPages || null;
    } catch (e) {
      // ignore parsing errors; not critical
      physicalPages = null;
    }

    // Create temp file
    const tempFilePath = path.join(os.tmpdir(), `drive_${fileId}.pdf`);
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));

    // Upload to Gemini
    const uploadResult = await uploadToGemini(tempFilePath, 'application/pdf');

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    return {
      type: 'file_ref',
      fileUri: uploadResult.uri,
      mimeType: uploadResult.mimeType,
      name: `Google Drive PDF - ${fileId}`,
      physicalPages,
    };
  } catch (error) {
    console.error('Error processing Drive file:', error.message);
    throw new Error(`Failed to process Drive file: ${error.message}`);
  }
}

/**
 * Upload local buffer to Gemini
 */
export async function processLocalFile(buffer, filename, mimetype) {
  try {
    // strict check for supported types by Gemini File API for this use case
    // For MVP we assume all uploaded files are PDFs or images if not text
    let targetMime = mimetype;
    if (!targetMime) {
      if (filename.endsWith('.pdf')) targetMime = 'application/pdf';
      else if (filename.match(/\.(jpg|jpeg|png|webp)$/i)) targetMime = 'image/jpeg'; // simplification
      else targetMime = 'application/pdf'; // fallback
    }

    const tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${filename}`);
    fs.writeFileSync(tempFilePath, buffer);

    const uploadResult = await uploadToGemini(tempFilePath, targetMime);

    fs.unlinkSync(tempFilePath);

    return {
      type: 'file_ref',
      fileUri: uploadResult.uri,
      mimeType: uploadResult.mimeType,
      name: filename,
    };
  } catch (error) {
    console.error('Error processing local file:', error.message);
    throw new Error(`Failed to process local file: ${error.message}`);
  }
}



/**
 * Ingest all study materials and combine into multimodal context parts
 * @param {Array} sources - Array of source objects
 */
export async function ingestStudyMaterials(sources = null) {
  if (!sources || sources.length === 0) {
    if (!storage.isDefaultActive()) {
      throw new Error('No sources provided for active notebook');
    }
    sources = [];
    if (process.env.PDF_URL) {
      sources.push({ type: 'drive', url: process.env.PDF_URL, name: 'Economics Textbook' });
    }
    if (process.env.YOUTUBE_VIDEO_1) {
      sources.push({ type: 'youtube', url: process.env.YOUTUBE_VIDEO_1, name: 'Oligopoly - Kinked Demand' });
    }
    if (process.env.YOUTUBE_VIDEO_2) {
      sources.push({ type: 'youtube', url: process.env.YOUTUBE_VIDEO_2, name: 'Oligopoly - Game Theory' });
    }
    if (sources.length === 0) {
      throw new Error('No sources provided');
    }
  }

  try {
    console.log(`Starting material ingestion for ${sources.length} sources...`);

    const processedParts = [];
    const processedSourcesInfo = [];

    for (const [index, source] of sources.entries()) {
      let part = null;
      let info = { name: source.name || `Source ${index + 1}`, type: source.type };

      try {
        // Source type 'file' might be a text file (source.text) or a Gemini File (source.fileUri)
        if (source.type === 'file') {
          if (source.fileUri) {
            // It's a file uploaded to Gemini (PDF, Image)
            part = {
              fileData: {
                mimeType: source.mimeType || 'application/pdf',
                fileUri: source.fileUri
              }
            };
          } else if (source.text) {
            // It's a text/docx file processed locally
            part = { text: `\n=== SOURCE: ${info.name} (File) ===\n${source.text}\n` };
          }
        } else {
          switch (source.type) {
            case 'drive':
              const driveFile = await processDriveFile(source.url);
              part = {
                fileData: {
                  mimeType: driveFile.mimeType,
                  fileUri: driveFile.fileUri,
                },
              };
              info.name = driveFile.name;
              if (driveFile.physicalPages) {
                processedParts.push({
                  text: `\n=== SOURCE META: ${info.name} ===\nPhysical page count: ${driveFile.physicalPages}\nAlways cite using "Page X (Physical)" in the range 1-${driveFile.physicalPages}. Do not use printed page numbers if they differ from physical count.\n`
                });
              }
              break;

            case 'youtube':
              // DIRECT GEMINI VIDEO INGESTION (No scraping)
              // We pass the URL directly to Gemini as text, instructing it to use the video.
              // This avoids IP blocking/CAPTCHA issues on Render.
              const videoId = extractVideoId(source.url);
              part = {
                text: `\n=== SOURCE: ${info.name} (YouTube Video) ===\nURL: ${source.url}\nVideo ID: ${videoId}\n[Instruction to Model: This is a YouTube video source. Please use your internal video understanding capabilities to access and analyze the content of this video from the provided URL.]\n`
              };
              break;

            case 'text':
              part = { text: `\n=== SOURCE: ${info.name} (Text) ===\n${source.content}\n` };
              break;

            default:
              console.warn(`Unknown source type: ${source.type}`);
          }
        }

        if (part) {
          processedParts.push(part);
          processedSourcesInfo.push(info);
        }
      } catch (e) {
        console.error(`Failed to process source ${index}:`, e);
        // Add error note to context so AI knows
        processedParts.push({ text: `\n[System Error: Failed to load source ${info.name}: ${e.message}]\n` });
      }
    }

    const stats = {
      sourceCount: processedSourcesInfo.length,
      sources: processedSourcesInfo,
      isMultimodal: true
    };

    console.log('Multimodal ingestion complete:', stats);

    return {
      contextParts: processedParts,
      stats,
      sources: processedSourcesInfo.map(s => s.name),
    };
  } catch (error) {
    console.error('Ingestion error:', error);
    throw error;
  }
}
