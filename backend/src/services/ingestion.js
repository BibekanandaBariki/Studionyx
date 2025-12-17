import axios from 'axios';
import { YoutubeTranscript } from 'youtube-transcript';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { uploadToGemini } from './fileManager.js';

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
 * Fetch YouTube video transcript
 */
export async function fetchTranscript(videoUrl) {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map(item => item.text).join(' ');
  } catch (error) {
    console.error('Error fetching transcript:', error.message);
    // Don't fail the whole process if one video fails, just return error text
    return `[Failed to fetch transcript for video ${videoUrl}: ${error.message}]`;
  }
}

/**
 * Ingest all study materials and combine into multimodal context parts
 * @param {Array} sources - Array of source objects
 */
export async function ingestStudyMaterials(sources = null) {
  if (!sources || sources.length === 0) {
    // Fallback logic for env vars (legacy support, converted to text parts)
    const pdfUrl = process.env.PDF_URL;
    if (pdfUrl) {
      // If we have legacy env vars, we might want to still try the new drive logic
      sources = [{ type: 'drive', url: pdfUrl, name: 'Economics Textbook' }];
    } else {
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
              break;

            case 'youtube':
              const transcript = await fetchTranscript(source.url);
              part = { text: `\n=== SOURCE: ${info.name} (YouTube) ===\n${transcript}\n` };
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




